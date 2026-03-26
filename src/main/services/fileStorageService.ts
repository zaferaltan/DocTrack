import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const sanitizeSegment = (value: string): string =>
  value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim();

const toPosixPath = (value: string): string => value.split(path.sep).join(path.posix.sep);

const replaceFirstPathSegment = (value: string, replacement: string): string => {
  const parts = value.split('/');

  if (parts.length === 0) {
    return value;
  }

  parts[0] = replacement;
  return parts.join('/');
};

export class FileStorageService {
  getWorkspaceFilesDirectory(workspacePath: string): string {
    const workspaceName = path.parse(workspacePath).name;
    return path.join(path.dirname(workspacePath), `${workspaceName}.files`);
  }

  getStoredRelativePath(
    workspacePath: string,
    documentId: string,
    versionNumber: number,
    fileName: string
  ): string {
    const safeFileName = sanitizeSegment(path.basename(fileName)) || 'document.bin';
    const relativePath = path.join(
      path.basename(this.getWorkspaceFilesDirectory(workspacePath)),
      'documents',
      documentId,
      `v${versionNumber}`,
      safeFileName
    );

    return toPosixPath(relativePath);
  }

  copyManagedFile(
    workspacePath: string,
    documentId: string,
    versionNumber: number,
    sourceFilePath: string
  ): { absolutePath: string; relativePath: string } {
    if (!existsSync(sourceFilePath)) {
      throw new Error('Selected source file could not be found.');
    }

    const relativePath = this.getStoredRelativePath(
      workspacePath,
      documentId,
      versionNumber,
      sourceFilePath
    );
    const absolutePath = this.resolveStoredFilePath(workspacePath, relativePath, true);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    copyFileSync(sourceFilePath, absolutePath);

    return { absolutePath, relativePath };
  }

  writeManagedTextFile(
    workspacePath: string,
    documentId: string,
    versionNumber: number,
    fileName: string,
    content: string
  ): { absolutePath: string; relativePath: string } {
    const relativePath = this.getStoredRelativePath(workspacePath, documentId, versionNumber, fileName);
    const absolutePath = this.resolveStoredFilePath(workspacePath, relativePath, true);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
    return { absolutePath, relativePath };
  }

  resolveStoredFilePath(workspacePath: string, relativePath: string, allowMissing = false): string {
    const normalized = relativePath.split(/[\\/]/).join('/');
    const primary = path.resolve(path.dirname(workspacePath), normalized);

    if (allowMissing || existsSync(primary)) {
      return primary;
    }

    const currentAssetsDirName = path.basename(this.getWorkspaceFilesDirectory(workspacePath));
    const fallbackRelativePath = replaceFirstPathSegment(normalized, currentAssetsDirName);
    const fallback = path.resolve(path.dirname(workspacePath), fallbackRelativePath);

    if (existsSync(fallback)) {
      return fallback;
    }

    return primary;
  }

  cleanupManagedPath(absolutePath: string): void {
    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true });
    }

    const versionDirectory = path.dirname(absolutePath);
    if (existsSync(versionDirectory) && readdirSync(versionDirectory).length === 0) {
      rmSync(versionDirectory, { recursive: true, force: true });
    }
  }
}
