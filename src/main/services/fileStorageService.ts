import {
  chmodSync,
  copyFileSync,
  lstatSync,
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
  DEFAULT_WORKSPACE_SETTINGS,
  buildTemplateFileRelativePath,
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  buildVersionFileRelativePath,
  getDocumentTypeDirectoryRelativePath,
  getRecognizedRoleDirectoryNames,
  getTemplateFolderRelativePath,
  isRecognizedRoleDirectoryName,
  sanitizeStoragePathSegment,
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

interface FilesystemEventGuard {
  suppressEvents(rootPath: string, durationMs?: number): void;
  pauseWatching?(rootPath: string): void;
  resumeWatching?(rootPath: string): void;
}

export class FileStorageService {
  constructor(private readonly filesystemEventGuard?: FilesystemEventGuard) {}

  getWorkspaceDocumentsDirectory(
    rootPath: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return path.join(rootPath, settings.documentsDirectoryName);
  }

  getWorkspaceTemplatesDirectory(
    rootPath: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return path.join(rootPath, settings.templatesDirectoryName);
  }

  ensureTemplatesDirectory(
    rootPath: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    const directoryPath = this.getWorkspaceTemplatesDirectory(rootPath, settings);
    this.suppressFilesystemEvents(rootPath);
    mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }

  getDocumentTypeDirectory(
    rootPath: string,
    documentTypeName: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return path.join(rootPath, ...getDocumentTypeDirectoryRelativePath(settings, documentTypeName).split('/'));
  }

  ensureDocumentTypeDirectory(
    rootPath: string,
    documentTypeName: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    const directoryPath = this.getDocumentTypeDirectory(rootPath, documentTypeName, settings);
    this.suppressFilesystemEvents(rootPath);
    mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }

  ensureDocumentTypeDirectories(
    rootPath: string,
    documentTypeNames: string[],
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
    for (const documentTypeName of documentTypeNames) {
      this.ensureDocumentTypeDirectory(rootPath, documentTypeName, settings);
    }
  }

  getTemplateFolderRelativePath(
    templateId: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return getTemplateFolderRelativePath(settings, templateId);
  }

  getTemplateFolderAbsolutePath(
    rootPath: string,
    templateId: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return this.resolveStoredFilePath(rootPath, this.getTemplateFolderRelativePath(templateId, settings), true);
  }

  ensureTemplateFolder(
    rootPath: string,
    templateId: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId, settings);
    this.suppressFilesystemEvents(rootPath);
    mkdirSync(templateFolderAbsolutePath, { recursive: true });
    return templateFolderAbsolutePath;
  }

  getTemplateStoredRelativePath(
    templateId: string,
    fileName: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): string {
    return buildTemplateFileRelativePath(
      this.getTemplateFolderRelativePath(templateId, settings),
      sanitizeStoragePathSegment(path.basename(fileName), 'document.bin')
    );
  }

  importTemplateFiles(
    rootPath: string,
    templateId: string,
    sourceFilePaths: string[],
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): ManagedFileInfo[] {
    if (sourceFilePaths.length === 0) {
      return [];
    }

    this.suppressFilesystemEvents(rootPath);
    this.ensureTemplateFolder(rootPath, templateId, settings);

    return sourceFilePaths.map((sourceFilePath) => {
      if (!existsSync(sourceFilePath)) {
        throw new Error('Selected source file could not be found.');
      }

      const fileName = sanitizeStoragePathSegment(path.basename(sourceFilePath), 'document.bin');
      const relativePath = this.getTemplateStoredRelativePath(templateId, fileName, settings);
      const absolutePath = this.resolveStoredFilePath(rootPath, relativePath, true);
      mkdirSync(path.dirname(absolutePath), { recursive: true });

      if (existsSync(absolutePath)) {
        throw new Error(`A file named "${fileName}" already exists in this template.`);
      }

      copyFileSync(sourceFilePath, absolutePath);
      return this.readManagedFileInfo(rootPath, relativePath);
    });
  }

  listTemplateFiles(
    rootPath: string,
    templateId: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): TemplateStoredFile[] {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId, settings);
    if (!existsSync(templateFolderAbsolutePath)) {
      return [];
    }

    return readdirSync(templateFolderAbsolutePath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        this.readManagedFileInfo(
          rootPath,
          this.normalizeRelativePath(path.posix.join(this.getTemplateFolderRelativePath(templateId, settings), entry.name))
        )
      )
      .sort((left, right) => left.fileName.localeCompare(right.fileName));
  }

  deleteTemplateFolder(
    rootPath: string,
    templateId: string,
    settings: Pick<WorkspaceSettings, 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
    const templateFolderAbsolutePath = this.getTemplateFolderAbsolutePath(rootPath, templateId, settings);

    if (existsSync(templateFolderAbsolutePath)) {
      this.withFilesystemWatchPaused(rootPath, () => {
        this.suppressFilesystemEvents(rootPath, 1500);
        this.removeDirectoryWithRetries(templateFolderAbsolutePath);
      });
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
    this.suppressFilesystemEvents(rootPath);
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
    this.suppressFilesystemEvents(rootPath);
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

    this.suppressFilesystemEvents(rootPath);
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
    this.suppressFilesystemEvents(rootPath);
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

    if (!existsSync(versionFolderAbsolutePath)) {
      return {
        files: [],
        unmanagedPaths: []
      };
    }

    const versionFolderStats = lstatSync(versionFolderAbsolutePath);
    if (versionFolderStats.isSymbolicLink() || !versionFolderStats.isDirectory()) {
      return {
        files: [],
        unmanagedPaths: [normalizedVersionFolderPath]
      };
    }

    const files: DiscoveredVersionFile[] = [];
    const unmanagedPaths: string[] = [];
    const entries = readdirSync(versionFolderAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (this.isHiddenFilesystemEntryName(entry.name)) {
        continue;
      }

      const entryRelativePath = this.normalizeRelativePath(
        path.posix.join(normalizedVersionFolderPath, entry.name)
      );
      const entryAbsolutePath = path.join(versionFolderAbsolutePath, entry.name);
      const entryStats = lstatSync(entryAbsolutePath);

      if (entryStats.isSymbolicLink()) {
        unmanagedPaths.push(entryRelativePath);
        continue;
      }

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
        unmanagedPaths.push(...this.listImmediateUnmanagedChildren(entryAbsolutePath, entryRelativePath));
        continue;
      }

      const roleEntries = readdirSync(entryAbsolutePath, { withFileTypes: true });
      for (const roleEntry of roleEntries) {
        if (this.isHiddenFilesystemEntryName(roleEntry.name)) {
          continue;
        }

        const roleRelativePath = this.normalizeRelativePath(
          path.posix.join(entryRelativePath, roleEntry.name)
        );
        const roleEntryAbsolutePath = path.join(entryAbsolutePath, roleEntry.name);
        const roleEntryStats = lstatSync(roleEntryAbsolutePath);

        if (roleEntryStats.isSymbolicLink()) {
          unmanagedPaths.push(roleRelativePath);
          continue;
        }

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

  private listImmediateUnmanagedChildren(directoryAbsolutePath: string, directoryRelativePath: string): string[] {
    const nestedPaths: string[] = [];

    for (const entry of readdirSync(directoryAbsolutePath, { withFileTypes: true })) {
      if (this.isHiddenFilesystemEntryName(entry.name)) {
        continue;
      }

      nestedPaths.push(
        this.normalizeRelativePath(path.posix.join(directoryRelativePath, entry.name))
      );
    }

    return nestedPaths;
  }

  renameManagedFile(rootPath: string, currentRelativePath: string, nextRelativePath: string): ManagedFileInfo {
    const currentAbsolutePath = this.resolveStoredFilePath(rootPath, currentRelativePath);
    const nextAbsolutePath = this.resolveStoredFilePath(rootPath, nextRelativePath, true);
    this.suppressFilesystemEvents(rootPath);
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
    this.suppressFilesystemEvents(rootPath);
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
      this.suppressFilesystemEvents(rootPath);
      rmSync(absolutePath, { force: true });
    }

    this.cleanupEmptyRoleDirectory(path.dirname(absolutePath));
  }

  deleteVersionFolder(
    rootPath: string,
    documentFolderPath: string,
    versionLabel: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
    const versionFolderAbsolutePath = this.getVersionFolderAbsolutePath(
      rootPath,
      documentFolderPath,
      versionLabel
    );

    if (existsSync(versionFolderAbsolutePath)) {
      this.withFilesystemWatchPaused(rootPath, () => {
        this.suppressFilesystemEvents(rootPath, 1500);
        this.removeDirectoryWithRetries(versionFolderAbsolutePath);
      });
    }

    this.cleanupEmptyDirectories(
      path.dirname(versionFolderAbsolutePath),
      this.getWorkspaceDocumentsDirectory(rootPath, settings)
    );
  }

  deleteDocumentFolder(
    rootPath: string,
    documentFolderPath: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
    const documentFolderAbsolutePath = this.getDocumentFolderAbsolutePath(
      rootPath,
      documentFolderPath
    );

    if (existsSync(documentFolderAbsolutePath)) {
      this.withFilesystemWatchPaused(rootPath, () => {
        this.suppressFilesystemEvents(rootPath, 1500);
        this.removeDirectoryWithRetries(documentFolderAbsolutePath);
      });
    }

    this.cleanupEmptyDirectories(
      path.dirname(documentFolderAbsolutePath),
      this.getWorkspaceDocumentsDirectory(rootPath, settings)
    );
  }

  resolveStoredFilePath(rootPath: string, relativePath: string, allowMissing = false): string {
    const normalized = this.normalizeRelativePath(relativePath);
    if (!normalized || path.isAbsolute(relativePath)) {
      throw new Error('Managed paths must be workspace-relative paths.');
    }

    const resolvedRootPath = path.resolve(rootPath);
    const resolvedPath = path.resolve(rootPath, normalized);
    const relativeToRoot = path.relative(resolvedRootPath, resolvedPath);

    if (
      relativeToRoot === '' ||
      relativeToRoot === '.' ||
      relativeToRoot.startsWith('..') ||
      path.isAbsolute(relativeToRoot)
    ) {
      throw new Error('Managed paths must stay inside the workspace folder.');
    }

    this.assertPathChainIsSafe(resolvedRootPath, resolvedPath, allowMissing);

    if (allowMissing || existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return resolvedPath;
  }

  moveDocumentFolder(
    rootPath: string,
    currentDocumentFolderPath: string,
    nextDocumentFolderPath: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
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

    this.withFilesystemWatchPaused(rootPath, () => {
      mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });
      this.suppressFilesystemEvents(rootPath, 1500);
      renameSync(currentAbsolutePath, nextAbsolutePath);
      this.cleanupEmptyDirectories(
        path.dirname(currentAbsolutePath),
        this.getWorkspaceDocumentsDirectory(rootPath, settings)
      );
    });
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

  private suppressFilesystemEvents(rootPath: string, durationMs = 750): void {
    this.filesystemEventGuard?.suppressEvents(rootPath, durationMs);
  }

  private withFilesystemWatchPaused<T>(rootPath: string, action: () => T): T {
    this.filesystemEventGuard?.pauseWatching?.(rootPath);

    try {
      return action();
    } finally {
      this.filesystemEventGuard?.resumeWatching?.(rootPath);
    }
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

    this.removeDirectoryWithRetries(directoryPath, true);
  }

  private cleanupEmptyDirectories(startPath: string, stopBeforePath: string): void {
    const resolvedStopPath = path.resolve(stopBeforePath);
    let currentPath = path.resolve(startPath);

    while (currentPath.startsWith(resolvedStopPath) && currentPath !== resolvedStopPath) {
      if (!existsSync(currentPath) || readdirSync(currentPath).length > 0) {
        break;
      }

      this.removeDirectoryWithRetries(currentPath, true);
      currentPath = path.dirname(currentPath);
    }
  }

  private removeDirectoryWithRetries(directoryPath: string, bestEffort = false): void {
    const maxRetries = process.platform === 'win32' ? 12 : 10;
    const retryDelay = process.platform === 'win32' ? 100 : 80;
    const removeDirectory = (): void => {
      rmSync(directoryPath, {
        recursive: true,
        force: true,
        maxRetries,
        retryDelay
      });
    };

    try {
      removeDirectory();
    } catch (error) {
      this.makePathWritableRecursively(directoryPath);

      try {
        removeDirectory();
        return;
      } catch (retryError) {
        if (bestEffort) {
          return;
        }

        throw retryError;
      }
    }
  }

  private makePathWritableRecursively(targetPath: string): void {
    if (!existsSync(targetPath)) {
      return;
    }

    let stats;
    try {
      stats = lstatSync(targetPath);
    } catch {
      return;
    }

    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      for (const entry of readdirSync(targetPath)) {
        this.makePathWritableRecursively(path.join(targetPath, entry));
      }

      try {
        chmodSync(targetPath, 0o777);
      } catch {
        // Best-effort only. The subsequent delete still gets a chance to run.
      }

      return;
    }

    try {
      chmodSync(targetPath, 0o666);
    } catch {
      // Best-effort only. The subsequent delete still gets a chance to run.
    }
  }

  private assertPathChainIsSafe(rootPath: string, resolvedPath: string, allowMissing: boolean): void {
    let currentPath = rootPath;
    const normalizedTarget = path.resolve(resolvedPath);
    const normalizedRoot = path.resolve(rootPath);

    if (!normalizedTarget.startsWith(normalizedRoot)) {
      throw new Error('Managed paths must stay inside the workspace folder.');
    }

    const relativeToRoot = path.relative(normalizedRoot, normalizedTarget);
    if (!relativeToRoot) {
      throw new Error('Managed paths must point to a file or folder inside the workspace.');
    }

    for (const segment of relativeToRoot.split(path.sep)) {
      currentPath = path.join(currentPath, segment);
      if (!existsSync(currentPath)) {
        if (allowMissing) {
          return;
        }

        break;
      }

      const stats = lstatSync(currentPath);
      if (stats.isSymbolicLink()) {
        throw new Error('Managed paths cannot use symbolic links or junctions.');
      }
    }
  }

  private isHiddenFilesystemEntryName(name: string): boolean {
    return name.startsWith('.') && name !== '.' && name !== '..';
  }
}
