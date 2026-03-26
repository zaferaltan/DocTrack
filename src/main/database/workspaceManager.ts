import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  applyMigrations,
  configureDatabaseConnection,
  hasWorkspaceSignature
} from '@main/database/migrations';
import { nowIso } from '@main/utils/date';
import type { WorkspaceCreateInput, WorkspaceInfo } from '@shared/types';

export interface WorkspaceContext {
  db: Database.Database;
  filePath: string;
  directoryPath: string;
  workspace: WorkspaceInfo;
}

type WorkspaceInitializer = (context: WorkspaceContext) => void;

export class WorkspaceManager {
  private readonly contexts = new Map<string, WorkspaceContext>();

  createWorkspace(input: WorkspaceCreateInput, initializer?: WorkspaceInitializer): WorkspaceContext {
    const resolvedPath = path.resolve(input.filePath);

    if (existsSync(resolvedPath)) {
      throw new Error('A workspace file already exists at the selected location.');
    }

    const workspaceName = input.name.trim();
    if (!workspaceName) {
      throw new Error('Workspace name is required.');
    }

    mkdirSync(path.dirname(resolvedPath), { recursive: true });
    const db = new Database(resolvedPath);

    try {
      configureDatabaseConnection(db);
      applyMigrations(db);
      db.prepare('INSERT INTO Workspaces (Id, Name, FilePath, CreatedDate) VALUES (1, ?, ?, ?)').run(
        workspaceName,
        resolvedPath,
        nowIso()
      );

      const context = this.buildContext(db, resolvedPath);
      initializer?.(context);
      db.close();
      return this.openWorkspace(resolvedPath);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  openWorkspace(filePath: string): WorkspaceContext {
    const resolvedPath = path.resolve(filePath);
    const existingContext = this.contexts.get(resolvedPath);

    if (existingContext) {
      existingContext.workspace = this.readWorkspaceInfo(existingContext.db, resolvedPath);
      return existingContext;
    }

    if (!existsSync(resolvedPath)) {
      throw new Error('The selected workspace file does not exist.');
    }

    const db = new Database(resolvedPath, { fileMustExist: true });

    try {
      configureDatabaseConnection(db);

      if (!hasWorkspaceSignature(db)) {
        throw new Error('The selected file is not a valid DocTrack workspace.');
      }

      applyMigrations(db);
      const context = this.buildContext(db, resolvedPath);
      this.contexts.set(resolvedPath, context);
      return context;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  getContext(filePath: string): WorkspaceContext {
    return this.openWorkspace(filePath);
  }

  closeWorkspace(filePath: string): WorkspaceInfo[] {
    const resolvedPath = path.resolve(filePath);
    const context = this.contexts.get(resolvedPath);

    if (context) {
      context.db.close();
      this.contexts.delete(resolvedPath);
    }

    return this.listOpenWorkspaces();
  }

  listOpenWorkspaces(): WorkspaceInfo[] {
    return [...this.contexts.values()].map((context) => ({
      ...context.workspace,
      isOpen: true
    }));
  }

  private buildContext(db: Database.Database, filePath: string): WorkspaceContext {
    db.prepare('UPDATE Workspaces SET FilePath = ? WHERE Id = 1').run(filePath);

    return {
      db,
      filePath,
      directoryPath: path.dirname(filePath),
      workspace: this.readWorkspaceInfo(db, filePath)
    };
  }

  private readWorkspaceInfo(db: Database.Database, filePath: string): WorkspaceInfo {
    const row = db
      .prepare('SELECT Id, Name, FilePath, CreatedDate FROM Workspaces WHERE Id = 1')
      .get() as { Id: number; Name: string; FilePath: string; CreatedDate: string } | undefined;

    if (!row) {
      throw new Error('The selected workspace file is missing its workspace metadata.');
    }

    return {
      id: row.Id,
      name: row.Name,
      filePath,
      createdDate: row.CreatedDate,
      isOpen: true
    };
  }
}
