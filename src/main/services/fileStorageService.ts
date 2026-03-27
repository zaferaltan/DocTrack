import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  getDocumentTypeDirectoryRelativePath,
  sanitizeStoragePathSegment,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

export class FileStorageService {
  getWorkspaceDocumentsDirectory(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME);
  }

  getDocumentTypeDirectory(rootPath: string, documentTypeName: string): string {
    return path.join(rootPath, ...getDocumentTypeDirectoryRelativePath(documentTypeName).split('/'));
  }

  ensureDocumentTypeDirectory(rootPath: string, documentTypeName: string): string {
    const directoryPath = this.getDocumentTypeDirectory(rootPath, documentTypeName);
    mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }

  ensureDocumentTypeDirectories(rootPath: string, documentTypeNames: string[]): void {
    for (const documentTypeName of documentTypeNames) {
      this.ensureDocumentTypeDirectory(rootPath, documentTypeName);
    }
  }

  getDocumentFolderRelativePath(
    settings: WorkspaceSettings,
    documentTypeName: string,
    documentId: string,
    title: string
  ): string {
    return buildDocumentFolderRelativePath(settings, documentTypeName, documentId, title);
  }

  getStoredRelativePath(documentFolderPath: string, versionNumber: number, fileName: string): string {
    return buildDocumentVersionRelativePath(
      documentFolderPath,
      versionNumber,
      sanitizeStoragePathSegment(path.basename(fileName), 'document.bin')
    );
  }

  copyManagedFile(
    rootPath: string,
    documentFolderPath: string,
    versionNumber: number,
    sourceFilePath: string
  ): { absolutePath: string; relativePath: string } {
    if (!existsSync(sourceFilePath)) {
      throw new Error('Selected source file could not be found.');
    }

    const relativePath = this.getStoredRelativePath(documentFolderPath, versionNumber, sourceFilePath);
    const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    copyFileSync(sourceFilePath, absolutePath);

    return { absolutePath, relativePath };
  }

  writeManagedTextFile(
    rootPath: string,
    documentFolderPath: string,
    versionNumber: number,
    fileName: string,
    content: string
  ): { absolutePath: string; relativePath: string } {
    const relativePath = this.getStoredRelativePath(documentFolderPath, versionNumber, fileName);
    const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
    return { absolutePath, relativePath };
  }

  resolveStoredFilePath(rootPath: string, relativePath: string, allowMissing = false): string {
    const normalized = relativePath.split(/[\\/]/).join('/');
    const resolvedPath = path.resolve(rootPath, normalized);

    if (allowMissing || existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return resolvedPath;
  }

  moveDocumentFolder(rootPath: string, currentDocumentFolderPath: string, nextDocumentFolderPath: string): void {
    const normalizedCurrent = currentDocumentFolderPath.split(/[\\/]/).join('/');
    const normalizedNext = nextDocumentFolderPath.split(/[\\/]/).join('/');

    if (normalizedCurrent === normalizedNext) {
      return;
    }

    const currentAbsolutePath = this.resolveStoredFilePath(rootPath, normalizedCurrent);
    if (!existsSync(currentAbsolutePath)) {
      throw new Error('A managed document folder could not be found on disk during layout migration.');
    }

    const nextAbsolutePath = this.resolveStoredFilePath(rootPath, normalizedNext, true);
    if (existsSync(nextAbsolutePath)) {
      throw new Error('A target document folder already exists, so the workspace layout could not be migrated.');
    }

    mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });
    renameSync(currentAbsolutePath, nextAbsolutePath);
    this.cleanupEmptyDirectories(path.dirname(currentAbsolutePath), this.getWorkspaceDocumentsDirectory(rootPath));
  }

  cleanupManagedPath(absolutePath: string): void {
    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true });
    }

    const cleanupDirectories = [path.dirname(absolutePath), path.dirname(path.dirname(absolutePath))];

    for (const directoryPath of cleanupDirectories) {
      if (existsSync(directoryPath) && readdirSync(directoryPath).length === 0) {
        rmSync(directoryPath, { recursive: true, force: true });
      }
    }
  }

  private cleanupEmptyDirectories(startPath: string, stopBeforePath: string): void {
    const resolvedStopPath = path.resolve(stopBeforePath);
    let currentPath = path.resolve(startPath);

    while (currentPath.startsWith(resolvedStopPath) && currentPath !== resolvedStopPath) {
      if (!existsSync(currentPath) || readdirSync(currentPath).length > 0) {
        break;
      }

      rmSync(currentPath, { recursive: true, force: true });
      currentPath = path.dirname(currentPath);
    }
  }
}
