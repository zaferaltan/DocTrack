import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  it('builds flat version file paths', () => {
    const service = new FileStorageService();

    const documentFolderPath = service.getDocumentFolderRelativePath(
      { storageLayoutPreset: 'stable-id', fileOrganizationMode: 'flat' },
      'Procedure',
      '01202600001',
      'Internal Audit Procedure'
    );
    const storedPath = service.getStoredRelativePath(
      { storageLayoutPreset: 'stable-id', fileOrganizationMode: 'flat' },
      documentFolderPath,
      '001',
      'working',
      'procedure.docx'
    );

    expect(documentFolderPath).toBe('Documents/Procedure/01202600001');
    expect(storedPath).toBe('Documents/Procedure/01202600001/001/procedure.docx');
  });

  it('builds role-subfolder version file paths', () => {
    const service = new FileStorageService();

    const documentFolderPath = service.getDocumentFolderRelativePath(
      { storageLayoutPreset: 'friendly-id', fileOrganizationMode: 'role-subfolders' },
      'Procedure',
      '01202600001',
      'Supplier Audit Checklist'
    );
    const storedPath = service.getStoredRelativePath(
      { storageLayoutPreset: 'friendly-id', fileOrganizationMode: 'role-subfolders' },
      documentFolderPath,
      'v2',
      'concept-pdf',
      'checklist.pdf'
    );

    expect(documentFolderPath).toBe('Documents/Procedure/01202600001 - Supplier Audit Checklist');
    expect(storedPath).toBe(
      'Documents/Procedure/01202600001 - Supplier Audit Checklist/v2/concept-pdf/checklist.pdf'
    );
  });

  it('creates role directories for role-subfolder version folders', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const versionPath = service.ensureVersionFolder(
      root,
      { storageLayoutPreset: 'stable-id', fileOrganizationMode: 'role-subfolders' },
      'Documents/Procedure/01202600001',
      '001'
    );

    expect(existsSync(path.join(versionPath, 'working'))).toBe(true);
    expect(existsSync(path.join(versionPath, 'concept-pdf'))).toBe(true);
    expect(existsSync(path.join(versionPath, 'final-pdf'))).toBe(true);
    expect(existsSync(path.join(versionPath, 'other'))).toBe(true);
  });

  it('scans root files, role subfolders, and unmanaged deep paths', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspaceRootPath = path.join(root, 'Quality');
    const versionFolderPath = 'Documents/Procedure/01202600001/001';
    const versionAbsolutePath = service.ensureVersionFolder(
      workspaceRootPath,
      { storageLayoutPreset: 'stable-id', fileOrganizationMode: 'flat' },
      'Documents/Procedure/01202600001',
      '001'
    );

    writeFileSync(path.join(versionAbsolutePath, 'procedure.docx'), 'working', 'utf8');
    mkdirSync(path.join(versionAbsolutePath, 'concept-pdf'), { recursive: true });
    writeFileSync(path.join(versionAbsolutePath, 'concept-pdf', 'procedure.pdf'), 'concept', 'utf8');
    mkdirSync(path.join(versionAbsolutePath, 'nested', 'deep'), { recursive: true });
    writeFileSync(path.join(versionAbsolutePath, 'nested', 'deep', 'ignored.txt'), 'ignored', 'utf8');
    mkdirSync(path.join(versionAbsolutePath, 'working', 'drafts'), { recursive: true });

    const scan = service.scanVersionFolder(workspaceRootPath, versionFolderPath);

    expect(
      scan.files
        .map((file) => [file.inferredRole, file.relativePath] as const)
        .sort((left, right) => left[1].localeCompare(right[1]))
    ).toEqual([
      ['concept-pdf', 'Documents/Procedure/01202600001/001/concept-pdf/procedure.pdf'],
      ['other', 'Documents/Procedure/01202600001/001/procedure.docx']
    ]);
    expect(scan.unmanagedPaths).toEqual([
      'Documents/Procedure/01202600001/001/nested',
      'Documents/Procedure/01202600001/001/working/drafts'
    ]);
  });

  it('moves managed files and cleans up empty role folders', () => {
    const root = createTempRoot();
    const service = new FileStorageService();
    const workspaceRootPath = path.join(root, 'Quality');
    const sourceFile = path.join(root, 'source.txt');
    writeFileSync(sourceFile, 'hello world', 'utf8');

    const [storedFile] = service.importManagedFiles(
      workspaceRootPath,
      { storageLayoutPreset: 'stable-id', fileOrganizationMode: 'role-subfolders' },
      'Documents/Procedure/01202600001',
      '001',
      'working',
      [sourceFile]
    );
    const moved = service.moveManagedFile(
      workspaceRootPath,
      storedFile.relativePath,
      'Documents/Procedure/01202600001/001/other/source.txt'
    );

    expect(moved.relativePath).toBe('Documents/Procedure/01202600001/001/other/source.txt');
    expect(existsSync(path.join(workspaceRootPath, ...moved.relativePath.split('/')))).toBe(true);
    expect(readdirSync(path.join(workspaceRootPath, 'Documents', 'Procedure', '01202600001', '001'))).toContain(
      'other'
    );
    expect(readdirSync(path.join(workspaceRootPath, 'Documents', 'Procedure', '01202600001', '001'))).not.toContain(
      'working'
    );

    service.deleteManagedFile(workspaceRootPath, moved.relativePath);

    expect(existsSync(path.join(workspaceRootPath, ...moved.relativePath.split('/')))).toBe(false);
  });
});
