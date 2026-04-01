import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { nowIso } from '@main/utils/date';
import type {
  CreateBackupResult,
  IntegrityCheckIssue,
  IntegrityCheckResult,
  OpenWorkspaceResult,
  RestoreBackupPreview,
  WorkspaceBackupSummary
} from '@shared/types';
import {
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME
} from '@shared/workspaceLayout';

const BACKUPS_DIRECTORY_NAME = 'Backups';

interface BackupManifest extends WorkspaceBackupSummary {
  databaseDirectoryName: string;
  documentsDirectoryName: string;
  templatesDirectoryName?: string;
}

const sanitizeBackupSegment = (value: string): string =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const getBackupsDirectoryPath = (rootPath: string): string =>
  path.join(rootPath, BACKUPS_DIRECTORY_NAME);

const getBackupDirectoryPath = (rootPath: string, backupId: string): string =>
  path.join(getBackupsDirectoryPath(rootPath), backupId);

const getManifestPath = (backupDirectoryPath: string): string =>
  path.join(backupDirectoryPath, 'manifest.json');

const readBackupManifest = (manifestPath: string): BackupManifest => {
  const raw = readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as BackupManifest;
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

export class WorkspaceBackupService {
  constructor(private readonly workspaceManager: WorkspaceManager) {}

  list(rootPath: string): WorkspaceBackupSummary[] {
    const backupsDirectoryPath = getBackupsDirectoryPath(rootPath);
    if (!existsSync(backupsDirectoryPath)) {
      return [];
    }

    return readdirSync(backupsDirectoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => getManifestPath(path.join(backupsDirectoryPath, entry.name)))
      .filter((manifestPath) => existsSync(manifestPath))
      .map((manifestPath) => readBackupManifest(manifestPath))
      .sort((left, right) => right.createdDate.localeCompare(left.createdDate));
  }

  createBackup(rootPath: string, reason: 'manual' | 'safety' = 'manual'): CreateBackupResult {
    const context = this.workspaceManager.getContext(rootPath);
    const createdDate = nowIso();
    const backupId = `${createdDate.replace(/[:.]/g, '').replace(/-/g, '')}-${reason}`;
    const backupDirectoryPath = getBackupDirectoryPath(context.rootPath, backupId);
    const databaseDestinationPath = path.join(backupDirectoryPath, WORKSPACE_DATABASE_DIRECTORY_NAME);
    const documentsDestinationPath = path.join(backupDirectoryPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME);
    const templatesDestinationPath = path.join(backupDirectoryPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME);
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
      manifestPath: getManifestPath(backupDirectoryPath),
      workspaceName: context.workspace.name,
      documentCount,
      versionCount,
      fileCount,
      sizeBytes: getDirectorySize(backupDirectoryPath),
      reason,
      databaseDirectoryName: WORKSPACE_DATABASE_DIRECTORY_NAME,
      documentsDirectoryName: WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
      templatesDirectoryName: WORKSPACE_TEMPLATES_DIRECTORY_NAME
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
    const databaseSourcePath = path.join(backup.backupPath, backup.databaseDirectoryName);
    const documentsSourcePath = path.join(backup.backupPath, backup.documentsDirectoryName);
    const templatesSourcePath = backup.templatesDirectoryName
      ? path.join(backup.backupPath, backup.templatesDirectoryName)
      : null;

    ensureDirectory(preview.destinationRootPath);
    cpSync(databaseSourcePath, path.join(preview.destinationRootPath, WORKSPACE_DATABASE_DIRECTORY_NAME), {
      recursive: true
    });
    cpSync(documentsSourcePath, path.join(preview.destinationRootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME), {
      recursive: true
    });
    if (templatesSourcePath && existsSync(templatesSourcePath)) {
      cpSync(templatesSourcePath, path.join(preview.destinationRootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME), {
        recursive: true
      });
    }

    const restoredDatabasePath = path.join(
      preview.destinationRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    if (!existsSync(restoredDatabasePath)) {
      throw new Error('The selected backup is missing the workspace database.');
    }

    return preview.destinationRootPath;
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
    const backupDirectoryPath = getBackupDirectoryPath(rootPath, backupId);
    const manifestPath = getManifestPath(backupDirectoryPath);
    if (!existsSync(manifestPath)) {
      throw new Error('The selected backup could not be found.');
    }

    return readBackupManifest(manifestPath);
  }
}
