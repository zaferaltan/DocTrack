import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildTemplateFileRelativePath,
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  buildVersionFileRelativePath,
  getDocumentTypeDirectoryRelativePath,
  getRecognizedRoleDirectoryNames,
  getTemplateFolderRelativePath,
  isRecognizedRoleDirectoryName,
  sanitizeStoragePathSegment,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

export interface ManagedFileInfo {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  contentHash: string;
  fileSize: number;
  modifiedDate: string;
}

export interface DiscoveredVersionFile extends ManagedFileInfo {
  inferredRole: string;
}

export interface VersionFolderScanResult {
  files: DiscoveredVersionFile[];
  unmanagedPaths: string[];
}

export type TemplateStoredFile = ManagedFileInfo;

export class FileStorageService {
  getWorkspaceDocumentsDirectory(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME);
  }

  getWorkspaceTemplatesDirectory(rootPath: string): string {
    return path.join(rootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME);
  }

  ensureTemplatesDirectory(rootPath: string): string {
    const directoryPath = this.getWorkspaceTemplatesDirectory(rootPath);
    mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
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

  getTemplateFolderRelativePath(templateId: string): string {
    return getTemplateFolderRelativePath(templateId);
  }

  getTemplateFolderAbsolutePath(rootPath: string, templateId: string): string {
    return this.resolveStoredFilePath(rootPath, this.getTemplateFolderRelativePath(templateId), true);
  }

  ensureTemplateFolder(rootPath: string, templateId: string): string {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId);
    mkdirSync(templateFolderAbsolutePath, { recursive: true });
    return templateFolderAbsolutePath;
  }

  getTemplateStoredRelativePath(templateId: string, fileName: string): string {
    return buildTemplateFileRelativePath(
      this.getTemplateFolderRelativePath(templateId),
      sanitizeStoragePathSegment(path.basename(fileName), 'document.bin')
    );
  }

  importTemplateFiles(
    rootPath: string,
    templateId: string,
    sourceFilePaths: string[]
  ): ManagedFileInfo[] {
    if (sourceFilePaths.length === 0) {
      return [];
    }

    this.ensureTemplateFolder(rootPath, templateId);

    return sourceFilePaths.map((sourceFilePath) => {
      if (!existsSync(sourceFilePath)) {
        throw new Error('Selected source file could not be found.');
      }

      const fileName = sanitizeStoragePathSegment(path.basename(sourceFilePath), 'document.bin');
      const relativePath = this.getTemplateStoredRelativePath(templateId, fileName);
      const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
      mkdirSync(path.dirname(absolutePath), { recursive: true });

      if (existsSync(absolutePath)) {
        throw new Error(`A file named "${fileName}" already exists in this template.`);
      }

      copyFileSync(sourceFilePath, absolutePath);
      return this.readManagedFileInfo(rootPath, relativePath);
    });
  }

  listTemplateFiles(rootPath: string, templateId: string): TemplateStoredFile[] {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId);
    if (!existsSync(templateFolderAbsolutePath)) {
      return [];
    }

    return readdirSync(templateFolderAbsolutePath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        this.readManagedFileInfo(
          rootPath,
          this.normalizeRelativePath(path.posix.join(this.getTemplateFolderRelativePath(templateId), entry.name))
        )
      )
      .sort((left, right) => left.fileName.localeCompare(right.fileName));
  }

  deleteTemplateFolder(rootPath: string, templateId: string): void {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId);

    if (existsSync(templateFolderAbsolutePath)) {
      rmSync(templateFolderAbsolutePath, { recursive: true, force: true });
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

  getDocumentFolderAbsolutePath(rootPath: string, documentFolderPath: string): string {
    return this.resolveStoredFilePath(rootPath, documentFolderPath, true);
  }

  ensureDocumentFolder(rootPath: string, documentFolderPath: string): string {
    const documentFolderAbsolutePath = this.getDocumentFolderAbsolutePath(rootPath, documentFolderPath);
    mkdirSync(documentFolderAbsolutePath, { recursive: true });
    return documentFolderAbsolutePath;
  }

  getVersionFolderRelativePath(documentFolderPath: string, versionLabel: string): string {
    return buildDocumentVersionRelativePath(documentFolderPath, versionLabel);
  }

  getVersionFolderAbsolutePath(
    rootPath: string,
    documentFolderPath: string,
    versionLabel: string
  ): string {
    return this.resolveStoredFilePath(
      rootPath,
      this.getVersionFolderRelativePath(documentFolderPath, versionLabel),
      true
    );
  }

  ensureVersionFolder(
    rootPath: string,
    settings: WorkspaceSettings,
    documentFolderPath: string,
    versionLabel: string
  ): string {
    const versionFolderPath = this.getVersionFolderAbsolutePath(rootPath, documentFolderPath, versionLabel);
    mkdirSync(versionFolderPath, { recursive: true });

    if (settings.fileOrganizationMode === 'role-subfolders') {
      for (const roleDirectoryName of getRecognizedRoleDirectoryNames()) {
        mkdirSync(path.join(versionFolderPath, roleDirectoryName), { recursive: true });
      }
    }

    return versionFolderPath;
  }

  getStoredRelativePath(
    settings: WorkspaceSettings,
    documentFolderPath: string,
    versionLabel: string,
    role: string,
    fileName: string
  ): string {
    const versionFolderPath = this.getVersionFolderRelativePath(documentFolderPath, versionLabel);
    return buildVersionFileRelativePath(
      settings,
      versionFolderPath,
      role,
      sanitizeStoragePathSegment(path.basename(fileName), 'document.bin')
    );
  }

  importManagedFiles(
    rootPath: string,
    settings: WorkspaceSettings,
    documentFolderPath: string,
    versionLabel: string,
    role: string,
    sourceFilePaths: string[]
  ): ManagedFileInfo[] {
    if (sourceFilePaths.length === 0) {
      return [];
    }

    this.ensureVersionFolder(rootPath, settings, documentFolderPath, versionLabel);

    return sourceFilePaths.map((sourceFilePath) => {
      if (!existsSync(sourceFilePath)) {
        throw new Error('Selected source file could not be found.');
      }

      const fileName = sanitizeStoragePathSegment(path.basename(sourceFilePath), 'document.bin');
      const relativePath = this.getStoredRelativePath(
        settings,
        documentFolderPath,
        versionLabel,
        role,
        fileName
      );
      const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
      mkdirSync(path.dirname(absolutePath), { recursive: true });

      if (existsSync(absolutePath)) {
        throw new Error(`A file named "${fileName}" already exists in this version folder.`);
      }

      copyFileSync(sourceFilePath, absolutePath);
      return this.readManagedFileInfo(rootPath, relativePath);
    });
  }

  writeManagedTextFile(
    rootPath: string,
    settings: WorkspaceSettings,
    documentFolderPath: string,
    versionLabel: string,
    role: string,
    fileName: string,
    content: string
  ): ManagedFileInfo {
    this.ensureVersionFolder(rootPath, settings, documentFolderPath, versionLabel);
    const relativePath = this.getStoredRelativePath(
      settings,
      documentFolderPath,
      versionLabel,
      role,
      fileName
    );
    const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
    return this.readManagedFileInfo(rootPath, relativePath);
  }

  readManagedFileInfo(rootPath: string, relativePath: string): ManagedFileInfo {
    const absolutePath = this.resolveStoredFilePath(rootPath, relativePath);
    const stats = statSync(absolutePath);

    return {
      absolutePath,
      relativePath: this.normalizeRelativePath(relativePath),
      fileName: path.basename(absolutePath),
      contentHash: this.hashFile(absolutePath),
      fileSize: stats.size,
      modifiedDate: new Date(stats.mtimeMs).toISOString()
    };
  }

  scanVersionFolder(rootPath: string, versionFolderPath: string): VersionFolderScanResult {
    const normalizedVersionFolderPath = this.normalizeRelativePath(versionFolderPath);
    const versionFolderAbsolutePath = this.resolveStoredFilePath(rootPath, normalizedVersionFolderPath, true);
    mkdirSync(versionFolderAbsolutePath, { recursive: true });

    const files: DiscoveredVersionFile[] = [];
    const unmanagedPaths: string[] = [];
    const entries = readdirSync(versionFolderAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = this.normalizeRelativePath(
        path.posix.join(normalizedVersionFolderPath, entry.name)
      );
      const entryAbsolutePath = path.join(versionFolderAbsolutePath, entry.name);

      if (entry.isFile()) {
        files.push(this.createDiscoveredFile(rootPath, entryRelativePath, 'other'));
        continue;
      }

      if (!entry.isDirectory()) {
        unmanagedPaths.push(entryRelativePath);
        continue;
      }

      if (!isRecognizedRoleDirectoryName(entry.name)) {
        unmanagedPaths.push(entryRelativePath);
        continue;
      }

      const roleEntries = readdirSync(entryAbsolutePath, { withFileTypes: true });
      for (const roleEntry of roleEntries) {
        const roleRelativePath = this.normalizeRelativePath(
          path.posix.join(entryRelativePath, roleEntry.name)
        );

        if (roleEntry.isFile()) {
          files.push(this.createDiscoveredFile(rootPath, roleRelativePath, entry.name));
          continue;
        }

        unmanagedPaths.push(roleRelativePath);
      }
    }

    return {
      files,
      unmanagedPaths: unmanagedPaths.sort((left, right) => left.localeCompare(right))
    };
  }

  renameManagedFile(rootPath: string, currentRelativePath: string, nextRelativePath: string): ManagedFileInfo {
    const currentAbsolutePath = this.resolveStoredFilePath(rootPath, currentRelativePath);
    const nextAbsolutePath = this.resolveStoredFilePath(rootPath, nextRelativePath, true);
    mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });

    if (existsSync(nextAbsolutePath)) {
      throw new Error(`A file named "${path.basename(nextAbsolutePath)}" already exists.`);
    }

    renameSync(currentAbsolutePath, nextAbsolutePath);
    this.cleanupEmptyRoleDirectory(path.dirname(currentAbsolutePath));
    return this.readManagedFileInfo(rootPath, nextRelativePath);
  }

  moveManagedFile(rootPath: string, currentRelativePath: string, nextRelativePath: string): ManagedFileInfo {
    const currentAbsolutePath = this.resolveStoredFilePath(rootPath, currentRelativePath);
    const nextAbsolutePath = this.resolveStoredFilePath(rootPath, nextRelativePath, true);
    mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });

    if (
      this.normalizeRelativePath(currentRelativePath) !== this.normalizeRelativePath(nextRelativePath) &&
      existsSync(nextAbsolutePath)
    ) {
      throw new Error(`A file named "${path.basename(nextAbsolutePath)}" already exists.`);
    }

    renameSync(currentAbsolutePath, nextAbsolutePath);
    this.cleanupEmptyRoleDirectory(path.dirname(currentAbsolutePath));
    return this.readManagedFileInfo(rootPath, nextRelativePath);
  }

  deleteManagedFile(rootPath: string, relativePath: string): void {
    const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);

    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true });
    }

    this.cleanupEmptyRoleDirectory(path.dirname(absolutePath));
  }

  deleteVersionFolder(
    rootPath: string,
    documentFolderPath: string,
    versionLabel: string
  ): void {
    const versionFolderAbsolutePath = this.getVersionFolderAbsolutePath(
      rootPath,
      documentFolderPath,
      versionLabel
    );

    if (existsSync(versionFolderAbsolutePath)) {
      rmSync(versionFolderAbsolutePath, { recursive: true, force: true });
    }

    this.cleanupEmptyDirectories(
      path.dirname(versionFolderAbsolutePath),
      this.getWorkspaceDocumentsDirectory(rootPath)
    );
  }

  deleteDocumentFolder(rootPath: string, documentFolderPath: string): void {
    const documentFolderAbsolutePath = this.getDocumentFolderAbsolutePath(
      rootPath,
      documentFolderPath
    );

    if (existsSync(documentFolderAbsolutePath)) {
      rmSync(documentFolderAbsolutePath, { recursive: true, force: true });
    }

    this.cleanupEmptyDirectories(
      path.dirname(documentFolderAbsolutePath),
      this.getWorkspaceDocumentsDirectory(rootPath)
    );
  }

  resolveStoredFilePath(rootPath: string, relativePath: string, allowMissing = false): string {
    const normalized = this.normalizeRelativePath(relativePath);
    const resolvedPath = path.resolve(rootPath, normalized);

    if (allowMissing || existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return resolvedPath;
  }

  moveDocumentFolder(rootPath: string, currentDocumentFolderPath: string, nextDocumentFolderPath: string): void {
    const normalizedCurrent = this.normalizeRelativePath(currentDocumentFolderPath);
    const normalizedNext = this.normalizeRelativePath(nextDocumentFolderPath);

    if (normalizedCurrent === normalizedNext) {
      return;
    }

    const currentAbsolutePath = this.resolveStoredFilePath(rootPath, normalizedCurrent);
    const nextAbsolutePath = this.resolveStoredFilePath(rootPath, normalizedNext, true);

    if (!existsSync(currentAbsolutePath)) {
      throw new Error('A managed document folder could not be found on disk during layout migration.');
    }

    if (existsSync(nextAbsolutePath)) {
      throw new Error('A target document folder already exists, so the workspace layout could not be migrated.');
    }

    mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });
    renameSync(currentAbsolutePath, nextAbsolutePath);
    this.cleanupEmptyDirectories(path.dirname(currentAbsolutePath), this.getWorkspaceDocumentsDirectory(rootPath));
  }

  cleanupEmptyRoleDirectoriesInVersionFolder(rootPath: string, versionFolderPath: string): void {
    const versionFolderAbsolutePath = this.resolveStoredFilePath(rootPath, versionFolderPath, true);

    if (!existsSync(versionFolderAbsolutePath)) {
      return;
    }

    for (const entry of readdirSync(versionFolderAbsolutePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isRecognizedRoleDirectoryName(entry.name)) {
        continue;
      }

      this.cleanupEmptyRoleDirectory(path.join(versionFolderAbsolutePath, entry.name));
    }
  }

  normalizeRelativePath(relativePath: string): string {
    return relativePath.split(/[\\/]/).join('/').replace(/^[/\\]+|[/\\]+$/g, '');
  }

  private createDiscoveredFile(
    rootPath: string,
    relativePath: string,
    inferredRole: string
  ): DiscoveredVersionFile {
    const fileInfo = this.readManagedFileInfo(rootPath, relativePath);
    return {
      ...fileInfo,
      inferredRole
    };
  }

  private hashFile(absolutePath: string): string {
    const hash = createHash('sha256');
    hash.update(readFileSync(absolutePath));
    return hash.digest('hex');
  }

  private cleanupEmptyRoleDirectory(directoryPath: string): void {
    if (!existsSync(directoryPath)) {
      return;
    }

    const directoryName = path.basename(directoryPath);
    if (readdirSync(directoryPath).length > 0 || !isRecognizedRoleDirectoryName(directoryName)) {
      return;
    }

    rmSync(directoryPath, { recursive: true, force: true });
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
