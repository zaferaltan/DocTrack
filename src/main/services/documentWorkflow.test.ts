import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  let workspaceService: WorkspaceService;
  let documentService: DocumentService;
  let workspacePath: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-docs-'));
    const workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    documentService = new DocumentService(workspaceManager, documentIdGenerator, fileStorageService);
    const documentTypeService = new DocumentTypeService(workspaceManager);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      catalogService,
      documentIdGenerator
    );

    workspacePath = path.join(tempRoot, 'Quality.sqlite');
    workspaceService.create({
      name: 'Quality',
      filePath: workspacePath,
      includeExampleData: false
    });

    expect(documentTypeService.list(workspacePath)).toHaveLength(3);
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a document with version 1 and a managed file copy', () => {
    const sourceFile = path.join(tempRoot, 'incoming', 'audit.md');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, '# Audit Procedure', 'utf8');

    const detail = documentService.create(workspacePath, {
      title: 'Internal Audit Procedure',
      documentTypeId: 2,
      author: 'Jordan Singh',
      notes: 'Initial draft',
      sourceFilePath: sourceFile
    });

    expect(detail.documentId).toMatch(/^0220\d{2}\d{5}$/);
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]?.versionNumber).toBe(1);
    expect(detail.versions[0]?.status).toBe('Draft');
    expect(detail.versions[0]?.filePath).toContain('/documents/');

    const list = documentService.list(workspacePath);
    expect(list).toHaveLength(1);
    expect(list[0]?.latestVersion).toBe(1);
    expect(list[0]?.status).toBe('Draft');
  });

  it('creates a new version without changing the document id and updates status on the latest version', () => {
    const v1File = path.join(tempRoot, 'incoming', 'procedure-v1.md');
    const v2File = path.join(tempRoot, 'incoming', 'procedure-v2.md');
    mkdirSync(path.dirname(v1File), { recursive: true });
    writeFileSync(v1File, '# Procedure v1', 'utf8');
    writeFileSync(v2File, '# Procedure v2', 'utf8');

    const created = documentService.create(workspacePath, {
      title: 'Operating Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      notes: 'Initial release candidate',
      sourceFilePath: v1File
    });

    const newVersion = documentService.createVersion(workspacePath, {
      documentRecordId: created.id,
      notes: 'Second draft after review',
      sourceFilePath: v2File
    });

    expect(newVersion.documentId).toBe(created.documentId);
    expect(newVersion.versions[0]?.versionNumber).toBe(2);
    expect(newVersion.versions).toHaveLength(2);

    const updatedStatus = documentService.updateStatus(workspacePath, {
      documentRecordId: created.id,
      status: 'Released'
    });

    expect(updatedStatus.versions[0]?.status).toBe('Released');
    expect(updatedStatus.versions[1]?.status).toBe('Draft');

    const overviewRow = documentService.list(workspacePath)[0];
    expect(overviewRow?.latestVersion).toBe(2);
    expect(overviewRow?.status).toBe('Released');
  });
});
