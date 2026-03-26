import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  it('copies a file into managed workspace storage with a relative path', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspacePath = path.join(root, 'Quality.sqlite');
    const sourceFile = path.join(root, 'source.txt');
    writeFileSync(sourceFile, 'hello world', 'utf8');

    const stored = service.copyManagedFile(workspacePath, '01202600001', 1, sourceFile);

    expect(stored.relativePath).toBe('Quality.files/documents/01202600001/v1/source.txt');
    expect(path.isAbsolute(stored.absolutePath)).toBe(true);
  });

  it('resolves a renamed assets folder through fallback lookup', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspacePath = path.join(root, 'Quality.sqlite');
    const currentAssetsDir = service.getWorkspaceFilesDirectory(workspacePath);
    mkdirSync(path.dirname(currentAssetsDir), { recursive: true });

    const originalAssetsDir = path.join(root, 'Legacy.files');
    const versionDirectory = path.join(originalAssetsDir, 'documents', '01202600001', 'v1');
    mkdirSync(versionDirectory, { recursive: true });
    writeFileSync(path.join(versionDirectory, 'legacy.txt'), 'legacy', 'utf8');

    renameSync(originalAssetsDir, currentAssetsDir);

    const resolved = service.resolveStoredFilePath(
      workspacePath,
      'Legacy.files/documents/01202600001/v1/legacy.txt'
    );

    expect(resolved).toBe(path.join(currentAssetsDir, 'documents', '01202600001', 'v1', 'legacy.txt'));
  });
});
