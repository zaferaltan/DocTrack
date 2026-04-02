import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
  WORKSPACE_BACKUPS_DIRECTORY_NAME,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME,
  isValidWorkspaceRootDirectoryName,
  isDocumentIdFormatPreset,
  normalizeWorkspaceRootDirectoryNames,
  normalizeDocumentIdFormatTemplate,
  isWorkspaceFileOrganizationMode,
  isWorkspaceStorageLayoutPreset,
  isWorkspaceVersionManagementMode,
  normalizeVisibleDocumentColumns,
  normalizeWorkspaceActivityLogMaxRows,
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
  templatesDirectoryPath: string;
  backupsDirectoryPath: string;
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

    const settings = this.normalizeWorkspaceSettings(input.settings);
    const databaseDirectoryPath = this.getWorkspaceDatabaseDirectoryPath(resolvedRootPath, settings);
    const documentsDirectoryPath = this.getWorkspaceDocumentsDirectoryPath(resolvedRootPath, settings);
    const templatesDirectoryPath = this.getWorkspaceTemplatesDirectoryPath(resolvedRootPath, settings);
    const databaseFilePath = this.getWorkspaceDatabaseFilePath(resolvedRootPath, settings);

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
            DatabaseDirectoryName,
            DocumentsDirectoryName,
            TemplatesDirectoryName,
            BackupsDirectoryName,
            VisibleDocumentColumns,
            DefaultCompany,
            DefaultDepartment,
            CompanyLogoPath,
            AutoMarkPreviousVersionObsolete,
            ActivityLogEnabled,
            ActivityLogMaxRows
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        settings.databaseDirectoryName,
        settings.documentsDirectoryName,
        settings.templatesDirectoryName,
        settings.backupsDirectoryName,
        JSON.stringify(settings.visibleDocumentColumns),
        settings.defaultCompany,
        settings.defaultDepartment,
        settings.companyLogoPath,
        settings.autoMarkPreviousVersionObsolete ? 1 : 0,
        settings.activityLogEnabled ? 1 : 0,
        settings.activityLogMaxRows
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
      this.refreshContextLayoutPaths(existingContext);
      return existingContext;
    }

    if (!existsSync(resolvedRootPath)) {
      throw new Error('The selected workspace folder does not exist.');
    }

    if (!statSync(resolvedRootPath).isDirectory()) {
      throw new Error('The selected workspace path is not a folder.');
    }

    const databaseFilePath = this.findWorkspaceDatabaseFilePath(resolvedRootPath);
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
        this.createSafetySnapshot(resolvedRootPath, databaseFilePath, db, pendingMigrationIds);
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
    const settings = this.readWorkspaceSettings(db);
    const databaseFilePath = this.getWorkspaceDatabaseFilePath(rootPath, settings);
    const templatesDirectoryPath = this.getWorkspaceTemplatesDirectoryPath(rootPath, settings);
    mkdirSync(templatesDirectoryPath, { recursive: true });
    db.prepare('UPDATE Workspaces SET FilePath = ?, RootPath = ? WHERE Id = 1').run(
      databaseFilePath,
      rootPath
    );

    return {
      db,
      rootPath,
      databaseFilePath,
      databaseDirectoryPath: this.getWorkspaceDatabaseDirectoryPath(rootPath, settings),
      documentsDirectoryPath: this.getWorkspaceDocumentsDirectoryPath(rootPath, settings),
      templatesDirectoryPath,
      backupsDirectoryPath: this.getWorkspaceBackupsDirectoryPath(rootPath, settings),
      workspace: this.readWorkspaceInfo(db, rootPath),
      settings
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
    const workspaceColumns = new Set(
      (
        db.prepare('PRAGMA table_info(Workspaces)').all() as Array<{
          name: string;
        }>
      ).map((column) => column.name)
    );
    const hasRootDirectoryColumns =
      workspaceColumns.has('DatabaseDirectoryName') &&
      workspaceColumns.has('DocumentsDirectoryName') &&
      workspaceColumns.has('TemplatesDirectoryName') &&
      workspaceColumns.has('BackupsDirectoryName');
    const hasActivityLogColumns =
      workspaceColumns.has('ActivityLogEnabled') &&
      workspaceColumns.has('ActivityLogMaxRows');
    const row = db
      .prepare(
        `
          SELECT
            StorageLayoutPreset,
            FileOrganizationMode,
            VersionManagementMode,
            DocumentIdFormatPreset,
            DocumentIdFormatTemplate,
            ${hasRootDirectoryColumns ? 'DatabaseDirectoryName,' : ''}
            ${hasRootDirectoryColumns ? 'DocumentsDirectoryName,' : ''}
            ${hasRootDirectoryColumns ? 'TemplatesDirectoryName,' : ''}
            ${hasRootDirectoryColumns ? 'BackupsDirectoryName,' : ''}
            VisibleDocumentColumns,
            DefaultCompany,
            DefaultDepartment,
            CompanyLogoPath,
            AutoMarkPreviousVersionObsolete,
            ${hasActivityLogColumns ? 'ActivityLogEnabled' : `${DEFAULT_WORKSPACE_SETTINGS.activityLogEnabled ? 1 : 0} AS ActivityLogEnabled`},
            ${hasActivityLogColumns ? 'ActivityLogMaxRows' : `${DEFAULT_WORKSPACE_SETTINGS.activityLogMaxRows} AS ActivityLogMaxRows`}
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
          DatabaseDirectoryName?: string;
          DocumentsDirectoryName?: string;
          TemplatesDirectoryName?: string;
          BackupsDirectoryName?: string;
          VisibleDocumentColumns: string;
          DefaultCompany: string;
          DefaultDepartment: string;
          CompanyLogoPath: string;
          AutoMarkPreviousVersionObsolete: number;
          ActivityLogEnabled?: number;
          ActivityLogMaxRows?: number;
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

    const rootDirectoryNames = normalizeWorkspaceRootDirectoryNames({
      databaseDirectoryName: row.DatabaseDirectoryName,
      documentsDirectoryName: row.DocumentsDirectoryName,
      templatesDirectoryName: row.TemplatesDirectoryName,
      backupsDirectoryName: row.BackupsDirectoryName
    });

    return {
      storageLayoutPreset: row.StorageLayoutPreset,
      fileOrganizationMode: row.FileOrganizationMode,
      versionManagementMode: row.VersionManagementMode,
      documentIdFormatPreset: row.DocumentIdFormatPreset,
      documentIdFormatTemplate: normalizeDocumentIdFormatTemplate(
        row.DocumentIdFormatTemplate,
        row.DocumentIdFormatPreset
      ),
      ...rootDirectoryNames,
      visibleDocumentColumns: this.parseVisibleDocumentColumns(row.VisibleDocumentColumns),
      defaultCompany: row.DefaultCompany,
      defaultDepartment: row.DefaultDepartment,
      companyLogoPath: row.CompanyLogoPath ?? '',
      autoMarkPreviousVersionObsolete: Boolean(row.AutoMarkPreviousVersionObsolete),
      activityLogEnabled:
        typeof row.ActivityLogEnabled === 'number'
          ? Boolean(row.ActivityLogEnabled)
          : DEFAULT_WORKSPACE_SETTINGS.activityLogEnabled,
      activityLogMaxRows: normalizeWorkspaceActivityLogMaxRows(row.ActivityLogMaxRows)
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
      ...normalizeWorkspaceRootDirectoryNames(settings),
      visibleDocumentColumns: normalizeVisibleDocumentColumns(settings.visibleDocumentColumns),
      defaultCompany: typeof settings.defaultCompany === 'string' ? settings.defaultCompany.trim() : '',
      defaultDepartment:
        typeof settings.defaultDepartment === 'string' ? settings.defaultDepartment.trim() : '',
      companyLogoPath: typeof settings.companyLogoPath === 'string' ? settings.companyLogoPath.trim() : '',
      autoMarkPreviousVersionObsolete:
        typeof settings.autoMarkPreviousVersionObsolete === 'boolean'
          ? settings.autoMarkPreviousVersionObsolete
          : DEFAULT_WORKSPACE_SETTINGS.autoMarkPreviousVersionObsolete,
      activityLogEnabled:
        typeof settings.activityLogEnabled === 'boolean'
          ? settings.activityLogEnabled
          : DEFAULT_WORKSPACE_SETTINGS.activityLogEnabled,
      activityLogMaxRows: normalizeWorkspaceActivityLogMaxRows(settings.activityLogMaxRows)
    };
  }

  private parseVisibleDocumentColumns(value: string): WorkspaceSettings['visibleDocumentColumns'] {
    try {
      return normalizeVisibleDocumentColumns(JSON.parse(value));
    } catch {
      return [...DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns];
    }
  }

  private getWorkspaceDatabaseDirectoryPath(rootPath: string, settings: WorkspaceSettings): string {
    return path.join(rootPath, settings.databaseDirectoryName);
  }

  private getWorkspaceDocumentsDirectoryPath(rootPath: string, settings: WorkspaceSettings): string {
    return path.join(rootPath, settings.documentsDirectoryName);
  }

  private getWorkspaceTemplatesDirectoryPath(rootPath: string, settings: WorkspaceSettings): string {
    return path.join(rootPath, settings.templatesDirectoryName);
  }

  private getWorkspaceBackupsDirectoryPath(rootPath: string, settings: WorkspaceSettings): string {
    return path.join(rootPath, settings.backupsDirectoryName);
  }

  private getWorkspaceDatabaseFilePath(rootPath: string, settings: WorkspaceSettings): string {
    return path.join(rootPath, settings.databaseDirectoryName, WORKSPACE_DATABASE_FILE_NAME);
  }

  private createSafetySnapshot(
    rootPath: string,
    databaseFilePath: string,
    db: Database.Database,
    pendingMigrationIds: string[]
  ): void {
    const createdDate = nowIso();
    const backupId = `${createdDate.replace(/[:.]/g, '').replace(/-/g, '')}-pre-migration`;
    const settings = this.readWorkspaceSettings(db);
    const backupRootPath = path.join(rootPath, settings.backupsDirectoryName, backupId);
    const databaseSourcePath = path.dirname(databaseFilePath);
    const documentsSourcePath = this.getWorkspaceDocumentsDirectoryPath(rootPath, settings);
    const templatesSourcePath = this.getWorkspaceTemplatesDirectoryPath(rootPath, settings);
    const manifestPath = path.join(backupRootPath, 'manifest.json');

    mkdirSync(backupRootPath, { recursive: true });
    cpSync(databaseSourcePath, path.join(backupRootPath, settings.databaseDirectoryName), {
      recursive: true
    });
    cpSync(documentsSourcePath, path.join(backupRootPath, settings.documentsDirectoryName), {
      recursive: true
    });
    if (existsSync(templatesSourcePath)) {
      cpSync(templatesSourcePath, path.join(backupRootPath, settings.templatesDirectoryName), {
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
          databaseDirectoryName: settings.databaseDirectoryName,
          documentsDirectoryName: settings.documentsDirectoryName,
          templatesDirectoryName: settings.templatesDirectoryName,
          backupsDirectoryName: settings.backupsDirectoryName,
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

  private findWorkspaceDatabaseFilePath(rootPath: string): string {
    const defaultDatabasePath = path.join(
      rootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    if (existsSync(defaultDatabasePath)) {
      return defaultDatabasePath;
    }

    const childDirectories = readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    for (const directoryName of childDirectories) {
      const candidatePath = path.join(rootPath, directoryName, WORKSPACE_DATABASE_FILE_NAME);
      if (existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    return defaultDatabasePath;
  }

  private refreshContextLayoutPaths(context: WorkspaceContext): void {
    context.databaseFilePath = this.getWorkspaceDatabaseFilePath(context.rootPath, context.settings);
    context.databaseDirectoryPath = this.getWorkspaceDatabaseDirectoryPath(context.rootPath, context.settings);
    context.documentsDirectoryPath = this.getWorkspaceDocumentsDirectoryPath(context.rootPath, context.settings);
    context.templatesDirectoryPath = this.getWorkspaceTemplatesDirectoryPath(context.rootPath, context.settings);
    context.backupsDirectoryPath = this.getWorkspaceBackupsDirectoryPath(context.rootPath, context.settings);
  }
}
