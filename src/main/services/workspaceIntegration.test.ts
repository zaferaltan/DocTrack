import { mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
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

describe('workspace integration', () => {
  let tempRoot: string;
  let workspaceManager: WorkspaceManager;
  let workspaceService: WorkspaceService;
  let documentService: DocumentService;
  let documentTypeService: DocumentTypeService;

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-workspace-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    documentService = new DocumentService(workspaceManager, documentIdGenerator, fileStorageService);
    documentTypeService = new DocumentTypeService(workspaceManager);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      catalogService,
      documentIdGenerator
    );
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a workspace with starter metadata and seeded statuses', () => {
    const workspacePath = path.join(tempRoot, 'Quality.sqlite');
    const result = workspaceService.create({
      name: 'Quality',
      filePath: workspacePath,
      includeExampleData: false
    });

    expect(result.workspace.name).toBe('Quality');
    expect(result.summary.documentTypes.map((item) => item.numberPrefix)).toEqual(['01', '02', '03']);
    expect(result.summary.statuses).toEqual(['Draft', 'In Review', 'Released', 'Archived']);
    expect(workspaceService.listOpen()).toHaveLength(1);
  });

  it('supports multiple open workspaces and closing individual tabs', () => {
    const first = workspaceService.create({
      name: 'Quality',
      filePath: path.join(tempRoot, 'Quality.sqlite'),
      includeExampleData: false
    });
    const second = workspaceService.create({
      name: 'Manufacturing',
      filePath: path.join(tempRoot, 'Manufacturing.sqlite'),
      includeExampleData: false
    });

    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual([
      'Quality',
      'Manufacturing'
    ]);

    workspaceService.close(first.workspace.filePath);
    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual(['Manufacturing']);
    expect(second.workspace.filePath).toContain('Manufacturing.sqlite');
  });

  it('updates workspace metadata when a workspace file is moved and reopened', () => {
    const originalPath = path.join(tempRoot, 'Quality.sqlite');
    workspaceService.create({
      name: 'Quality',
      filePath: originalPath,
      includeExampleData: false
    });
    workspaceService.close(originalPath);

    const movedPath = path.join(tempRoot, 'Archive', 'Quality Renamed.sqlite');
    mkdirSync(path.dirname(movedPath), { recursive: true });
    renameSync(originalPath, movedPath);

    const reopened = workspaceService.open(movedPath);
    const db = new Database(movedPath, { fileMustExist: true });
    const row = db.prepare('SELECT FilePath FROM Workspaces WHERE Id = 1').get() as
      | { FilePath: string }
      | undefined;
    db.close();

    expect(reopened.workspace.filePath).toBe(movedPath);
    expect(row?.FilePath).toBe(movedPath);
  });

  it('rejects non-workspace SQLite files', () => {
    const invalidPath = path.join(tempRoot, 'not-a-workspace.sqlite');
    const db = new Database(invalidPath);
    db.exec('CREATE TABLE OtherTable (Id INTEGER PRIMARY KEY);');
    db.close();

    expect(() => workspaceService.open(invalidPath)).toThrow('The selected file is not a valid DocTrack workspace.');
  });
});
