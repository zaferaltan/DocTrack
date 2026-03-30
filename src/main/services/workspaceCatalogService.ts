import type { WorkspaceManager } from '@main/database/workspaceManager';
import type {
  ConfidentialityClass,
  ConfidentialityClassInput,
  Project,
  ProjectInput,
  WorkspaceLanguage,
  WorkspaceLanguageInput
} from '@shared/types';

const normalizeName = (value: string): string => value.trim();
const normalizeCode = (value: string): string => value.trim().toUpperCase();

export class WorkspaceCatalogService {
  constructor(private readonly workspaceManager: WorkspaceManager) {}

  listProjects(rootPath: string): Project[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare('SELECT Id, Name FROM Projects ORDER BY Name COLLATE NOCASE ASC')
      .all() as Array<{ Id: number; Name: string }>;

    return rows.map((row) => ({
      id: row.Id,
      name: row.Name
    }));
  }

  createProject(rootPath: string, input: ProjectInput): Project {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    if (!name) {
      throw new Error('Project name is required.');
    }

    const result = context.db.prepare('INSERT INTO Projects (Name) VALUES (?)').run(name);
    return {
      id: Number(result.lastInsertRowid),
      name
    };
  }

  updateProject(rootPath: string, id: number, input: ProjectInput): Project {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    if (!name) {
      throw new Error('Project name is required.');
    }

    const result = context.db.prepare('UPDATE Projects SET Name = ? WHERE Id = ?').run(name, id);
    if (result.changes === 0) {
      throw new Error('Project could not be found.');
    }

    return { id, name };
  }

  deleteProject(rootPath: string, id: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const documentsUsingProject = context.db
      .prepare('SELECT COUNT(*) AS total FROM Documents WHERE ProjectId = @id')
      .get({ id }) as { total: number } | undefined;

    if ((documentsUsingProject?.total ?? 0) > 0) {
      throw new Error('This project is already used by documents and cannot be deleted.');
    }

    const result = context.db.prepare('DELETE FROM Projects WHERE Id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Project could not be found.');
    }
  }

  listConfidentialityClasses(rootPath: string): ConfidentialityClass[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare('SELECT Id, Name FROM ConfidentialityClasses ORDER BY Name COLLATE NOCASE ASC')
      .all() as Array<{ Id: number; Name: string }>;

    return rows.map((row) => ({
      id: row.Id,
      name: row.Name
    }));
  }

  createConfidentialityClass(
    rootPath: string,
    input: ConfidentialityClassInput
  ): ConfidentialityClass {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    if (!name) {
      throw new Error('Confidentiality class name is required.');
    }

    const result = context.db
      .prepare('INSERT INTO ConfidentialityClasses (Name) VALUES (?)')
      .run(name);

    return {
      id: Number(result.lastInsertRowid),
      name
    };
  }

  updateConfidentialityClass(
    rootPath: string,
    id: number,
    input: ConfidentialityClassInput
  ): ConfidentialityClass {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    if (!name) {
      throw new Error('Confidentiality class name is required.');
    }

    const result = context.db
      .prepare('UPDATE ConfidentialityClasses SET Name = ? WHERE Id = ?')
      .run(name, id);

    if (result.changes === 0) {
      throw new Error('Confidentiality class could not be found.');
    }

    return { id, name };
  }

  deleteConfidentialityClass(rootPath: string, id: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const documentsUsingClass = context.db
      .prepare('SELECT COUNT(*) AS total FROM Documents WHERE ConfidentialityClassId = @id')
      .get({ id }) as { total: number } | undefined;

    if ((documentsUsingClass?.total ?? 0) > 0) {
      throw new Error('This confidentiality class is already used by documents and cannot be deleted.');
    }

    const result = context.db.prepare('DELETE FROM ConfidentialityClasses WHERE Id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Confidentiality class could not be found.');
    }
  }

  listLanguages(rootPath: string): WorkspaceLanguage[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare('SELECT Id, Code FROM Languages ORDER BY Code COLLATE NOCASE ASC')
      .all() as Array<{ Id: number; Code: string }>;

    return rows.map((row) => ({
      id: row.Id,
      code: row.Code
    }));
  }

  createLanguage(rootPath: string, input: WorkspaceLanguageInput): WorkspaceLanguage {
    const context = this.workspaceManager.getContext(rootPath);
    const code = normalizeCode(input.code);
    if (!code) {
      throw new Error('Language code is required.');
    }

    const result = context.db.prepare('INSERT INTO Languages (Code) VALUES (?)').run(code);
    return {
      id: Number(result.lastInsertRowid),
      code
    };
  }

  updateLanguage(rootPath: string, id: number, input: WorkspaceLanguageInput): WorkspaceLanguage {
    const context = this.workspaceManager.getContext(rootPath);
    const code = normalizeCode(input.code);
    if (!code) {
      throw new Error('Language code is required.');
    }

    const result = context.db.prepare('UPDATE Languages SET Code = ? WHERE Id = ?').run(code, id);
    if (result.changes === 0) {
      throw new Error('Language could not be found.');
    }

    return { id, code };
  }

  deleteLanguage(rootPath: string, id: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const documentsUsingLanguage = context.db
      .prepare('SELECT COUNT(*) AS total FROM Documents WHERE LanguageId = @id')
      .get({ id }) as { total: number } | undefined;

    if ((documentsUsingLanguage?.total ?? 0) > 0) {
      throw new Error('This language is already used by documents and cannot be deleted.');
    }

    const result = context.db.prepare('DELETE FROM Languages WHERE Id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Language could not be found.');
    }
  }
}
