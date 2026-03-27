import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { WorkspaceService } from '@main/services/workspaceService';

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
  let workspaceRootPath: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-docs-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    documentService = new DocumentService(workspaceManager, documentIdGenerator, fileStorageService);
    documentTypeService = new DocumentTypeService(workspaceManager, fileStorageService);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      catalogService,
      documentIdGenerator
    );

    workspaceRootPath = path.join(tempRoot, 'Quality');
    workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: { storageLayoutPreset: 'stable-id' },
      includeExampleData: false
    });

    expect(documentTypeService.list(workspaceRootPath)).toHaveLength(3);
  });

  afterEach(() => {
    workspaceManager.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a document with version 1 inside the stable-id folder layout', () => {
    const sourceFile = path.join(tempRoot, 'incoming', 'audit.md');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, '# Audit Procedure', 'utf8');

    const detail = documentService.create(workspaceRootPath, {
      title: 'Internal Audit Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      notes: 'Initial draft',
      sourceFilePath: sourceFile
    });

    const storedFilePath = detail.versions[0]?.filePath ?? '';
    const absoluteStoredFilePath = path.join(workspaceRootPath, ...storedFilePath.split('/'));

    expect(detail.documentId).toMatch(/^0220\d{2}\d{5}$/);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]?.versionNumber).toBe(1);
    expect(detail.versions[0]?.status).toBe('Draft');
    expect(storedFilePath).toMatch(/^Documents\/Procedure\/0220\d{2}\d{5}\/v1\/audit\.md$/);
    expect(existsSync(absoluteStoredFilePath)).toBe(true);

    const list = documentService.list(workspaceRootPath);
    expect(list).toHaveLength(1);
    expect(list[0]?.latestVersion).toBe(1);
    expect(list[0]?.status).toBe('Draft');
  });

  it('migrates existing documents into the new layout when workspace settings change', () => {
    const v1File = path.join(tempRoot, 'incoming', 'procedure-v1.md');
    const v2File = path.join(tempRoot, 'incoming', 'procedure-v2.md');
    const nextDocumentFile = path.join(tempRoot, 'incoming', 'checklist.md');
    mkdirSync(path.dirname(v1File), { recursive: true });
    writeFileSync(v1File, '# Procedure v1', 'utf8');
    writeFileSync(v2File, '# Procedure v2', 'utf8');
    writeFileSync(nextDocumentFile, '# Supplier Audit Checklist', 'utf8');

    const created = documentService.create(workspaceRootPath, {
      title: 'Operating Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      notes: 'Initial release candidate',
      sourceFilePath: v1File
    });
    const originalDocumentFilePath = created.versions[0]?.filePath ?? '';
    const originalAbsolutePath = path.join(workspaceRootPath, ...originalDocumentFilePath.split('/'));

    const updatedWorkspace = workspaceService.updateSettings(workspaceRootPath, {
      storageLayoutPreset: 'friendly-id'
    });
    const migratedDocument = documentService.getDetail(workspaceRootPath, created.id);
    const createdAfterSettingsChange = documentService.create(workspaceRootPath, {
      title: 'Supplier Audit Checklist',
      documentTypeId: 2,
      author: 'Avery Chen',
      notes: 'Checklist draft',
      sourceFilePath: nextDocumentFile
    });
    const newVersion = documentService.createVersion(workspaceRootPath, {
      documentRecordId: created.id,
      notes: 'Second draft after review',
      sourceFilePath: v2File
    });

    const migratedDocumentPath = migratedDocument.versions[0]?.filePath ?? '';
    const newDocumentPath = createdAfterSettingsChange.versions[0]?.filePath ?? '';
    const newVersionFolderPath = newVersion.versions[0]?.filePath.replace(/\/v2\/[^/]+$/, '') ?? '';
    const migratedDocumentFolderPath = migratedDocumentPath.replace(/\/v1\/[^/]+$/, '');
    const migratedAbsolutePath = path.join(workspaceRootPath, ...migratedDocumentPath.split('/'));

    expect(updatedWorkspace.summary.settings.storageLayoutPreset).toBe('friendly-id');
    expect(existsSync(originalAbsolutePath)).toBe(false);
    expect(migratedDocumentPath).toMatch(
      /^Documents\/Procedure\/0220\d{2}\d{5} - Operating Procedure\/v1\/procedure-v1\.md$/
    );
    expect(existsSync(migratedAbsolutePath)).toBe(true);
    expect(createdAfterSettingsChange.documentId).toMatch(/^0220\d{2}\d{5}$/);
    expect(newDocumentPath).toMatch(
      /^Documents\/Procedure\/0220\d{2}\d{5} - Supplier Audit Checklist\/v1\/checklist\.md$/
    );
    expect(newVersion.documentId).toBe(created.documentId);
    expect(newVersion.versions[0]?.versionNumber).toBe(2);
    expect(newVersionFolderPath).toBe(migratedDocumentFolderPath);
    expect(newVersion.versions[0]?.filePath).toMatch(
      /^Documents\/Procedure\/0220\d{2}\d{5} - Operating Procedure\/v2\/procedure-v2\.md$/
    );

    const overviewRow = documentService.list(workspaceRootPath)[0];
    expect(overviewRow?.latestVersion).toBe(2);
    expect(overviewRow?.status).toBe('Draft');
  });
});
