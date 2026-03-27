import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
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
import {
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

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-workspace-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    const catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    const documentService = new DocumentService(workspaceManager, documentIdGenerator, fileStorageService);
    new DocumentTypeService(workspaceManager, fileStorageService);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      catalogService,
      documentIdGenerator
    );
  });

  afterEach(() => {
    workspaceManager.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates a workspace folder with seeded metadata, settings, and starter type folders', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: { storageLayoutPreset: 'stable-id' },
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
    expect(result.summary.documentTypes.map((item) => item.numberPrefix)).toEqual(['01', '02', '03']);
    expect(result.summary.statuses).toEqual(['Draft', 'In Review', 'Released', 'Archived']);
    expect(existsSync(databasePath)).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Specification'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Procedure'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Report'))).toBe(true);
    expect(workspaceService.listOpen()).toHaveLength(1);
  });

  it('supports multiple open workspaces and closing individual tabs by root path', () => {
    const first = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: { storageLayoutPreset: 'stable-id' },
      includeExampleData: false
    });
    const second = workspaceService.create({
      name: 'Manufacturing',
      parentPath: tempRoot,
      settings: { storageLayoutPreset: 'friendly-id' },
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
      settings: { storageLayoutPreset: 'stable-id' },
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
    const row = db.prepare('SELECT FilePath, RootPath FROM Workspaces WHERE Id = 1').get() as
      | { FilePath: string; RootPath: string }
      | undefined;
    db.close();

    expect(reopened.workspace.rootPath).toBe(movedRootPath);
    expect(row?.RootPath).toBe(movedRootPath);
    expect(row?.FilePath).toBe(movedDatabasePath);
  });

  it('persists workspace settings updates per workspace', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: { storageLayoutPreset: 'stable-id' },
      includeExampleData: false
    });

    const updated = workspaceService.updateSettings(created.workspace.rootPath, {
      storageLayoutPreset: 'friendly-id'
    });

    workspaceService.close(created.workspace.rootPath);
    const reopened = workspaceService.open(created.workspace.rootPath);

    expect(updated.summary.settings.storageLayoutPreset).toBe('friendly-id');
    expect(reopened.summary.settings.storageLayoutPreset).toBe('friendly-id');
  });

  it('rejects folders that do not match the DocTrack workspace layout', () => {
    const invalidRootPath = path.join(tempRoot, 'not-a-workspace');
    mkdirSync(invalidRootPath, { recursive: true });

    expect(() => workspaceService.open(invalidRootPath)).toThrow(
      'The selected folder is not a valid DocTrack workspace.'
    );
  });
});
