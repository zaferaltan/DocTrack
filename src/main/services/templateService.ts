import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import type {
  AddTemplateFilesInput,
  CreateTemplateInput,
  TemplateSummary
} from '@shared/types';
import { sanitizeStoragePathSegment } from '@shared/workspaceLayout';
import { FileStorageService } from '@main/services/fileStorageService';

const sortTemplates = (left: TemplateSummary, right: TemplateSummary): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });

export class TemplateService {
  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly workspaceManager: WorkspaceManager
  ) {}

  list(rootPath: string): TemplateSummary[] {
    const { settings } = this.workspaceManager.getContext(rootPath);
    const templatesDirectoryPath = this.fileStorageService.ensureTemplatesDirectory(rootPath, settings);

    return readdirSync(templatesDirectoryPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.get(rootPath, entry.name))
      .sort(sortTemplates);
  }

  get(rootPath: string, templateId: string): TemplateSummary {
    const { settings } = this.workspaceManager.getContext(rootPath);
    const normalizedTemplateId = this.normalizeTemplateId(templateId);
    const templateFolderPath = this.fileStorageService.getTemplateFolderAbsolutePath(
      rootPath,
      normalizedTemplateId,
      settings
    );

    if (!existsSync(templateFolderPath)) {
      throw new Error('The selected template could not be found.');
    }

    const files = this.fileStorageService.listTemplateFiles(rootPath, normalizedTemplateId, settings).map((file) => ({
      fileName: file.fileName,
      filePath: file.relativePath,
      fileSize: file.fileSize,
      modifiedDate: file.modifiedDate
    }));
    const modifiedDate =
      files.reduce<string | null>(
        (latest, file) => (!latest || file.modifiedDate > latest ? file.modifiedDate : latest),
        null
      ) ?? null;

    return {
      id: normalizedTemplateId,
      name: normalizedTemplateId,
      folderPath: this.fileStorageService.getTemplateFolderRelativePath(normalizedTemplateId, settings),
      fileCount: files.length,
      modifiedDate,
      files
    };
  }

  create(rootPath: string, input: CreateTemplateInput): TemplateSummary {
    const { settings } = this.workspaceManager.getContext(rootPath);
    const normalizedTemplateId = this.normalizeTemplateId(input.name);
    const absolutePath = this.fileStorageService.getTemplateFolderAbsolutePath(rootPath, normalizedTemplateId, settings);

    if (existsSync(absolutePath)) {
      throw new Error('A template with that name already exists.');
    }

    this.fileStorageService.ensureTemplateFolder(rootPath, normalizedTemplateId, settings);
    return this.get(rootPath, normalizedTemplateId);
  }

  addFiles(rootPath: string, input: AddTemplateFilesInput): TemplateSummary {
    const { settings } = this.workspaceManager.getContext(rootPath);
    const normalizedTemplateId = this.normalizeTemplateId(input.templateId);

    if (input.sourceFilePaths.length === 0) {
      throw new Error('Select at least one file to add.');
    }

    const absolutePath = this.fileStorageService.getTemplateFolderAbsolutePath(rootPath, normalizedTemplateId, settings);
    if (!existsSync(absolutePath)) {
      throw new Error('The selected template could not be found.');
    }

    this.fileStorageService.importTemplateFiles(
      rootPath,
      normalizedTemplateId,
      input.sourceFilePaths,
      settings
    );

    return this.get(rootPath, normalizedTemplateId);
  }

  delete(rootPath: string, templateId: string): void {
    const { settings } = this.workspaceManager.getContext(rootPath);
    const normalizedTemplateId = this.normalizeTemplateId(templateId);
    const absolutePath = this.fileStorageService.getTemplateFolderAbsolutePath(rootPath, normalizedTemplateId, settings);

    if (!existsSync(absolutePath)) {
      throw new Error('The selected template could not be found.');
    }

    this.fileStorageService.deleteTemplateFolder(rootPath, normalizedTemplateId, settings);
  }

  private normalizeTemplateId(value: string): string {
    const normalized = sanitizeStoragePathSegment(value.trim(), '');
    if (!normalized) {
      throw new Error('Template name is required.');
    }

    return path.basename(normalized);
  }
}
