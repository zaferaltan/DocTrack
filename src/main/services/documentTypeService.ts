import type { WorkspaceManager } from '@main/database/workspaceManager';
import { FileStorageService } from '@main/services/fileStorageService';
import type { DocumentType, DocumentTypeInput } from '@shared/types';

const normalizeName = (value: string): string => value.trim();
const normalizePrefix = (value: string): string => value.trim();

export class DocumentTypeService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly fileStorageService: FileStorageService
  ) {}

  list(rootPath: string): DocumentType[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY NumberPrefix ASC, Name ASC')
      .all() as Array<{ Id: number; Name: string; NumberPrefix: string }>;

    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      numberPrefix: row.NumberPrefix
    }));
  }

  create(rootPath: string, input: DocumentTypeInput): DocumentType {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    const numberPrefix = normalizePrefix(input.numberPrefix);

    if (!name) {
      throw new Error('Document type name is required.');
    }

    if (!/^\d{2}$/.test(numberPrefix)) {
      throw new Error('Document type prefix must be exactly 2 digits.');
    }

    const result = context.db
      .prepare('INSERT INTO DocumentTypes (Name, NumberPrefix) VALUES (?, ?)')
      .run(name, numberPrefix);
    this.fileStorageService.ensureDocumentTypeDirectory(context.rootPath, name, context.settings);

    return {
      id: Number(result.lastInsertRowid),
      name,
      numberPrefix
    };
  }

  update(rootPath: string, id: number, input: DocumentTypeInput): DocumentType {
    const context = this.workspaceManager.getContext(rootPath);
    const name = normalizeName(input.name);
    const numberPrefix = normalizePrefix(input.numberPrefix);

    if (!name) {
      throw new Error('Document type name is required.');
    }

    if (!/^\d{2}$/.test(numberPrefix)) {
      throw new Error('Document type prefix must be exactly 2 digits.');
    }

    const result = context.db
      .prepare('UPDATE DocumentTypes SET Name = ?, NumberPrefix = ? WHERE Id = ?')
      .run(name, numberPrefix, id);

    if (result.changes === 0) {
      throw new Error('Document type could not be found.');
    }

    this.fileStorageService.ensureDocumentTypeDirectory(context.rootPath, name, context.settings);

    return {
      id,
      name,
      numberPrefix
    };
  }

  delete(rootPath: string, id: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const documentsUsingType = context.db
      .prepare('SELECT COUNT(*) AS total FROM Documents WHERE DocumentTypeId = @id')
      .get({ id }) as { total: number } | undefined;

    if ((documentsUsingType?.total ?? 0) > 0) {
      throw new Error('This document type is already used by documents and cannot be deleted.');
    }

    const result = context.db.prepare('DELETE FROM DocumentTypes WHERE Id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Document type could not be found.');
    }
  }
}
