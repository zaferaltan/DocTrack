import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  let templateService: TemplateService;
  let workspaceCatalogService: WorkspaceCatalogService;
  let fileStorageService: FileStorageService;
  let workspaceRootPath: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-docs-'));
    workspaceManager = new WorkspaceManager();
    fileStorageService = new FileStorageService();
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
    documentTypeService = new DocumentTypeService(workspaceManager, fileStorageService);
    workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
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

  it('creates a managed initial version from a selected template', () => {
    const workingSourceFile = path.join(tempRoot, 'incoming', 'starter.docx');
    const conceptPdfSourceFile = path.join(tempRoot, 'incoming', 'starter.pdf');
    mkdirSync(path.dirname(workingSourceFile), { recursive: true });
    writeFileSync(workingSourceFile, 'starter working file', 'utf8');
    writeFileSync(conceptPdfSourceFile, 'starter concept pdf', 'utf8');

    const template = templateService.create(workspaceRootPath, {
      name: 'Procedure Starter'
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [workingSourceFile]
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [conceptPdfSourceFile]
    });

    const detail = documentService.create(workspaceRootPath, {
      title: 'Templated Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3',
      templateId: template.id
    });

    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]?.versionLabel).toBe('001');
    expect(detail.versions[0]?.status).toBe('Draft');
    expect(detail.versions[0]?.revisionDescription).toBe(
      'Created from template "Procedure Starter".'
    );
    expect(detail.versions[0]?.files.map((file) => file.role)).toEqual([
      'working',
      'concept-pdf'
    ]);
    expect(detail.versions[0]?.files.map((file) => file.fileName)).toEqual([
      'starter.docx',
      'starter.pdf'
    ]);
  });

  it('uses the correct initial version labels when a template creates the first managed version', () => {
    const sourceFile = path.join(tempRoot, 'incoming', 'template-start.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'template-start', 'utf8');

    const template = templateService.create(workspaceRootPath, {
      name: 'Generic Starter'
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [sourceFile]
    });

    const prefixed = documentService.create(workspaceRootPath, {
      title: 'Prefixed Templated Specification',
      documentTypeId: 1,
      author: 'Morgan Ellis',
      versionScheme: 'v-prefix',
      templateId: template.id
    });
    const majorMinor = documentService.create(workspaceRootPath, {
      title: 'Major Minor Templated Report',
      documentTypeId: 3,
      author: 'Avery Chen',
      versionScheme: 'major-minor',
      templateId: template.id
    });

    expect(prefixed.versions[0]?.versionLabel).toBe('v1');
    expect(majorMinor.versions[0]?.versionLabel).toBe('1.0');
  });

  it('rejects duplicate filenames when adding files to a template', () => {
    const firstSourceFile = path.join(tempRoot, 'incoming', 'working', 'duplicate.docx');
    const secondSourceFile = path.join(tempRoot, 'incoming', 'other', 'duplicate.docx');
    mkdirSync(path.dirname(firstSourceFile), { recursive: true });
    mkdirSync(path.dirname(secondSourceFile), { recursive: true });
    writeFileSync(firstSourceFile, 'first duplicate', 'utf8');
    writeFileSync(secondSourceFile, 'second duplicate', 'utf8');

    const template = templateService.create(workspaceRootPath, {
      name: 'Collision Starter'
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [firstSourceFile]
    });

    expect(() =>
      templateService.addFiles(workspaceRootPath, {
        templateId: template.id,
        sourceFilePaths: [secondSourceFile]
      })
    ).toThrow('already exists in this template');
  });

  it('creates versions using numeric, prefixed, alphabetic, and major-minor version labels', () => {
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

    const alphabetic = documentService.create(workspaceRootPath, {
      title: 'Alphabetic Work Instruction',
      documentTypeId: 2,
      author: 'Jamie Patel',
      versionScheme: 'alpha-uppercase'
    });
    const alphabeticV1 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: alphabetic.id,
      revisionDescription: 'First alphabetic version'
    });
    const alphabeticV2 = documentService.createVersion(workspaceRootPath, {
      documentRecordId: alphabetic.id,
      revisionDescription: 'Second alphabetic version'
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
    expect(alphabeticV1.versions[0]?.versionLabel).toBe('A');
    expect(alphabeticV2.versions[0]?.versionLabel).toBe('B');
    expect(majorMinorV1.versions[0]?.versionLabel).toBe('1.0');
    expect(majorMinorV2.versions[0]?.versionLabel).toBe('1.1');
    expect(majorMinorV3.versions[0]?.versionLabel).toBe('2.0');

    const alphabeticVersionFolderPath = path.join(
      workspaceRootPath,
      ...alphabeticV2.documentFolderPath.split('/'),
      'B'
    );
    const versionFolderPath = path.join(
      workspaceRootPath,
      ...majorMinorV3.documentFolderPath.split('/'),
      '2.0'
    );
    expect(existsSync(alphabeticVersionFolderPath)).toBe(true);
    expect(existsSync(versionFolderPath)).toBe(true);
  });

  it('supports alphabetic version labels from A through Z and rejects the next version', () => {
    const alphabetic = documentService.create(workspaceRootPath, {
      title: 'Alphabetic Limit Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'alpha-uppercase'
    });

    let latestDetail = alphabetic;
    for (let index = 0; index < 26; index += 1) {
      latestDetail = documentService.createVersion(workspaceRootPath, {
        documentRecordId: alphabetic.id,
        revisionDescription: `Alphabetic revision ${index + 1}`
      });
    }

    expect(latestDetail.versions[0]?.versionLabel).toBe('Z');
    expect(() =>
      documentService.createVersion(workspaceRootPath, {
        documentRecordId: alphabetic.id,
        revisionDescription: 'Beyond Z'
      })
    ).toThrow('Alphabetic version labels support 26 versions from A to Z.');
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

  it('uses the configured custom document ID template for new documents and versions', () => {
    const language = workspaceCatalogService.createLanguage(workspaceRootPath, {
      code: 'FR'
    });

    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      documentIdFormatPreset: 'custom',
      documentIdFormatTemplate: '<docType>-<language>-<year2>-<sequence:3>',
      versionManagementMode: 'version-specific-document-id'
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Custom Format Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3',
      languageId: language.id
    });
    const firstVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'First identifier'
    });
    const nextVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Second identifier'
    });

    expect(created.documentId).toBe('PROCEDURE-FR-26-001');
    expect(firstVersion.versions[0]?.versionDocumentId).toBe('PROCEDURE-FR-26-001');
    expect(nextVersion.documentId).toBe('PROCEDURE-FR-26-002');
    expect(nextVersion.versions[1]?.versionDocumentId).toBe('PROCEDURE-FR-26-001');
  });

  it('previews manual filesystem changes without mutating tracked files until reconciliation is applied', () => {
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
    const trackedWorkingFile = afterRenameAndManualAdd.files.find((file) => file.role === 'working');

    expect(trackedWorkingFile?.fileName).toBe('procedure.docx');
    expect(afterRenameAndManualAdd.filesystemState).toBe('dirty');
    expect(afterRenameAndManualAdd.filesystemChanges.some((change) => change.kind === 'renamed')).toBe(true);
    expect(afterRenameAndManualAdd.filesystemChanges.some((change) => change.kind === 'newUnmanaged')).toBe(true);
    expect(afterRenameAndManualAdd.filesystemChanges.some((change) => change.kind === 'nestedUnmanaged')).toBe(true);
    expect(afterRenameAndManualAdd.unmanagedPaths).toContain(
      'Documents/Procedure/02202600001/001/custom'
    );

    const renameChangeIndex = afterRenameAndManualAdd.filesystemChanges.findIndex(
      (change) => change.kind === 'renamed'
    );
    const reconciledRename = documentService.applyVersionFilesystemReconciliation(
      workspaceRootPath,
      versioned.versions[0]!.id,
      { changeIndexes: [renameChangeIndex] }
    );
    expect(reconciledRename.files.find((file) => file.role === 'working')?.fileName).toBe(
      'procedure-renamed.docx'
    );

    const unmanagedImportChangeIndex = reconciledRename.filesystemChanges.findIndex(
      (change) =>
        change.kind === 'newUnmanaged' &&
        change.discoveredPath ===
          'Documents/Procedure/02202600001/001/concept-pdf/procedure-concept.pdf'
    );
    const reconciledImport = documentService.applyVersionFilesystemReconciliation(
      workspaceRootPath,
      versioned.versions[0]!.id,
      { changeIndexes: [unmanagedImportChangeIndex] }
    );
    expect(reconciledImport.files.map((file) => file.role).sort()).toEqual([
      'concept-pdf',
      'working'
    ]);

    rmSync(renamedAbsolutePath, { force: true });
    const afterDelete = documentService.syncVersionFiles(workspaceRootPath, versioned.versions[0]!.id);
    const missingChangeIndex = afterDelete.filesystemChanges.findIndex(
      (change) => change.kind === 'missingTracked'
    );
    const reconciledDelete = documentService.applyVersionFilesystemReconciliation(
      workspaceRootPath,
      versioned.versions[0]!.id,
      { changeIndexes: [missingChangeIndex] }
    );

    expect(reconciledDelete.files.map((file) => file.role)).toEqual(['concept-pdf']);
    expect(reconciledDelete.filesystemChanges.some((change) => change.kind === 'missingTracked')).toBe(
      false
    );
    const listedAfterDelete = documentService.list(workspaceRootPath).find((item) => item.id === created.id);
    expect(listedAfterDelete?.healthFlags).not.toContain('missingFiles');
  });

  it('marks duplicate-content external moves as ambiguous instead of auto-matching them', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Ambiguous Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });

    const firstSourceFile = path.join(tempRoot, 'incoming', 'duplicate-a.txt');
    const secondSourceFile = path.join(tempRoot, 'incoming', 'duplicate-b.txt');
    mkdirSync(path.dirname(firstSourceFile), { recursive: true });
    writeFileSync(firstSourceFile, 'same content', 'utf8');
    writeFileSync(secondSourceFile, 'same content', 'utf8');

    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [firstSourceFile]
    });
    const afterSecondFile = documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'other',
      sourceFilePaths: [secondSourceFile]
    });
    const otherFile = afterSecondFile.files.find((file) => file.role === 'other');
    if (!otherFile) {
      throw new Error('Expected the secondary tracked file to exist.');
    }

    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );
    const workingAbsolutePath = path.join(
      workspaceRootPath,
      ...afterSecondFile.files.find((file) => file.role === 'working')!.filePath.split('/')
    );
    const otherAbsolutePath = path.join(workspaceRootPath, ...otherFile.filePath.split('/'));
    renameSync(workingAbsolutePath, path.join(versionFolderAbsolutePath, 'moved-a.txt'));
    renameSync(otherAbsolutePath, path.join(versionFolderAbsolutePath, 'moved-b.txt'));

    const preview = documentService.getVersionFilesystemPreview(workspaceRootPath, versioned.versions[0]!.id);

    expect(preview.filesystemState).toBe('ambiguous');
    expect(preview.filesystemChanges.some((change) => change.kind === 'collision')).toBe(true);
  });

  it('deletes a version and removes its physical version folder', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Delete Version Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });

    const sourceFile = path.join(tempRoot, 'incoming', 'delete-version.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'delete me', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );
    expect(existsSync(versionFolderAbsolutePath)).toBe(true);

    const afterDelete = documentService.deleteVersion(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id
    });

    expect(afterDelete.versions).toHaveLength(0);
    expect(existsSync(versionFolderAbsolutePath)).toBe(false);
  });

  it('deletes a document and removes its physical document folder', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Delete Document Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });

    const sourceFile = path.join(tempRoot, 'incoming', 'delete-document.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'delete doc', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const documentFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/')
    );
    expect(existsSync(documentFolderAbsolutePath)).toBe(true);

    documentService.deleteDocument(workspaceRootPath, {
      documentRecordId: created.id
    });

    expect(documentService.list(workspaceRootPath)).toHaveLength(0);
    expect(existsSync(documentFolderAbsolutePath)).toBe(false);
  });

  it('does not remove the document record when filesystem deletion fails', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Locked Delete Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3'
    });

    const documentFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/')
    );
    expect(existsSync(documentFolderAbsolutePath)).toBe(true);

    vi.spyOn(fileStorageService, 'deleteDocumentFolder').mockImplementation(() => {
      throw new Error('Permission denied while deleting document folder.');
    });

    expect(() =>
      documentService.deleteDocument(workspaceRootPath, {
        documentRecordId: created.id
      })
    ).toThrow('Permission denied while deleting document folder.');

    expect(documentService.list(workspaceRootPath)).toHaveLength(1);
    expect(existsSync(documentFolderAbsolutePath)).toBe(true);
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
    const conceptFile = path.join(tempRoot, 'alternate', 'duplicate-name.txt');
    mkdirSync(path.dirname(workingFile), { recursive: true });
    mkdirSync(path.dirname(conceptFile), { recursive: true });
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
      'duplicate-name.txt'
    );

    expect(() =>
      workspaceService.updateSettings(workspaceRootPath, {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      })
    ).toThrow('Workspace migration would create two files');

    expect(existsSync(workingStoredPath)).toBe(true);
  });

  it('removes empty role folders when migrating from role subfolders to flat layout', () => {
    workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'role-subfolders'
    });

    const created = documentService.create(workspaceRootPath, {
      title: 'Cleanup Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Cleanup version'
    });
    const workingFile = path.join(tempRoot, 'incoming', 'cleanup.docx');
    const conceptPdf = path.join(tempRoot, 'incoming', 'cleanup.pdf');
    mkdirSync(path.dirname(workingFile), { recursive: true });
    writeFileSync(workingFile, 'working', 'utf8');
    writeFileSync(conceptPdf, 'concept', 'utf8');

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

    const migrated = workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'stable-id',
      fileOrganizationMode: 'flat'
    });
    const migratedDetail = documentService.getDetail(workspaceRootPath, created.id);
    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );

    expect(migrated.summary.settings.fileOrganizationMode).toBe('flat');
    expect(migratedDetail.versions[0]?.files.map((file) => file.filePath)).toEqual([
      'Documents/Procedure/02202600001/001/cleanup.docx',
      'Documents/Procedure/02202600001/001/cleanup.pdf'
    ]);
    expect(existsSync(path.join(versionFolderAbsolutePath, 'working'))).toBe(false);
    expect(existsSync(path.join(versionFolderAbsolutePath, 'concept-pdf'))).toBe(false);
    expect(existsSync(path.join(versionFolderAbsolutePath, 'final-pdf'))).toBe(false);
    expect(existsSync(path.join(versionFolderAbsolutePath, 'other'))).toBe(false);
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
      reviewedBy: 'Parker Lin',
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
      reviewedBy: 'Morgan Ellis',
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

  it('derives health metadata, previews text files, and compares adjacent versions', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Revision Controlled Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3',
      revisionIntervalMonths: 1
    });
    const versionOne = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial release'
    });
    const firstSourceFile = path.join(tempRoot, 'incoming', 'procedure-notes.txt');
    mkdirSync(path.dirname(firstSourceFile), { recursive: true });
    writeFileSync(firstSourceFile, 'Initial procedure text preview', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versionOne.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [firstSourceFile]
    });
    documentService.updateLatestVersion(workspaceRootPath, {
      documentRecordId: created.id,
      status: 'Released',
      releasedDate: '2026-01-01',
      reviewedBy: 'Taylor Reed',
      approvedBy: 'Jordan Singh',
      revisionDescription: 'Approved release'
    });
    const versionTwo = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Follow-up revision'
    });
    const secondSourceFile = path.join(tempRoot, 'incoming', 'procedure-follow-up.txt');
    writeFileSync(secondSourceFile, 'Updated follow-up text preview', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versionTwo.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [secondSourceFile]
    });

    const list = documentService.list(workspaceRootPath);
    const listedDocument = list.find((item) => item.id === created.id);
    expect(listedDocument?.nextReviewDate).not.toBeNull();
    expect(listedDocument?.isOverdue).toBe(true);
    expect(listedDocument?.healthFlags).toContain('overdueReview');

    const preview = documentService.previewVersionFile(
      workspaceRootPath,
      versionTwo.versions[1]!.files[0]!.id
    );
    expect(preview.kind).toBe('text');
    expect(preview.textContent).toContain('Initial procedure text preview');

    const comparison = documentService.compareVersions(
      workspaceRootPath,
      versionTwo.versions[0]!.id,
      versionTwo.versions[1]!.id
    );
    expect(comparison.currentVersionLabel).toBe('002');
    expect(comparison.previousVersionLabel).toBe('001');
    expect(comparison.deltas.map((delta) => delta.changeType).sort()).toEqual(['added', 'removed']);
  });

  it('flags document health when an older version still has filesystem drift', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Historic Drift Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versionOne = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial release'
    });
    const firstSourceFile = path.join(tempRoot, 'incoming', 'historic-drift-v1.txt');
    const secondSourceFile = path.join(tempRoot, 'incoming', 'historic-drift-v2.txt');
    mkdirSync(path.dirname(firstSourceFile), { recursive: true });
    writeFileSync(firstSourceFile, 'version one', 'utf8');
    writeFileSync(secondSourceFile, 'version two', 'utf8');

    const versionOneWithFiles = documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versionOne.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [firstSourceFile]
    });
    const versionOneStoredPath = path.join(
      workspaceRootPath,
      ...versionOneWithFiles.files[0]!.filePath.split('/')
    );

    const versionTwo = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Follow-up release'
    });
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versionTwo.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [secondSourceFile]
    });

    rmSync(versionOneStoredPath, { force: true });

    const listedDocument = documentService.list(workspaceRootPath).find((item) => item.id === created.id);
    expect(listedDocument?.healthFlags).toContain('missingFiles');
    expect(listedDocument?.healthFlags).toContain('unmanagedPaths');
  });

  it('can ignore unmanaged paths after they are discovered in a version folder', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'Filesystem Reconciliation Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });
    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );
    mkdirSync(path.join(versionFolderAbsolutePath, 'custom'), { recursive: true });
    writeFileSync(path.join(versionFolderAbsolutePath, 'custom', 'notes.txt'), 'ignored', 'utf8');

    const afterSync = documentService.syncVersionFiles(workspaceRootPath, versioned.versions[0]!.id);
    expect(afterSync.unmanagedPaths).toContain('Documents/Procedure/02202600001/001/custom');

    const afterIgnore = documentService.ignoreUnmanagedPath(
      workspaceRootPath,
      versioned.versions[0]!.id,
      'Documents/Procedure/02202600001/001/custom'
    );
    expect(afterIgnore.unmanagedPaths).toHaveLength(0);
  });

  it('ignores hidden files during version filesystem checks', () => {
    const created = documentService.create(workspaceRootPath, {
      title: 'macOS Hidden Metadata Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      revisionDescription: 'Initial version'
    });
    const versionFolderAbsolutePath = path.join(
      workspaceRootPath,
      ...created.documentFolderPath.split('/'),
      '001'
    );

    writeFileSync(path.join(versionFolderAbsolutePath, '.DS_Store'), 'finder metadata', 'utf8');
    mkdirSync(path.join(versionFolderAbsolutePath, 'working'), { recursive: true });
    writeFileSync(path.join(versionFolderAbsolutePath, 'working', '.DS_Store'), 'finder metadata', 'utf8');

    const afterSync = documentService.syncVersionFiles(workspaceRootPath, versioned.versions[0]!.id);

    expect(afterSync.unmanagedPaths).toHaveLength(0);
    expect(afterSync.filesystemState).toBe('clean');
    expect(afterSync.filesystemChanges).toHaveLength(0);
  });
});
