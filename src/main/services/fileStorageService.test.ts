import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileStorageService } from '@main/services/fileStorageService';

const tempDirectories: string[] = [];

const createTempRoot = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'doctrack-storage-'));
  tempDirectories.push(directory);
  return directory;
};

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('FileStorageService', () => {
  it('copies a file into managed workspace storage under the stable-id layout', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspaceRootPath = path.join(root, 'Quality');
    const sourceFile = path.join(root, 'source.txt');
    writeFileSync(sourceFile, 'hello world', 'utf8');

    const documentFolderPath = service.getDocumentFolderRelativePath(
      { storageLayoutPreset: 'stable-id' },
      'Procedure',
      '01202600001',
      'Internal Audit Procedure'
    );
    const stored = service.copyManagedFile(workspaceRootPath, documentFolderPath, 1, sourceFile);

    expect(stored.relativePath).toBe('Documents/Procedure/01202600001/v1/source.txt');
    expect(path.isAbsolute(stored.absolutePath)).toBe(true);
    expect(existsSync(stored.absolutePath)).toBe(true);
  });

  it('builds friendly-id document folders with the document title', () => {
    const service = new FileStorageService();

    const documentFolderPath = service.getDocumentFolderRelativePath(
      { storageLayoutPreset: 'friendly-id' },
      'Procedure',
      '01202600001',
      'Supplier Audit Checklist'
    );
    const versionPath = service.getStoredRelativePath(documentFolderPath, 2, 'checklist.pdf');

    expect(documentFolderPath).toBe('Documents/Procedure/01202600001 - Supplier Audit Checklist');
    expect(versionPath).toBe(
      'Documents/Procedure/01202600001 - Supplier Audit Checklist/v2/checklist.pdf'
    );
  });

  it('cleans up empty version and document folders after rollback cleanup', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspaceRootPath = path.join(root, 'Quality');
    const sourceFile = path.join(root, 'source.txt');
    writeFileSync(sourceFile, 'hello world', 'utf8');

    const documentFolderPath = service.getDocumentFolderRelativePath(
      { storageLayoutPreset: 'stable-id' },
      'Procedure',
      '01202600001',
      'Internal Audit Procedure'
    );
    const stored = service.copyManagedFile(workspaceRootPath, documentFolderPath, 1, sourceFile);
    const documentDirectoryPath = path.dirname(path.dirname(stored.absolutePath));
    const typeDirectoryPath = path.dirname(documentDirectoryPath);

    service.cleanupManagedPath(stored.absolutePath);

    expect(existsSync(documentDirectoryPath)).toBe(false);
    expect(existsSync(typeDirectoryPath)).toBe(true);
    expect(readdirSync(typeDirectoryPath)).toHaveLength(0);
  });
});
