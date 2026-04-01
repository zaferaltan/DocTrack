import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  applyMigrations,
  configureDatabaseConnection,
  getPendingMigrationIds,
  hasWorkspaceSignature
} from '@main/database/migrations';
import { nowIso } from '@main/utils/date';
import type { WorkspaceCreateInput, WorkspaceInfo } from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME,
  isDocumentIdFormatPreset,
  normalizeDocumentIdFormatTemplate,
  isWorkspaceFileOrganizationMode,
  isWorkspaceStorageLayoutPreset,
  isWorkspaceVersionManagementMode,
  normalizeVisibleDocumentColumns,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

const BACKUPS_DIRECTORY_NAME = 'Backups';

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
  templatesDirectoryPath: string;
  workspace: WorkspaceInfo;
  settings: WorkspaceSettings;
}

type WorkspaceInitializer = (context: WorkspaceContext) => void;

export class WorkspaceManager {
  private readonly contexts = new Map<string, WorkspaceContext>();

  createWorkspace(input: WorkspaceCreateInput, initializer?: WorkspaceInitializer): WorkspaceContext {
    const workspaceName = input.name.trim();
    this.assertValidWorkspaceName(workspaceName);
    const workspaceFolderName =
      typeof input.folderName === 'string' ? input.folderName.trim() : workspaceName;
    this.assertValidWorkspaceFolderName(workspaceFolderName);
    const parentPath = path.resolve(input.parentPath);
    const resolvedRootPath = path.join(parentPath, workspaceFolderName);

    if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) {
      throw new Error('The selected workspace location must be an existing folder.');
    }

    if (existsSync(resolvedRootPath)) {
      throw new Error('A workspace folder already exists at the selected location.');
    }

    const databaseDirectoryPath = this.getWorkspaceDatabaseDirectoryPath(resolvedRootPath);
    const documentsDirectoryPath = this.getWorkspaceDocumentsDirectoryPath(resolvedRootPath);
    const templatesDirectoryPath = this.getWorkspaceTemplatesDirectoryPath(resolvedRootPath);
    const databaseFilePath = this.getWorkspaceDatabaseFilePath(resolvedRootPath);
    const settings = this.normalizeWorkspaceSettings(input.settings);

    mkdirSync(databaseDirectoryPath, { recursive: true });
    mkdirSync(documentsDirectoryPath, { recursive: true });
    mkdirSync(templatesDirectoryPath, { recursive: true });
    const db = new Database(databaseFilePath);

    try {
      configureDatabaseConnection(db);
      applyMigrations(db);
      db.prepare(
        `
          INSERT INTO Workspaces (
            Id,
            Name,
            FilePath,
            RootPath,
            CreatedDate,
            StorageLayoutPreset,
            FileOrganizationMode,
            VersionManagementMode,
            DocumentIdFormatPreset,
            DocumentIdFormatTemplate,
            VisibleDocumentColumns,
            DefaultCompany,
            DefaultDepartment,
            CompanyLogoPath,
            AutoMarkPreviousVersionObsolete
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        workspaceName,
        databaseFilePath,
        resolvedRootPath,
        nowIso(),
        settings.storageLayoutPreset,
        settings.fileOrganizationMode,
        settings.versionManagementMode,
        settings.documentIdFormatPreset,
        settings.documentIdFormatTemplate,
        JSON.stringify(settings.visibleDocumentColumns),
        settings.defaultCompany,
        settings.defaultDepartment,
        settings.companyLogoPath,
        settings.autoMarkPreviousVersionObsolete ? 1 : 0
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

      const pendingMigrationIds = getPendingMigrationIds(db);
      if (pendingMigrationIds.length > 0) {
        this.createSafetySnapshot(resolvedRootPath, pendingMigrationIds);
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
    const templatesDirectoryPath = this.getWorkspaceTemplatesDirectoryPath(rootPath);
    mkdirSync(templatesDirectoryPath, { recursive: true });
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
      templatesDirectoryPath,
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
      .prepare(
        `
          SELECT
            StorageLayoutPreset,
            FileOrganizationMode,
            VersionManagementMode,
            DocumentIdFormatPreset,
            DocumentIdFormatTemplate,
            VisibleDocumentColumns,
            DefaultCompany,
            DefaultDepartment,
            CompanyLogoPath,
            AutoMarkPreviousVersionObsolete
          FROM Workspaces
          WHERE Id = 1
        `
      )
      .get() as
      | {
          StorageLayoutPreset: string;
          FileOrganizationMode: string;
          VersionManagementMode: string;
          DocumentIdFormatPreset: string;
          DocumentIdFormatTemplate: string;
          VisibleDocumentColumns: string;
          DefaultCompany: string;
          DefaultDepartment: string;
          CompanyLogoPath: string;
          AutoMarkPreviousVersionObsolete: number;
        }
      | undefined;

    if (
      !row ||
      !isWorkspaceStorageLayoutPreset(row.StorageLayoutPreset) ||
      !isWorkspaceFileOrganizationMode(row.FileOrganizationMode) ||
      !isWorkspaceVersionManagementMode(row.VersionManagementMode) ||
      !isDocumentIdFormatPreset(row.DocumentIdFormatPreset)
    ) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: row.StorageLayoutPreset,
      fileOrganizationMode: row.FileOrganizationMode,
      versionManagementMode: row.VersionManagementMode,
      documentIdFormatPreset: row.DocumentIdFormatPreset,
      documentIdFormatTemplate: normalizeDocumentIdFormatTemplate(
        row.DocumentIdFormatTemplate,
        row.DocumentIdFormatPreset
      ),
      visibleDocumentColumns: this.parseVisibleDocumentColumns(row.VisibleDocumentColumns),
      defaultCompany: row.DefaultCompany,
      defaultDepartment: row.DefaultDepartment,
      companyLogoPath: row.CompanyLogoPath ?? '',
      autoMarkPreviousVersionObsolete: Boolean(row.AutoMarkPreviousVersionObsolete)
    };
  }

  private normalizeWorkspaceSettings(settings: WorkspaceCreateInput['settings']): WorkspaceSettings {
    if (
      !settings ||
      !isWorkspaceStorageLayoutPreset(settings.storageLayoutPreset) ||
      !isWorkspaceFileOrganizationMode(settings.fileOrganizationMode) ||
      !isWorkspaceVersionManagementMode(settings.versionManagementMode) ||
      !isDocumentIdFormatPreset(settings.documentIdFormatPreset)
    ) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: settings.storageLayoutPreset,
      fileOrganizationMode: settings.fileOrganizationMode,
      versionManagementMode: settings.versionManagementMode,
      documentIdFormatPreset: settings.documentIdFormatPreset,
      documentIdFormatTemplate: normalizeDocumentIdFormatTemplate(
        settings.documentIdFormatTemplate,
        settings.documentIdFormatPreset
      ),
      visibleDocumentColumns: normalizeVisibleDocumentColumns(settings.visibleDocumentColumns),
      defaultCompany: typeof settings.defaultCompany === 'string' ? settings.defaultCompany.trim() : '',
      defaultDepartment:
        typeof settings.defaultDepartment === 'string' ? settings.defaultDepartment.trim() : '',
      companyLogoPath: typeof settings.companyLogoPath === 'string' ? settings.companyLogoPath.trim() : '',
      autoMarkPreviousVersionObsolete:
        typeof settings.autoMarkPreviousVersionObsolete === 'boolean'
          ? settings.autoMarkPreviousVersionObsolete
          : DEFAULT_WORKSPACE_SETTINGS.autoMarkPreviousVersionObsolete
    };
  }

  private parseVisibleDocumentColumns(value: string): WorkspaceSettings['visibleDocumentColumns'] {
    try {
      return normalizeVisibleDocumentColumns(JSON.parse(value));
    } catch {
      return [...DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns];
    }
  }

  private getWorkspaceDatabaseDirectoryPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DATABASE_DIRECTORY_NAME);
  }

  private getWorkspaceDocumentsDirectoryPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME);
  }

  private getWorkspaceTemplatesDirectoryPath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME);
  }

  private getWorkspaceDatabaseFilePath(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DATABASE_DIRECTORY_NAME, WORKSPACE_DATABASE_FILE_NAME);
  }

  private createSafetySnapshot(rootPath: string, pendingMigrationIds: string[]): void {
    const createdDate = nowIso();
    const backupId = `${createdDate.replace(/[:.]/g, '').replace(/-/g, '')}-pre-migration`;
    const backupRootPath = path.join(rootPath, BACKUPS_DIRECTORY_NAME, backupId);
    const databaseSourcePath = this.getWorkspaceDatabaseDirectoryPath(rootPath);
    const documentsSourcePath = this.getWorkspaceDocumentsDirectoryPath(rootPath);
    const templatesSourcePath = this.getWorkspaceTemplatesDirectoryPath(rootPath);
    const manifestPath = path.join(backupRootPath, 'manifest.json');

    mkdirSync(backupRootPath, { recursive: true });
    cpSync(databaseSourcePath, path.join(backupRootPath, WORKSPACE_DATABASE_DIRECTORY_NAME), {
      recursive: true
    });
    cpSync(documentsSourcePath, path.join(backupRootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME), {
      recursive: true
    });
    if (existsSync(templatesSourcePath)) {
      cpSync(templatesSourcePath, path.join(backupRootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME), {
        recursive: true
      });
    }

    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          id: backupId,
          label: 'Safety Snapshot',
          createdDate,
          backupPath: backupRootPath,
          manifestPath,
          workspaceName: path.basename(rootPath),
          documentCount: 0,
          versionCount: 0,
          fileCount: 0,
          sizeBytes: 0,
          reason: 'safety',
          databaseDirectoryName: WORKSPACE_DATABASE_DIRECTORY_NAME,
          documentsDirectoryName: WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
          templatesDirectoryName: WORKSPACE_TEMPLATES_DIRECTORY_NAME,
          pendingMigrationIds
        },
        null,
        2
      ),
      'utf8'
    );
  }

  private assertValidWorkspaceName(workspaceName: string): void {
    this.assertValidFolderCompatibleName(workspaceName, 'Workspace name');
  }

  private assertValidWorkspaceFolderName(folderName: string): void {
    this.assertValidFolderCompatibleName(folderName, 'Folder name');
  }

  private assertValidFolderCompatibleName(value: string, label: string): void {
    if (!value) {
      throw new Error(`${label} is required.`);
    }

    if (value === '.' || value === '..') {
      throw new Error(`${label} cannot be "." or "..".`);
    }

    if (INVALID_WORKSPACE_NAME.test(value)) {
      throw new Error(`${label} contains characters that are not allowed in folder names.`);
    }

    if (/[. ]$/.test(value)) {
      throw new Error(`${label} cannot end with a space or period.`);
    }

    if (WINDOWS_RESERVED_WORKSPACE_NAMES.has(value.toUpperCase())) {
      throw new Error(`${label} is reserved by the operating system.`);
    }
  }
}
