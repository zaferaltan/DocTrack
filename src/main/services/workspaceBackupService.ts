import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { nowIso } from '@main/utils/date';
import type {
  CreateBackupResult,
  IntegrityCheckIssue,
  IntegrityCheckResult,
  RestoreBackupDiffField,
  RestoreBackupDiffItem,
  RestoreBackupDiffResult,
  RestoreBackupDiffSection,
  RestoreBackupPreview,
  WorkspaceBackupSummary
} from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_FILE_NAME,
  normalizeWorkspaceRootDirectoryNames,
  normalizeWorkspaceActivityLogMaxRows,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

interface BackupManifest extends WorkspaceBackupSummary {
  databaseDirectoryName?: string;
  documentsDirectoryName?: string;
  templatesDirectoryName?: string;
  backupsDirectoryName?: string;
}

type ComparableRow = {
  id: string;
  label: string;
  fields: Record<string, string | null>;
};

const readBackupManifest = (manifestPath: string): BackupManifest => {
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as BackupManifest;
  const normalizedRootDirectories = normalizeWorkspaceRootDirectoryNames({
    databaseDirectoryName: manifest.databaseDirectoryName,
    documentsDirectoryName: manifest.documentsDirectoryName,
    templatesDirectoryName: manifest.templatesDirectoryName,
    backupsDirectoryName: manifest.backupsDirectoryName
  });

  return {
    ...manifest,
    ...normalizedRootDirectories
  };
};

const getDirectorySize = (directoryPath: string): number => {
  if (!existsSync(directoryPath)) {
    return 0;
  }

  const stats = statSync(directoryPath);
  if (stats.isFile()) {
    return stats.size;
  }

  return readdirSync(directoryPath).reduce(
    (total, name) => total + getDirectorySize(path.join(directoryPath, name)),
    0
  );
};

const ensureDirectory = (directoryPath: string): void => {
  mkdirSync(directoryPath, { recursive: true });
};

const formatFieldValue = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildDiffFields = (
  liveFields: Record<string, string | null>,
  backupFields: Record<string, string | null>
): RestoreBackupDiffField[] =>
  Object.keys({ ...liveFields, ...backupFields })
    .sort((left, right) => left.localeCompare(right))
    .map((label) => ({
      label,
      liveValue: liveFields[label] ?? null,
      backupValue: backupFields[label] ?? null
    }))
    .filter((field) => field.liveValue !== field.backupValue);

const buildAddedOrRemovedFields = (
  fields: Record<string, string | null>,
  changeType: 'added' | 'removed'
): RestoreBackupDiffField[] =>
  Object.keys(fields)
    .sort((left, right) => left.localeCompare(right))
    .map((label) => ({
      label,
      liveValue: changeType === 'removed' ? fields[label] ?? null : null,
      backupValue: changeType === 'added' ? fields[label] ?? null : null
    }))
    .filter((field) => field.liveValue !== field.backupValue);

const compareRows = (
  liveRows: ComparableRow[],
  backupRows: ComparableRow[]
): Pick<RestoreBackupDiffSection, 'addedCount' | 'removedCount' | 'changedCount' | 'items'> => {
  const liveById = new Map(liveRows.map((row) => [row.id, row]));
  const backupById = new Map(backupRows.map((row) => [row.id, row]));
  const ids = new Set([...liveById.keys(), ...backupById.keys()]);
  const items: RestoreBackupDiffItem[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;

  for (const id of [...ids].sort((left, right) => left.localeCompare(right))) {
    const liveRow = liveById.get(id);
    const backupRow = backupById.get(id);

    if (!liveRow && backupRow) {
      addedCount += 1;
      items.push({
        id,
        label: backupRow.label,
        changeType: 'added',
        fields: buildAddedOrRemovedFields(backupRow.fields, 'added')
      });
      continue;
    }

    if (liveRow && !backupRow) {
      removedCount += 1;
      items.push({
        id,
        label: liveRow.label,
        changeType: 'removed',
        fields: buildAddedOrRemovedFields(liveRow.fields, 'removed')
      });
      continue;
    }

    if (!liveRow || !backupRow) {
      continue;
    }

    const changedFields = buildDiffFields(liveRow.fields, backupRow.fields);
    if (changedFields.length === 0) {
      continue;
    }

    changedCount += 1;
    items.push({
      id,
      label: backupRow.label,
      changeType: 'changed',
      fields: changedFields
    });
  }

  return {
    addedCount,
    removedCount,
    changedCount,
    items
  };
};

export class WorkspaceBackupService {
  constructor(private readonly workspaceManager: WorkspaceManager) {}

  list(rootPath: string): WorkspaceBackupSummary[] {
    const context = this.workspaceManager.getContext(rootPath);
    const backupsDirectoryPath = path.join(context.rootPath, context.settings.backupsDirectoryName);
    if (!existsSync(backupsDirectoryPath)) {
      return [];
    }

    return readdirSync(backupsDirectoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(backupsDirectoryPath, entry.name, 'manifest.json'))
      .filter((manifestPath) => existsSync(manifestPath))
      .map((manifestPath) => readBackupManifest(manifestPath))
      .sort((left, right) => right.createdDate.localeCompare(left.createdDate));
  }

  createBackup(rootPath: string, reason: 'manual' | 'safety' = 'manual'): CreateBackupResult {
    const context = this.workspaceManager.getContext(rootPath);
    const createdDate = nowIso();
    const backupId = `${createdDate.replace(/[:.]/g, '').replace(/-/g, '')}-${reason}`;
    const backupDirectoryPath = path.join(context.backupsDirectoryPath, backupId);
    const databaseDestinationPath = path.join(backupDirectoryPath, context.settings.databaseDirectoryName);
    const documentsDestinationPath = path.join(backupDirectoryPath, context.settings.documentsDirectoryName);
    const templatesDestinationPath = path.join(backupDirectoryPath, context.settings.templatesDirectoryName);
    const documentCount =
      ((context.db.prepare('SELECT COUNT(*) AS total FROM Documents').get() as { total: number } | undefined)
        ?.total ?? 0);
    const versionCount =
      ((context.db.prepare('SELECT COUNT(*) AS total FROM DocumentVersions').get() as { total: number } | undefined)
        ?.total ?? 0);
    const fileCount =
      ((context.db.prepare('SELECT COUNT(*) AS total FROM DocumentVersionFiles').get() as { total: number } | undefined)
        ?.total ?? 0);

    ensureDirectory(backupDirectoryPath);
    cpSync(context.databaseDirectoryPath, databaseDestinationPath, { recursive: true });
    cpSync(context.documentsDirectoryPath, documentsDestinationPath, { recursive: true });
    if (existsSync(context.templatesDirectoryPath)) {
      cpSync(context.templatesDirectoryPath, templatesDestinationPath, { recursive: true });
    }

    const manifest: BackupManifest = {
      id: backupId,
      label: reason === 'manual' ? 'Manual Snapshot' : 'Safety Snapshot',
      createdDate,
      backupPath: backupDirectoryPath,
      manifestPath: path.join(backupDirectoryPath, 'manifest.json'),
      workspaceName: context.workspace.name,
      documentCount,
      versionCount,
      fileCount,
      sizeBytes: getDirectorySize(backupDirectoryPath),
      reason,
      databaseDirectoryName: context.settings.databaseDirectoryName,
      documentsDirectoryName: context.settings.documentsDirectoryName,
      templatesDirectoryName: context.settings.templatesDirectoryName,
      backupsDirectoryName: context.settings.backupsDirectoryName
    };

    writeFileSync(manifest.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    manifest.sizeBytes = getDirectorySize(backupDirectoryPath);
    writeFileSync(manifest.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return {
      backup: manifest
    };
  }

  getRestorePreview(
    rootPath: string,
    backupId: string,
    destinationParentPath: string,
    destinationFolderName?: string
  ): RestoreBackupPreview {
    const backup = this.getBackup(rootPath, backupId);
    const suggestedWorkspaceName = destinationFolderName?.trim() || `${backup.workspaceName} Restored`;
    const destinationRootPath = path.join(destinationParentPath, suggestedWorkspaceName);

    return {
      backup,
      suggestedWorkspaceName,
      destinationRootPath,
      destinationExists: existsSync(destinationRootPath)
    };
  }

  getRestoreDiff(rootPath: string, backupId: string): RestoreBackupDiffResult {
    const context = this.workspaceManager.getContext(rootPath);
    const backup = this.getBackup(rootPath, backupId);
    const backupDatabaseFilePath = this.getBackupDatabaseFilePath(rootPath, backupId);
    const backupDb = new Database(backupDatabaseFilePath, { fileMustExist: true });

    try {
      const sections: RestoreBackupDiffSection[] = [
        this.buildWorkspaceSettingsSection(context.settings, this.readWorkspaceSettings(backupDb), backup),
        this.buildEntitySection('users', 'Users', this.listWorkspaceUsers(context.db), this.listWorkspaceUsers(backupDb)),
        this.buildEntitySection(
          'documentTypes',
          'Document Types',
          this.listDocumentTypes(context.db),
          this.listDocumentTypes(backupDb)
        ),
        this.buildEntitySection('projects', 'Projects', this.listProjects(context.db), this.listProjects(backupDb)),
        this.buildEntitySection(
          'confidentialityClasses',
          'Confidentiality Classes',
          this.listConfidentialityClasses(context.db),
          this.listConfidentialityClasses(backupDb)
        ),
        this.buildEntitySection('languages', 'Languages', this.listLanguages(context.db), this.listLanguages(backupDb)),
        this.buildEntitySection('documents', 'Documents', this.listDocuments(context.db), this.listDocuments(backupDb)),
        this.buildEntitySection('versions', 'Versions', this.listVersions(context.db), this.listVersions(backupDb)),
        this.buildEntitySection(
          'trackedFiles',
          'Tracked Files',
          this.listTrackedFiles(context.db),
          this.listTrackedFiles(backupDb)
        )
      ];

      return {
        backup,
        generatedDate: nowIso(),
        sections,
        totals: sections.reduce(
          (totals, section) => ({
            addedCount: totals.addedCount + section.addedCount,
            removedCount: totals.removedCount + section.removedCount,
            changedCount: totals.changedCount + section.changedCount
          }),
          {
            addedCount: 0,
            removedCount: 0,
            changedCount: 0
          }
        )
      };
    } finally {
      backupDb.close();
    }
  }

  restoreBackup(
    rootPath: string,
    backupId: string,
    destinationParentPath: string,
    destinationFolderName?: string
  ): string {
    this.createBackup(rootPath, 'safety');
    const preview = this.getRestorePreview(
      rootPath,
      backupId,
      destinationParentPath,
      destinationFolderName
    );

    if (preview.destinationExists) {
      throw new Error('A folder already exists at the selected restore destination.');
    }

    const backup = this.getBackup(rootPath, backupId);
    const databaseSourcePath = path.join(backup.backupPath, backup.databaseDirectoryName!);
    const documentsSourcePath = path.join(backup.backupPath, backup.documentsDirectoryName!);
    const templatesSourcePath = backup.templatesDirectoryName
      ? path.join(backup.backupPath, backup.templatesDirectoryName)
      : null;

    ensureDirectory(preview.destinationRootPath);
    cpSync(databaseSourcePath, path.join(preview.destinationRootPath, backup.databaseDirectoryName!), {
      recursive: true
    });
    cpSync(documentsSourcePath, path.join(preview.destinationRootPath, backup.documentsDirectoryName!), {
      recursive: true
    });
    if (templatesSourcePath && existsSync(templatesSourcePath)) {
      cpSync(templatesSourcePath, path.join(preview.destinationRootPath, backup.templatesDirectoryName!), {
        recursive: true
      });
    }

    const restoredDatabasePath = path.join(
      preview.destinationRootPath,
      backup.databaseDirectoryName!,
      WORKSPACE_DATABASE_FILE_NAME
    );
    if (!existsSync(restoredDatabasePath)) {
      throw new Error('The selected backup is missing the workspace database.');
    }

    return preview.destinationRootPath;
  }

  overwriteCurrentWorkspace(
    rootPath: string,
    backupId: string,
    currentSettings: Pick<
      WorkspaceSettings,
      'databaseDirectoryName' | 'documentsDirectoryName' | 'templatesDirectoryName' | 'backupsDirectoryName'
    >
  ): void {
    const backupDirectoryPath = path.join(rootPath, currentSettings.backupsDirectoryName, backupId);
    const manifestPath = path.join(backupDirectoryPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('The selected backup could not be found.');
    }

    const backup = readBackupManifest(manifestPath);
    const databaseSourcePath = path.join(backupDirectoryPath, backup.databaseDirectoryName!);
    const documentsSourcePath = path.join(backupDirectoryPath, backup.documentsDirectoryName!);
    const templatesSourcePath = backup.templatesDirectoryName
      ? path.join(backupDirectoryPath, backup.templatesDirectoryName)
      : null;
    const restoredDatabaseFilePath = path.join(databaseSourcePath, WORKSPACE_DATABASE_FILE_NAME);

    if (!existsSync(restoredDatabaseFilePath)) {
      throw new Error('The selected backup is missing the workspace database.');
    }

    const stagingRootPath = mkdtempSync(path.join(os.tmpdir(), 'doctrack-restore-'));

    try {
      const stagedDatabasePath = path.join(stagingRootPath, backup.databaseDirectoryName!);
      const stagedDocumentsPath = path.join(stagingRootPath, backup.documentsDirectoryName!);
      const stagedTemplatesPath = backup.templatesDirectoryName
        ? path.join(stagingRootPath, backup.templatesDirectoryName)
        : null;

      cpSync(databaseSourcePath, stagedDatabasePath, { recursive: true });
      cpSync(documentsSourcePath, stagedDocumentsPath, { recursive: true });
      if (templatesSourcePath && stagedTemplatesPath && existsSync(templatesSourcePath)) {
        cpSync(templatesSourcePath, stagedTemplatesPath, { recursive: true });
      }

      const targetDirectories = new Set<string>([
        path.join(rootPath, currentSettings.databaseDirectoryName),
        path.join(rootPath, currentSettings.documentsDirectoryName),
        path.join(rootPath, currentSettings.templatesDirectoryName),
        path.join(rootPath, backup.databaseDirectoryName!),
        path.join(rootPath, backup.documentsDirectoryName!),
        path.join(rootPath, backup.templatesDirectoryName!)
      ]);

      for (const targetDirectoryPath of targetDirectories) {
        if (existsSync(targetDirectoryPath)) {
          rmSync(targetDirectoryPath, { recursive: true, force: true });
        }
      }

      cpSync(stagedDatabasePath, path.join(rootPath, backup.databaseDirectoryName!), { recursive: true });
      cpSync(stagedDocumentsPath, path.join(rootPath, backup.documentsDirectoryName!), { recursive: true });
      if (stagedTemplatesPath && existsSync(stagedTemplatesPath)) {
        cpSync(stagedTemplatesPath, path.join(rootPath, backup.templatesDirectoryName!), { recursive: true });
      }
    } finally {
      rmSync(stagingRootPath, { recursive: true, force: true });
    }
  }

  overwriteCurrentDatabase(backupDatabaseFilePath: string, destinationDatabaseFilePath: string): void {
    const backupDatabaseDirectoryPath = path.dirname(backupDatabaseFilePath);
    const destinationDatabaseDirectoryPath = path.dirname(destinationDatabaseFilePath);

    if (!existsSync(backupDatabaseFilePath)) {
      throw new Error('The selected backup is missing the workspace database.');
    }

    mkdirSync(destinationDatabaseDirectoryPath, { recursive: true });
    for (const entry of readdirSync(backupDatabaseDirectoryPath, { withFileTypes: true })) {
      cpSync(path.join(backupDatabaseDirectoryPath, entry.name), path.join(destinationDatabaseDirectoryPath, entry.name), {
        recursive: entry.isDirectory(),
        force: true
      });
    }
  }

  getBackupDatabaseFilePath(rootPath: string, backupId: string): string {
    const backup = this.getBackup(rootPath, backupId);
    return path.join(backup.backupPath, backup.databaseDirectoryName!, WORKSPACE_DATABASE_FILE_NAME);
  }

  integrityCheck(rootPath: string): IntegrityCheckResult {
    const context = this.workspaceManager.getContext(rootPath);
    const issues: IntegrityCheckIssue[] = [];

    if (!existsSync(context.databaseFilePath)) {
      issues.push({
        code: 'missing-database',
        severity: 'error',
        path: context.databaseFilePath,
        message: 'The workspace database file is missing.'
      });
    }

    const documentRows = context.db
      .prepare('SELECT Id, DocumentFolderPath FROM Documents ORDER BY Id ASC')
      .all() as Array<{ Id: number; DocumentFolderPath: string }>;
    const versionRows = context.db
      .prepare('SELECT Id, DocumentId, VersionLabel FROM DocumentVersions ORDER BY Id ASC')
      .all() as Array<{ Id: number; DocumentId: number; VersionLabel: string }>;
    const fileRows = context.db
      .prepare(
        `
          SELECT
            f.DocumentVersionId,
            f.FilePath,
            v.DocumentId
          FROM DocumentVersionFiles f
          INNER JOIN DocumentVersions v ON v.Id = f.DocumentVersionId
          ORDER BY f.Id ASC
        `
      )
      .all() as Array<{ DocumentVersionId: number; FilePath: string; DocumentId: number }>;
    const documentFolderById = new Map(documentRows.map((row) => [row.Id, row.DocumentFolderPath]));

    for (const documentRow of documentRows) {
      const absolutePath = path.resolve(context.rootPath, documentRow.DocumentFolderPath);
      if (!existsSync(absolutePath)) {
        issues.push({
          code: 'missing-document-folder',
          severity: 'error',
          path: documentRow.DocumentFolderPath,
          message: 'A managed document folder is missing from disk.',
          documentRecordId: documentRow.Id
        });
      }
    }

    for (const versionRow of versionRows) {
      const documentFolderPath = documentFolderById.get(versionRow.DocumentId);
      if (!documentFolderPath) {
        continue;
      }

      const versionFolderPath = path.join(context.rootPath, documentFolderPath, versionRow.VersionLabel);
      try {
        if (!existsSync(versionFolderPath)) {
          issues.push({
            code: 'missing-version-folder',
            severity: 'warning',
            path: path.join(documentFolderPath, versionRow.VersionLabel),
            message: 'A version folder is missing from disk.',
            documentRecordId: versionRow.DocumentId,
            documentVersionId: versionRow.Id
          });
        } else {
          readdirSync(versionFolderPath);
        }
      } catch {
        issues.push({
          code: 'unreadable-path',
          severity: 'warning',
          path: path.join(documentFolderPath, versionRow.VersionLabel),
          message: 'A version folder exists but could not be read.',
          documentRecordId: versionRow.DocumentId,
          documentVersionId: versionRow.Id
        });
      }
    }

    for (const fileRow of fileRows) {
      const absolutePath = path.resolve(context.rootPath, fileRow.FilePath);
      if (!existsSync(absolutePath)) {
        issues.push({
          code: 'missing-managed-file',
          severity: 'error',
          path: fileRow.FilePath,
          message: 'A tracked managed file is missing from disk.',
          documentRecordId: fileRow.DocumentId,
          documentVersionId: fileRow.DocumentVersionId
        });
      }
    }

    return {
      checkedDate: nowIso(),
      issueCount: issues.length,
      issues
    };
  }

  private getBackup(rootPath: string, backupId: string): BackupManifest {
    const context = this.workspaceManager.getContext(rootPath);
    const backupDirectoryPath = path.join(context.backupsDirectoryPath, backupId);
    const manifestPath = path.join(backupDirectoryPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('The selected backup could not be found.');
    }

    return readBackupManifest(manifestPath);
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
    const hasUserSystemEnabledColumn = workspaceColumns.has('UserSystemEnabled');
    const row = db
      .prepare(
        `
          SELECT
            ${hasUserSystemEnabledColumn ? 'UserSystemEnabled,' : `${DEFAULT_WORKSPACE_SETTINGS.userSystemEnabled ? 1 : 0} AS UserSystemEnabled,`}
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
          UserSystemEnabled?: number;
          StorageLayoutPreset: WorkspaceSettings['storageLayoutPreset'];
          FileOrganizationMode: WorkspaceSettings['fileOrganizationMode'];
          VersionManagementMode: WorkspaceSettings['versionManagementMode'];
          DocumentIdFormatPreset: WorkspaceSettings['documentIdFormatPreset'];
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
          ActivityLogEnabled: number;
          ActivityLogMaxRows: number;
        }
      | undefined;

    if (!row) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      ...DEFAULT_WORKSPACE_SETTINGS,
      userSystemEnabled:
        typeof row.UserSystemEnabled === 'number'
          ? Boolean(row.UserSystemEnabled)
          : DEFAULT_WORKSPACE_SETTINGS.userSystemEnabled,
      storageLayoutPreset: row.StorageLayoutPreset ?? DEFAULT_WORKSPACE_SETTINGS.storageLayoutPreset,
      fileOrganizationMode: row.FileOrganizationMode ?? DEFAULT_WORKSPACE_SETTINGS.fileOrganizationMode,
      versionManagementMode: row.VersionManagementMode ?? DEFAULT_WORKSPACE_SETTINGS.versionManagementMode,
      documentIdFormatPreset: row.DocumentIdFormatPreset ?? DEFAULT_WORKSPACE_SETTINGS.documentIdFormatPreset,
      documentIdFormatTemplate: row.DocumentIdFormatTemplate ?? DEFAULT_WORKSPACE_SETTINGS.documentIdFormatTemplate,
      ...normalizeWorkspaceRootDirectoryNames({
        databaseDirectoryName: row.DatabaseDirectoryName,
        documentsDirectoryName: row.DocumentsDirectoryName,
        templatesDirectoryName: row.TemplatesDirectoryName,
        backupsDirectoryName: row.BackupsDirectoryName
      }),
      defaultCompany: row.DefaultCompany ?? '',
      defaultDepartment: row.DefaultDepartment ?? '',
      companyLogoPath: row.CompanyLogoPath ?? '',
      autoMarkPreviousVersionObsolete: Boolean(row.AutoMarkPreviousVersionObsolete),
      activityLogEnabled: Boolean(row.ActivityLogEnabled),
      activityLogMaxRows: normalizeWorkspaceActivityLogMaxRows(row.ActivityLogMaxRows)
    };
  }

  private buildWorkspaceSettingsSection(
    liveSettings: WorkspaceSettings,
    backupSettings: WorkspaceSettings,
    backup: WorkspaceBackupSummary
  ): RestoreBackupDiffSection {
    const diff = compareRows(
      [
        {
          id: 'workspace-settings',
          label: backup.workspaceName,
          fields: this.buildWorkspaceSettingsFields(liveSettings)
        }
      ],
      [
        {
          id: 'workspace-settings',
          label: backup.workspaceName,
          fields: this.buildWorkspaceSettingsFields(backupSettings)
        }
      ]
    );

    return {
      id: 'workspaceSettings',
      label: 'Workspace Settings',
      ...diff
    };
  }

  private buildWorkspaceSettingsFields(settings: WorkspaceSettings): Record<string, string | null> {
    return {
      'User System Enabled': formatFieldValue(settings.userSystemEnabled),
      'Storage Layout': formatFieldValue(settings.storageLayoutPreset),
      'File Organization': formatFieldValue(settings.fileOrganizationMode),
      'Version Management': formatFieldValue(settings.versionManagementMode),
      'Document ID Format': formatFieldValue(settings.documentIdFormatPreset),
      'Document ID Template': formatFieldValue(settings.documentIdFormatTemplate),
      'Database Folder': formatFieldValue(settings.databaseDirectoryName),
      'Documents Folder': formatFieldValue(settings.documentsDirectoryName),
      'Templates Folder': formatFieldValue(settings.templatesDirectoryName),
      'Backups Folder': formatFieldValue(settings.backupsDirectoryName),
      'Default Company': formatFieldValue(settings.defaultCompany),
      'Default Department': formatFieldValue(settings.defaultDepartment),
      'Company Logo': formatFieldValue(settings.companyLogoPath),
      'Auto Mark Previous Version Obsolete': formatFieldValue(settings.autoMarkPreviousVersionObsolete),
      'Activity Log Enabled': formatFieldValue(settings.activityLogEnabled),
      'Activity Log Max Rows': formatFieldValue(settings.activityLogMaxRows)
    };
  }

  private buildEntitySection(
    id: RestoreBackupDiffSection['id'],
    label: string,
    liveRows: ComparableRow[],
    backupRows: ComparableRow[]
  ): RestoreBackupDiffSection {
    return {
      id,
      label,
      ...compareRows(liveRows, backupRows)
    };
  }

  private listDocumentTypes(db: Database.Database): ComparableRow[] {
    return (
      db.prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY Id ASC').all() as Array<{
        Id: number;
        Name: string;
        NumberPrefix: string;
      }>
    ).map((row) => ({
      id: `document-type-${row.Id}`,
      label: row.Name,
      fields: {
        Name: formatFieldValue(row.Name),
        Prefix: formatFieldValue(row.NumberPrefix)
      }
    }));
  }

  private listWorkspaceUsers(db: Database.Database): ComparableRow[] {
    return (
      db.prepare(
        `
          SELECT
            Id,
            Username,
            DisplayName,
            Role,
            SignInEnabled,
            Archived,
            LastSignedInDate
          FROM WorkspaceUsers
          ORDER BY Id ASC
        `
      ).all() as Array<{
        Id: number;
        Username: string;
        DisplayName: string;
        Role: string;
        SignInEnabled: number;
        Archived: number;
        LastSignedInDate: string | null;
      }>
    ).map((row) => ({
      id: `workspace-user-${row.Id}`,
      label: row.DisplayName,
      fields: {
        Username: formatFieldValue(row.Username),
        'Display Name': formatFieldValue(row.DisplayName),
        Role: formatFieldValue(row.Role),
        'Sign-In Enabled': formatFieldValue(Boolean(row.SignInEnabled)),
        Archived: formatFieldValue(Boolean(row.Archived)),
        'Last Signed In': formatFieldValue(row.LastSignedInDate)
      }
    }));
  }

  private listProjects(db: Database.Database): ComparableRow[] {
    return (
      db.prepare('SELECT Id, Name FROM Projects ORDER BY Id ASC').all() as Array<{
        Id: number;
        Name: string;
      }>
    ).map((row) => ({
      id: `project-${row.Id}`,
      label: row.Name,
      fields: {
        Name: formatFieldValue(row.Name)
      }
    }));
  }

  private listConfidentialityClasses(db: Database.Database): ComparableRow[] {
    return (
      db.prepare('SELECT Id, Name FROM ConfidentialityClasses ORDER BY Id ASC').all() as Array<{
        Id: number;
        Name: string;
      }>
    ).map((row) => ({
      id: `confidentiality-${row.Id}`,
      label: row.Name,
      fields: {
        Name: formatFieldValue(row.Name)
      }
    }));
  }

  private listLanguages(db: Database.Database): ComparableRow[] {
    return (
      db.prepare('SELECT Id, Code FROM Languages ORDER BY Id ASC').all() as Array<{
        Id: number;
        Code: string;
      }>
    ).map((row) => ({
      id: `language-${row.Id}`,
      label: row.Code,
      fields: {
        Code: formatFieldValue(row.Code)
      }
    }));
  }

  private listDocuments(db: Database.Database): ComparableRow[] {
    return (
      db.prepare(
        `
          SELECT
            d.Id,
            d.DocumentID,
            d.Title,
            d.VersionScheme,
            d.DocumentFolderPath,
            d.Author,
            d.StartDate,
            d.LanguageId,
            d.ConfidentialityClassId,
            d.ProjectId,
            d.Company,
            d.Department,
            d.RevisionIntervalMonths,
            dt.Name AS TypeName
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          ORDER BY d.Id ASC
        `
      ).all() as Array<{
        Id: number;
        DocumentID: string;
        Title: string;
        VersionScheme: string;
        DocumentFolderPath: string;
        Author: string;
        StartDate: string | null;
        LanguageId: number | null;
        ConfidentialityClassId: number | null;
        ProjectId: number | null;
        Company: string;
        Department: string;
        RevisionIntervalMonths: number | null;
        TypeName: string;
      }>
    ).map((row) => ({
      id: `document-${row.Id}`,
      label: `${row.DocumentID} - ${row.Title}`,
      fields: {
        'Document ID': formatFieldValue(row.DocumentID),
        Title: formatFieldValue(row.Title),
        'Document Type': formatFieldValue(row.TypeName),
        'Version Scheme': formatFieldValue(row.VersionScheme),
        'Folder Path': formatFieldValue(row.DocumentFolderPath),
        Author: formatFieldValue(row.Author),
        'Start Date': formatFieldValue(row.StartDate),
        Language: formatFieldValue(row.LanguageId),
        'Confidentiality Class': formatFieldValue(row.ConfidentialityClassId),
        Project: formatFieldValue(row.ProjectId),
        Company: formatFieldValue(row.Company),
        Department: formatFieldValue(row.Department),
        'Revision Interval Months': formatFieldValue(row.RevisionIntervalMonths)
      }
    }));
  }

  private listVersions(db: Database.Database): ComparableRow[] {
    return (
      db.prepare(
        `
          SELECT
            v.Id,
            v.DocumentId,
            d.DocumentID,
            d.Title,
            v.VersionDocumentID,
            v.SequenceNumber,
            v.VersionLabel,
            v.Status,
            v.ReleasedDate,
            v.ReviewedBy,
            v.ApprovedBy,
            v.Notes
          FROM DocumentVersions v
          INNER JOIN Documents d ON d.Id = v.DocumentId
          ORDER BY v.Id ASC
        `
      ).all() as Array<{
        Id: number;
        DocumentId: number;
        DocumentID: string;
        Title: string;
        VersionDocumentID: string | null;
        SequenceNumber: number;
        VersionLabel: string;
        Status: string;
        ReleasedDate: string | null;
        ReviewedBy: string;
        ApprovedBy: string;
        Notes: string;
      }>
    ).map((row) => ({
      id: `version-${row.Id}`,
      label: `${row.DocumentID} - Version ${row.VersionLabel}`,
      fields: {
        'Document Record': formatFieldValue(row.DocumentId),
        'Document ID': formatFieldValue(row.DocumentID),
        'Document Title': formatFieldValue(row.Title),
        'Version Document ID': formatFieldValue(row.VersionDocumentID),
        'Sequence Number': formatFieldValue(row.SequenceNumber),
        'Version Label': formatFieldValue(row.VersionLabel),
        Status: formatFieldValue(row.Status),
        'Released Date': formatFieldValue(row.ReleasedDate),
        'Reviewed By': formatFieldValue(row.ReviewedBy),
        'Approved By': formatFieldValue(row.ApprovedBy),
        'Revision Description': formatFieldValue(row.Notes)
      }
    }));
  }

  private listTrackedFiles(db: Database.Database): ComparableRow[] {
    return (
      db.prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize
          FROM DocumentVersionFiles
          ORDER BY Id ASC
        `
      ).all() as Array<{
        Id: number;
        DocumentVersionId: number;
        Role: string;
        FileName: string;
        FilePath: string;
        ContentHash: string;
        FileSize: number;
      }>
    ).map((row) => ({
      id: `tracked-file-${row.Id}`,
      label: row.FilePath,
      fields: {
        'Version Record': formatFieldValue(row.DocumentVersionId),
        Role: formatFieldValue(row.Role),
        'File Name': formatFieldValue(row.FileName),
        'File Path': formatFieldValue(row.FilePath),
        'Content Hash': formatFieldValue(row.ContentHash),
        'File Size': formatFieldValue(row.FileSize)
      }
    }));
  }
}
