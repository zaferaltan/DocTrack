import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { ActivityLogService } from '@main/services/activityLogService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { TemplateService } from '@main/services/templateService';
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { WorkspaceService } from '@main/services/workspaceService';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME
} from '@shared/workspaceLayout';

vi.mock('electron', () => ({
  default: {
    shell: {
      openPath: vi.fn()
    }
  },
  shell: {
    openPath: vi.fn()
  }
}));

describe('workspace integration', () => {
  let tempRoot: string;
  let workspaceManager: WorkspaceManager;
  let workspaceService: WorkspaceService;
  let documentService: DocumentService;
  let templateService: TemplateService;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-workspace-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    templateService = new TemplateService(fileStorageService, workspaceManager);
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    const activityLogService = new ActivityLogService();
    const workspaceBackupService = new WorkspaceBackupService(workspaceManager);
    documentService = new DocumentService(
      workspaceManager,
      documentIdGenerator,
      fileStorageService,
      templateService,
      activityLogService
    );
    new DocumentTypeService(workspaceManager, fileStorageService);
    const workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      templateService,
      workspaceCatalogService,
      catalogService,
      documentIdGenerator,
      activityLogService,
      workspaceBackupService
    );
  });

  afterEach(() => {
    workspaceManager.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a workspace folder with starter type folders and both workspace settings', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = path.join(tempRoot, 'Quality');
    const databasePath = path.join(
      workspaceRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );

    expect(result.workspace.name).toBe('Quality');
    expect(result.workspace.rootPath).toBe(workspaceRootPath);
    expect(result.summary.settings.storageLayoutPreset).toBe('stable-id');
    expect(result.summary.settings.fileOrganizationMode).toBe('flat');
    expect(result.summary.settings.versionManagementMode).toBe('shared-document-id');
    expect(result.summary.settings.documentIdFormatPreset).toBe('legacy-numeric');
    expect(result.summary.settings.documentIdFormatTemplate).toBe('<docTypePrefix><year><sequence:5>');
    expect(result.summary.settings.visibleDocumentColumns).toEqual(
      DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns
    );
    expect(result.summary.settings.autoMarkPreviousVersionObsolete).toBe(true);
    expect(result.summary.documentTypes.map((item) => item.numberPrefix)).toEqual(['01', '02', '03']);
    expect(result.summary.languages.map((item) => item.code)).toEqual(['DE', 'EN', 'NL']);
    expect(result.summary.statuses).toContain('Obsolete');
    expect(existsSync(databasePath)).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Specification'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Procedure'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Report'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME))).toBe(true);
    expect(result.summary.templates).toEqual([]);
  });

  it('stores the workspace name separately from a custom workspace folder name', () => {
    const result = workspaceService.create({
      name: 'Quality Workspace',
      folderName: 'Quality Files',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = path.join(tempRoot, 'Quality Files');
    const databasePath = path.join(
      workspaceRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const db = new Database(databasePath, { fileMustExist: true });
    const row = db
      .prepare('SELECT Name, RootPath FROM Workspaces WHERE Id = 1')
      .get() as { Name: string; RootPath: string } | undefined;
    db.close();

    expect(result.workspace.name).toBe('Quality Workspace');
    expect(result.workspace.rootPath).toBe(workspaceRootPath);
    expect(row?.Name).toBe('Quality Workspace');
    expect(row?.RootPath).toBe(workspaceRootPath);
  });

  it('copies and removes the workspace company logo through workspace settings updates', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = result.workspace.rootPath;
    const sourceLogoPath = path.join(tempRoot, 'company-logo.png');
    writeFileSync(sourceLogoPath, 'png-data', 'utf8');

    const updated = workspaceService.updateSettings(workspaceRootPath, {
      settings: {
        ...result.summary.settings,
        companyLogoPath: ''
      },
      companyLogoSourceFilePath: sourceLogoPath,
      clearCompanyLogo: false
    });

    expect(updated.summary.settings.companyLogoPath).toBe('Database/branding/company-logo.png');
    expect(
      existsSync(path.join(workspaceRootPath, 'Database', 'branding', 'company-logo.png'))
    ).toBe(true);

    const cleared = workspaceService.updateSettings(workspaceRootPath, {
      settings: {
        ...updated.summary.settings,
        companyLogoPath: ''
      },
      clearCompanyLogo: true
    });

    expect(cleared.summary.settings.companyLogoPath).toBe('');
    expect(
      existsSync(path.join(workspaceRootPath, 'Database', 'branding', 'company-logo.png'))
    ).toBe(false);
  });

  it('supports multiple open workspaces and closing individual tabs by root path', () => {
    const first = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const second = workspaceService.create({
      name: 'Manufacturing',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });

    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual([
      'Quality',
      'Manufacturing'
    ]);

    workspaceService.close(first.workspace.rootPath);
    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual(['Manufacturing']);
    expect(second.workspace.rootPath).toBe(path.join(tempRoot, 'Manufacturing'));
  });

  it('updates workspace metadata when a workspace folder is moved and reopened', () => {
    const originalRootPath = path.join(tempRoot, 'Quality');
    workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    workspaceService.close(originalRootPath);

    const movedRootPath = path.join(tempRoot, 'Archive', 'Quality Renamed');
    mkdirSync(path.dirname(movedRootPath), { recursive: true });
    renameSync(originalRootPath, movedRootPath);

    const reopened = workspaceService.open(movedRootPath);
    const movedDatabasePath = path.join(
      movedRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const db = new Database(movedDatabasePath, { fileMustExist: true });
    const row = db
      .prepare('SELECT Name, FilePath, RootPath, FileOrganizationMode FROM Workspaces WHERE Id = 1')
      .get() as
      | { Name: string; FilePath: string; RootPath: string; FileOrganizationMode: string }
      | undefined;
    db.close();

    expect(reopened.workspace.name).toBe('Quality');
    expect(reopened.workspace.rootPath).toBe(movedRootPath);
    expect(row?.Name).toBe('Quality');
    expect(row?.RootPath).toBe(movedRootPath);
    expect(row?.FilePath).toBe(movedDatabasePath);
    expect(row?.FileOrganizationMode).toBe('flat');
  });

  it('migrates workspace file organization settings and records unmanaged path warnings', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Operating Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version folder'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'procedure.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'procedure working file', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const unmanagedDirectory = path.join(
      workspaceRootPath,
      ...shellDocument.documentFolderPath.split('/'),
      '001',
      'custom'
    );
    mkdirSync(unmanagedDirectory, { recursive: true });

    const updated = workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'friendly-id',
      fileOrganizationMode: 'role-subfolders'
    });
    const reopened = workspaceService.open(workspaceRootPath);

    expect(updated.summary.settings.storageLayoutPreset).toBe('friendly-id');
    expect(updated.summary.settings.fileOrganizationMode).toBe('role-subfolders');
    expect(updated.warnings?.[0]).toContain('unmanaged paths');
    expect(reopened.summary.settings.fileOrganizationMode).toBe('role-subfolders');
  });

  it('persists custom document ID format settings', () => {
    const result = workspaceService.create({
      name: 'Formats',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        documentIdFormatPreset: 'custom',
        documentIdFormatTemplate: '<docType>-<language>-<year>-<sequence:3>'
      },
      includeExampleData: false
    });

    expect(result.summary.settings.documentIdFormatPreset).toBe('custom');
    expect(result.summary.settings.documentIdFormatTemplate).toBe(
      '<docType>-<language>-<year>-<sequence:3>'
    );
  });

  it('creates workspace snapshots and reports integrity issues for missing managed files', () => {
    const created = workspaceService.create({
      name: 'Recoverable',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Recoverable Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'recoverable.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'recoverable working file', 'utf8');
    const detailWithFile = documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const backup = workspaceService.createBackup(workspaceRootPath);
    const listedBackups = workspaceService.listBackups(workspaceRootPath);
    const restorePreview = workspaceService.getRestorePreview(
      workspaceRootPath,
      backup.backup.id,
      tempRoot,
      'Recoverable Restored'
    );

    expect(listedBackups).toHaveLength(1);
    expect(restorePreview.destinationExists).toBe(false);
    expect(backup.backup.documentCount).toBe(1);

    rmSync(
      path.join(workspaceRootPath, ...detailWithFile.files[0]!.filePath.split('/')),
      { force: true }
    );
    const integrity = workspaceService.integrityCheck(workspaceRootPath);
    expect(integrity.issueCount).toBeGreaterThan(0);
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(true);
  });

  it('preserves renamed document root paths when overwriting from a snapshot', () => {
    const created = workspaceService.create({
      name: 'Renamed Docs Recovery',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Internal Audit Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'audit-concept.pdf');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'audit concept pdf', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'concept-pdf',
      sourceFilePaths: [sourceFile]
    });

    const renamed = workspaceService.updateSettings(workspaceRootPath, {
      ...created.summary.settings,
      documentsDirectoryName: '02 Documents'
    });
    const renamedDetail = documentService.getDetail(workspaceRootPath, shellDocument.id);
    const renamedFile = renamedDetail.versions[0]!.files[0]!;
    expect(renamed.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(renamedDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(renamedFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(workspaceRootPath, ...renamedFile.filePath.split('/')))
    ).toBe(true);

    const backup = workspaceService.createBackup(workspaceRootPath);
    const backupDatabasePath = path.join(
      backup.backup.backupPath,
      renamed.summary.settings.databaseDirectoryName,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const backupDb = new Database(backupDatabasePath, { fileMustExist: true });
    backupDb
      .prepare('UPDATE DocumentVersionFiles SET FilePath = REPLACE(FilePath, ?, ?)')
      .run(
        `${renamed.summary.settings.documentsDirectoryName}/`,
        `${DEFAULT_WORKSPACE_SETTINGS.documentsDirectoryName}/`
      );
    backupDb.close();
    writeFileSync(
      path.join(workspaceRootPath, ...renamedFile.filePath.split('/')),
      'changed after backup',
      'utf8'
    );

    workspaceService.updateSettings(workspaceRootPath, {
      ...renamed.summary.settings,
      defaultCompany: 'Changed After Backup'
    });

    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'overwrite-current-database'
    });
    const restoredDetail = documentService.getDetail(workspaceRootPath, shellDocument.id);
    const restoredFile = restoredDetail.versions[0]!.files[0]!;
    const integrity = workspaceService.integrityCheck(workspaceRootPath);

    expect(restored.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(restored.summary.settings.defaultCompany).toBe('');
    expect(restoredDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(restoredFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(workspaceRootPath, ...restoredFile.filePath.split('/')))
    ).toBe(true);
    expect(
      readFileSync(path.join(workspaceRootPath, ...restoredFile.filePath.split('/')), 'utf8')
    ).toBe('audit concept pdf');
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(false);
  });

  it('relinks tracked files automatically when restoring a snapshot into a new workspace', () => {
    const created = workspaceService.create({
      name: 'Relink Restored Files',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Supplier Assessment Report',
      documentTypeId: 3,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'supplier-report.pdf');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'supplier report pdf', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'final-pdf',
      sourceFilePaths: [sourceFile]
    });

    const renamed = workspaceService.updateSettings(workspaceRootPath, {
      ...created.summary.settings,
      documentsDirectoryName: '02 Documents'
    });
    const backup = workspaceService.createBackup(workspaceRootPath);
    const backupDatabasePath = path.join(
      backup.backup.backupPath,
      renamed.summary.settings.databaseDirectoryName,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const backupDb = new Database(backupDatabasePath, { fileMustExist: true });
    backupDb
      .prepare('UPDATE DocumentVersionFiles SET FilePath = REPLACE(FilePath, ?, ?)')
      .run(
        `${renamed.summary.settings.documentsDirectoryName}/`,
        `${DEFAULT_WORKSPACE_SETTINGS.documentsDirectoryName}/`
      );
    backupDb.close();

    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'export-to-new-workspace',
      destinationParentPath: tempRoot,
      destinationFolderName: 'Relink Restored Files Copy'
    });
    const restoredDetail = documentService.getDetail(restored.workspace.rootPath, shellDocument.id);
    const restoredFile = restoredDetail.versions[0]!.files[0]!;
    const integrity = workspaceService.integrityCheck(restored.workspace.rootPath);

    expect(restored.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(restoredDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(restoredFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(restored.workspace.rootPath, ...restoredFile.filePath.split('/')))
    ).toBe(true);
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(false);
  });

  it('preserves templates across backup and restore', () => {
    const created = workspaceService.create({
      name: 'Template Recovery',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const sourceFile = path.join(tempRoot, 'incoming', 'template-procedure.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'template procedure', 'utf8');

    const template = templateService.create(workspaceRootPath, {
      name: 'Procedure Starter'
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [sourceFile]
    });

    const backup = workspaceService.createBackup(workspaceRootPath);
    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'export-to-new-workspace',
      destinationParentPath: tempRoot,
      destinationFolderName: 'Template Recovery Restored'
    });

    expect(restored.summary.templates).toHaveLength(1);
    expect(restored.summary.templates[0]?.name).toBe('Procedure Starter');
    expect(restored.summary.templates[0]?.files[0]?.fileName).toBe('template-procedure.docx');
    expect(
      existsSync(
        path.join(
          restored.workspace.rootPath,
          'Templates',
          'Procedure Starter',
          'template-procedure.docx'
        )
      )
    ).toBe(true);
  });
});
