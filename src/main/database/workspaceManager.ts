import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  applyMigrations,
  configureDatabaseConnection,
  hasWorkspaceSignature
} from '@main/database/migrations';
import { nowIso } from '@main/utils/date';
import type { WorkspaceCreateInput, WorkspaceInfo } from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  isWorkspaceStorageLayoutPreset,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

const INVALID_WORKSPACE_NAME = /[<>:"/\\|?*\u0000-\u001f]/;
const WINDOWS_RESERVED_WORKSPACE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
]);

export interface WorkspaceContext {
  db: Database.Database;
  rootPath: string;
  databaseFilePath: string;
  databaseDirectoryPath: string;
  documentsDirectoryPath: string;
  workspace: WorkspaceInfo;
  settings: WorkspaceSettings;
}

type WorkspaceInitializer = (context: WorkspaceContext) => void;

export class WorkspaceManager {
  private readonly contexts = new Map<string, WorkspaceContext>();

  createWorkspace(input: WorkspaceCreateInput, initializer?: WorkspaceInitializer): WorkspaceContext {
    const workspaceName = input.name.trim();
    this.assertValidWorkspaceName(workspaceName);
    const parentPath = path.resolve(input.parentPath);
    const resolvedRootPath = path.join(parentPath, workspaceName);

    if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) {
      throw new Error('The selected workspace location must be an existing folder.');
    }

    if (existsSync(resolvedRootPath)) {
      throw new Error('A workspace folder already exists at the selected location.');
    }

    const databaseDirectoryPath = this.getWorkspaceDatabaseDirectoryPath(resolvedRootPath);
    const documentsDirectoryPath = this.getWorkspaceDocumentsDirectoryPath(resolvedRootPath);
    const databaseFilePath = this.getWorkspaceDatabaseFilePath(resolvedRootPath);
    const settings = this.normalizeWorkspaceSettings(input.settings);

    mkdirSync(databaseDirectoryPath, { recursive: true });
    mkdirSync(documentsDirectoryPath, { recursive: true });
    const db = new Database(databaseFilePath);

    try {
      configureDatabaseConnection(db);
      applyMigrations(db);
      db.prepare(
        `
          INSERT INTO Workspaces (Id, Name, FilePath, RootPath, CreatedDate, StorageLayoutPreset)
          VALUES (1, ?, ?, ?, ?, ?)
        `
      ).run(
        workspaceName,
        databaseFilePath,
        resolvedRootPath,
        nowIso(),
        settings.storageLayoutPreset
      );

      const context = this.buildContext(db, resolvedRootPath);
      initializer?.(context);
      db.close();
      return this.openWorkspace(resolvedRootPath);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  openWorkspace(rootPath: string): WorkspaceContext {
    const resolvedRootPath = path.resolve(rootPath);
    const existingContext = this.contexts.get(resolvedRootPath);

    if (existingContext) {
      existingContext.workspace = this.readWorkspaceInfo(existingContext.db, resolvedRootPath);
      existingContext.settings = this.readWorkspaceSettings(existingContext.db);
      return existingContext;
    }

    if (!existsSync(resolvedRootPath)) {
      throw new Error('The selected workspace folder does not exist.');
    }

    if (!statSync(resolvedRootPath).isDirectory()) {
      throw new Error('The selected workspace path is not a folder.');
    }

    const databaseFilePath = this.getWorkspaceDatabaseFilePath(resolvedRootPath);
    if (!existsSync(databaseFilePath)) {
      throw new Error('The selected folder is not a valid DocTrack workspace.');
    }

    const db = new Database(databaseFilePath, { fileMustExist: true });

    try {
      configureDatabaseConnection(db);

      if (!hasWorkspaceSignature(db)) {
        throw new Error('The selected folder is not a valid DocTrack workspace.');
      }

      applyMigrations(db);
      const context = this.buildContext(db, resolvedRootPath);
      this.contexts.set(resolvedRootPath, context);
      return context;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  getContext(rootPath: string): WorkspaceContext {
    return this.openWorkspace(rootPath);
  }

  closeWorkspace(rootPath: string): WorkspaceInfo[] {
    const resolvedRootPath = path.resolve(rootPath);
    const context = this.contexts.get(resolvedRootPath);

    if (context) {
      context.db.close();
      this.contexts.delete(resolvedRootPath);
    }

    return this.listOpenWorkspaces();
  }

  dispose(): void {
    for (const context of this.contexts.values()) {
      context.db.close();
    }

    this.contexts.clear();
  }

  listOpenWorkspaces(): WorkspaceInfo[] {
    return [...this.contexts.values()].map((context) => ({
      ...context.workspace,
      isOpen: true
    }));
  }

  private buildContext(db: Database.Database, rootPath: string): WorkspaceContext {
    const databaseFilePath = this.getWorkspaceDatabaseFilePath(rootPath);
    db.prepare('UPDATE Workspaces SET FilePath = ?, RootPath = ? WHERE Id = 1').run(
      databaseFilePath,
      rootPath
    );

    return {
      db,
      rootPath,
      databaseFilePath,
      databaseDirectoryPath: this.getWorkspaceDatabaseDirectoryPath(rootPath),
      documentsDirectoryPath: this.getWorkspaceDocumentsDirectoryPath(rootPath),
      workspace: this.readWorkspaceInfo(db, rootPath),
      settings: this.readWorkspaceSettings(db)
    };
  }

  private readWorkspaceInfo(db: Database.Database, rootPath: string): WorkspaceInfo {
    const row = db
      .prepare('SELECT Id, Name, CreatedDate FROM Workspaces WHERE Id = 1')
      .get() as { Id: number; Name: string; CreatedDate: string } | undefined;

    if (!row) {
      throw new Error('The selected workspace file is missing its workspace metadata.');
    }

    return {
      id: row.Id,
      name: row.Name,
      rootPath,
      createdDate: row.CreatedDate,
      isOpen: true
    };
  }

  private readWorkspaceSettings(db: Database.Database): WorkspaceSettings {
    const row = db
      .prepare('SELECT StorageLayoutPreset FROM Workspaces WHERE Id = 1')
      .get() as { StorageLayoutPreset: string } | undefined;

    if (!row || !isWorkspaceStorageLayoutPreset(row.StorageLayoutPreset)) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: row.StorageLayoutPreset
    };
  }

  private normalizeWorkspaceSettings(settings: WorkspaceCreateInput['settings']): WorkspaceSettings {
    if (!settings || !isWorkspaceStorageLayoutPreset(settings.storageLayoutPreset)) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: settings.storageLayoutPreset
    };
  }

  private getWorkspaceDatabaseDirectoryPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DATABASE_DIRECTORY_NAME);
  }

  private getWorkspaceDocumentsDirectoryPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME);
  }

  private getWorkspaceDatabaseFilePath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DATABASE_DIRECTORY_NAME, WORKSPACE_DATABASE_FILE_NAME);
  }

  private assertValidWorkspaceName(workspaceName: string): void {
    if (!workspaceName) {
      throw new Error('Workspace name is required.');
    }

    if (workspaceName === '.' || workspaceName === '..') {
      throw new Error('Workspace name cannot be "." or "..".');
    }

    if (INVALID_WORKSPACE_NAME.test(workspaceName)) {
      throw new Error('Workspace name contains characters that are not allowed in folder names.');
    }

    if (/[. ]$/.test(workspaceName)) {
      throw new Error('Workspace name cannot end with a space or period.');
    }

    if (WINDOWS_RESERVED_WORKSPACE_NAMES.has(workspaceName.toUpperCase())) {
      throw new Error('Workspace name is reserved by the operating system.');
    }
  }
}
