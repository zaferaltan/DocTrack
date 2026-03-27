import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
}
