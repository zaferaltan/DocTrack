import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { WorkspaceService } from '@main/services/workspaceService';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME
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

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-workspace-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    const activityLogService = new ActivityLogService();
    const workspaceBackupService = new WorkspaceBackupService(workspaceManager);
    documentService = new DocumentService(
      workspaceManager,
      documentIdGenerator,
      fileStorageService,
      activityLogService
    );
    new DocumentTypeService(workspaceManager, fileStorageService);
    const workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
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
});
