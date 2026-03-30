import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { WorkspaceService } from '@main/services/workspaceService';
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/workspaceLayout';

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

describe('document workflow integration', () => {
  let tempRoot: string;
  let workspaceManager: WorkspaceManager;
  let workspaceService: WorkspaceService;
  let documentService: DocumentService;
  let documentTypeService: DocumentTypeService;
  let workspaceCatalogService: WorkspaceCatalogService;
  let workspaceRootPath: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-docs-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    documentService = new DocumentService(workspaceManager, documentIdGenerator, fileStorageService);
    documentTypeService = new DocumentTypeService(workspaceManager, fileStorageService);
    workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      workspaceCatalogService,
      catalogService,
      documentIdGenerator
    );

    workspaceRootPath = path.join(tempRoot, 'Quality');
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

    expect(documentTypeService.list(workspaceRootPath)).toHaveLength(3);
  });

  afterEach(() => {
    workspaceManager.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a metadata-only document shell with a physical document folder', () => {
    const detail = documentService.create(workspaceRootPath, {
      title: 'Internal Audit Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3'
    });

    const absoluteDocumentFolderPath = path.join(
      workspaceRootPath,
      ...detail.documentFolderPath.split('/')
    );

    expect(detail.documentId).toMatch(/^0220\d{2}\d{5}$/);
    expect(detail.versions).toHaveLength(0);
    expect(existsSync(absoluteDocumentFolderPath)).toBe(true);

    const list = documentService.list(workspaceRootPath);
    expect(list).toHaveLength(1);
    expect(list[0]?.latestVersionLabel).toBeNull();
    expect(list[0]?.status).toBeNull();
  });

  it('creates versions using numeric, prefixed, and major-minor version labels', () => {
    const numeric = documentService.create(workspaceRootPath, {
      title: 'Numeric Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const numericV1 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: numeric.id,
      revisionDescription: 'First numeric version'
    });
    const numericV2 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: numeric.id,
      revisionDescription: 'Second numeric version'
    });

    const prefixed = documentService.create(workspaceRootPath, {
      title: 'Prefixed Specification',
      documentTypeId: 1,
      author: 'Morgan Ellis',
      versionScheme: 'v-prefix'
    });
    const prefixedV1 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: prefixed.id,
      revisionDescription: 'First prefixed version'
    });

    const majorMinor = documentService.create(workspaceRootPath, {
      title: 'Major Minor Report',
      documentTypeId: 3,
      author: 'Avery Chen',
      versionScheme: 'major-minor'
    });
    const majorMinorV1 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: majorMinor.id,
      revisionDescription: 'Initial report version'
    });
    const majorMinorV2 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: majorMinor.id,
      revisionDescription: 'Minor update',
      bumpType: 'minor'
    });
    const majorMinorV3 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: majorMinor.id,
      revisionDescription: 'Major release',
      bumpType: 'major'
    });

    expect(numericV1.versions[0]?.versionLabel).toBe('001');
    expect(numericV2.versions[0]?.versionLabel).toBe('002');
    expect(prefixedV1.versions[0]?.versionLabel).toBe('v1');
    expect(majorMinorV1.versions[0]?.versionLabel).toBe('1.0');
    expect(majorMinorV2.versions[0]?.versionLabel).toBe('1.1');
    expect(majorMinorV3.versions[0]?.versionLabel).toBe('2.0');

    const versionFolderPath = path.join(
      workspaceRootPath,
      ...majorMinorV3.documentFolderPath.split('/'),
      '2.0'
    );
    expect(existsSync(versionFolderPath)).toBe(true);
  });

  it('can generate a new document ID for each version while keeping the history linked', () => {
    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'flat',
      versionManagementMode: 'version-specific-document-id'
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Version Specific IDs',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const firstVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial release'
    });
    const secondVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Second release'
    });

    expect(firstVersion.versions[0]?.versionDocumentId).toBe(created.documentId);
    expect(secondVersion.documentId).not.toBe(created.documentId);
    expect(secondVersion.versions[0]?.versionDocumentId).toBe(secondVersion.documentId);
    expect(secondVersion.versions[1]?.versionDocumentId).toBe(created.documentId);
    expect(secondVersion.versions[0]?.documentId).toBe(created.id);
    expect(secondVersion.versions[1]?.documentId).toBe(created.id);
  });

  it('adds files, syncs manual filesystem changes, and preserves role metadata across rename', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Operating Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });

    const workingSourceFile = path.join(tempRoot, 'incoming', 'procedure.docx');
    const conceptPdfSourceFile = path.join(tempRoot, 'incoming', 'procedure-concept.pdf');
    mkdirSync(path.dirname(workingSourceFile), { recursive: true });
    writeFileSync(workingSourceFile, 'working document', 'utf8');
    writeFileSync(conceptPdfSourceFile, 'concept pdf', 'utf8');

    const afterAdd = documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [workingSourceFile]
    });
    const workingFile = afterAdd.files[0]!;
    const workingAbsolutePath = path.join(workspaceRootPath, ...workingFile.filePath.split('/'));
    const renamedAbsolutePath = path.join(path.dirname(workingAbsolutePath), 'procedure-renamed.docx');
    renameSync(workingAbsolutePath, renamedAbsolutePath);

    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );
    mkdirSync(path.join(versionFolderAbsolutePath, 'concept-pdf'), { recursive: true });
    writeFileSync(path.join(versionFolderAbsolutePath, 'concept-pdf', 'procedure-concept.pdf'), 'concept pdf', 'utf8');
    mkdirSync(path.join(versionFolderAbsolutePath, 'custom', 'deep'), { recursive: true });
    writeFileSync(path.join(versionFolderAbsolutePath, 'custom', 'deep', 'ignored.txt'), 'ignored', 'utf8');

    const afterRenameAndManualAdd = documentService.syncVersionFiles(
      workspaceRootPath,
      versioned.versions[0]!.id
    );
    const renamedWorkingFile = afterRenameAndManualAdd.files.find((file) => file.role === 'working');
    const conceptPdfFile = afterRenameAndManualAdd.files.find((file) => file.role === 'concept-pdf');

    expect(renamedWorkingFile?.fileName).toBe('procedure-renamed.docx');
    expect(conceptPdfFile?.fileName).toBe('procedure-concept.pdf');
    expect(afterRenameAndManualAdd.unmanagedPaths).toContain(
      'Documents/Procedure/02202600001/001/custom'
    );

    rmSync(renamedAbsolutePath, { force: true });
    const afterDelete = documentService.syncVersionFiles(workspaceRootPath, versioned.versions[0]!.id);

    expect(afterDelete.files.map((file) => file.role)).toEqual(['concept-pdf']);
  });

  it('migrates managed files between flat and role-subfolder layouts', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Migration Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Migration test version'
    });
    const workingFile = path.join(tempRoot, 'incoming', 'migration.docx');
    const conceptPdf = path.join(tempRoot, 'incoming', 'migration.pdf');
    const extraNote = path.join(tempRoot, 'incoming', 'notes.txt');
    mkdirSync(path.dirname(workingFile), { recursive: true });
    writeFileSync(workingFile, 'working', 'utf8');
    writeFileSync(conceptPdf, 'concept', 'utf8');
    writeFileSync(extraNote, 'notes', 'utf8');

    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [workingFile]
    });
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'concept-pdf',
      sourceFilePaths: [conceptPdf]
    });
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'other',
      sourceFilePaths: [extraNote]
    });

    const migrated = workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'role-subfolders'
    });
    const migratedDetail = documentService.getDetail(workspaceRootPath, created.id);

    expect(migrated.summary.settings.fileOrganizationMode).toBe('role-subfolders');
    expect(migratedDetail.versions[0]?.files.map((file) => file.filePath)).toEqual([
      'Documents/Procedure/02202600001/001/working/migration.docx',
      'Documents/Procedure/02202600001/001/concept-pdf/migration.pdf',
      'Documents/Procedure/02202600001/001/other/notes.txt'
    ]);
  });

  it('fails safely when migrating from role subfolders to flat layout would collide', () => {
    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'role-subfolders'
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Collision Procedure',
      documentTypeId: 2,
      author: 'Avery Chen',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Collision version'
    });
    const workingFile = path.join(tempRoot, 'incoming', 'duplicate-name.txt');
    const conceptFile = path.join(tempRoot, 'incoming', 'duplicate-name-copy.txt');
    mkdirSync(path.dirname(workingFile), { recursive: true });
    writeFileSync(workingFile, 'working duplicate', 'utf8');
    writeFileSync(conceptFile, 'concept duplicate', 'utf8');

    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [workingFile]
    });
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'concept-pdf',
      sourceFilePaths: [conceptFile]
    });

    const workingStoredPath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001',
      'working',
      'duplicate-name.txt'
    );
    const conceptStoredPath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001',
      'concept-pdf',
      'duplicate-name-copy.txt'
    );
    renameSync(conceptStoredPath, path.join(path.dirname(conceptStoredPath), 'duplicate-name.txt'));

    expect(() =>
      workspaceService.updateSettings(workspaceRootPath, {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      })
    ).toThrow('Workspace migration would create two files');

    expect(existsSync(workingStoredPath)).toBe(true);
  });

  it('applies workspace defaults and updates document metadata fields', () => {
    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'flat',
      defaultCompany: 'Acme Manufacturing',
      defaultDepartment: 'Quality Assurance'
    });

    const project = workspaceCatalogService.createProject(workspaceRootPath, {
      name: 'QMS Rollout'
    });
    const confidentialityClass = workspaceCatalogService.createConfidentialityClass(
      workspaceRootPath,
      {
        name: 'Internal'
      }
    );
    const language = workspaceCatalogService.createLanguage(workspaceRootPath, {
      code: 'FR'
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Controlled Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3',
      languageId: language.id,
      confidentialityClassId: confidentialityClass.id,
      projectId: project.id,
      revisionIntervalMonths: 12
    });

    expect(created.company).toBe('Acme Manufacturing');
    expect(created.department).toBe('Quality Assurance');
    expect(created.projectName).toBe('QMS Rollout');
    expect(created.confidentialityClassName).toBe('Internal');
    expect(created.languageCode).toBe('FR');
    expect(created.revisionIntervalMonths).toBe(12);

    const updated = documentService.updateDocument(workspaceRootPath, {
      documentRecordId: created.id,
      title: 'Controlled Procedure Updated',
      author: 'Taylor Reed',
      languageId: language.id,
      confidentialityClassId: confidentialityClass.id,
      projectId: project.id,
      company: 'Acme Labs',
      department: 'Operations',
      revisionIntervalMonths: 18
    });

    expect(updated.title).toBe('Controlled Procedure Updated');
    expect(updated.author).toBe('Taylor Reed');
    expect(updated.company).toBe('Acme Labs');
    expect(updated.department).toBe('Operations');
    expect(updated.revisionIntervalMonths).toBe(18);

    const listed = documentService.list(workspaceRootPath)[0];
    expect(listed?.projectName).toBe('QMS Rollout');
    expect(listed?.languageCode).toBe('FR');
    expect(listed?.confidentialityClassName).toBe('Internal');
  });

  it('updates latest version metadata and obsoletes the previous version by default', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Release Procedure',
      documentTypeId: 2,
      author: 'Morgan Ellis',
      versionScheme: 'numeric-3'
    });

    documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial draft'
    });
    const releasedV1 = documentService.updateLatestVersion(workspaceRootPath, {
      documentRecordId: created.id,
      status: 'Released',
      releasedDate: '2026-03-28',
      approvedBy: 'Avery Chen',
      revisionDescription: 'Approved first release'
    });

    expect(releasedV1.versions[0]?.status).toBe('Released');
    expect(releasedV1.versions[0]?.releasedDate).toBe('2026-03-28');
    expect(releasedV1.versions[0]?.approvedBy).toBe('Avery Chen');
    expect(releasedV1.versions[0]?.revisionDescription).toBe('Approved first release');

    const afterSecondVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Second revision draft'
    });

    expect(afterSecondVersion.versions[0]?.status).toBe('Draft');
    expect(afterSecondVersion.versions[1]?.status).toBe('Obsolete');
  });

  it('keeps the previous version status when auto-obsolete is disabled', () => {
    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'flat',
      autoMarkPreviousVersionObsolete: false
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Manual Obsolete Control',
      documentTypeId: 2,
      author: 'Morgan Ellis',
      versionScheme: 'numeric-3'
    });

    documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial release'
    });
    documentService.updateLatestVersion(workspaceRootPath, {
      documentRecordId: created.id,
      status: 'Released',
      releasedDate: '2026-03-29',
      approvedBy: 'Jordan Singh',
      revisionDescription: 'Released without auto obsolete'
    });

    const afterSecondVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Next draft'
    });

    expect(afterSecondVersion.versions[0]?.status).toBe('Draft');
    expect(afterSecondVersion.versions[1]?.status).toBe('Released');
  });
});
