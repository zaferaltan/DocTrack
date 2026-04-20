import type { WorkspaceManager } from '@main/database/workspaceManager';
import { FileStorageService } from '@main/services/fileStorageService';
import { getDocumentTypeDirectoryRelativePath } from '@shared/workspaceLayout';
import type { DocumentType, DocumentTypeInput } from '@shared/types';

const normalizeName = (value: string): string => value.trim();
const normalizePrefix = (value: string): string => value.trim();

const rewritePathPrefix = (relativePath: string, oldPrefix: string, newPrefix: string): string => {
  const normalizedPath = relativePath.split(/[\\/]/).join('/').replace(/^[/\\]+|[/\\]+$/g, '');
  const normalizedOld = oldPrefix.split(/[\\/]/).join('/').replace(/^[/\\]+|[/\\]+$/g, '');
  const normalizedNew = newPrefix.split(/[\\/]/).join('/').replace(/^[/\\]+|[/\\]+$/g, '');
  const prefix = `${normalizedOld}/`;
  if (!normalizedPath.startsWith(prefix)) return normalizedPath;
  return `${normalizedNew}/${normalizedPath.slice(prefix.length)}`;
};

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

    const existingType = context.db
      .prepare('SELECT Name FROM DocumentTypes WHERE Id = ?')
      .get(id) as { Name: string } | undefined;

    if (!existingType) {
      throw new Error('Document type could not be found.');
    }

    const oldFolderPath = getDocumentTypeDirectoryRelativePath(context.settings, existingType.Name);
    const newFolderPath = getDocumentTypeDirectoryRelativePath(context.settings, name);
    const folderPathChanged =
      this.fileStorageService.normalizeRelativePath(oldFolderPath) !==
      this.fileStorageService.normalizeRelativePath(newFolderPath);

    if (folderPathChanged) {
      // Rename the folder BEFORE DB update so we can roll back on failure.
      this.fileStorageService.renameDocumentTypeDirectory(
        context.rootPath,
        existingType.Name,
        name,
        context.settings
      );
    }

    try {
      context.db.transaction(() => {
        const result = context.db
          .prepare('UPDATE DocumentTypes SET Name = ?, NumberPrefix = ? WHERE Id = ?')
          .run(name, numberPrefix, id);

        if (result.changes === 0) {
          throw new Error('Document type could not be found.');
        }

        if (folderPathChanged) {
          const documents = context.db
            .prepare('SELECT Id, DocumentFolderPath FROM Documents WHERE DocumentTypeId = ?')
            .all(id) as Array<{ Id: number; DocumentFolderPath: string }>;

          const updateDocFolder = context.db.prepare(
            'UPDATE Documents SET DocumentFolderPath = ? WHERE Id = ?'
          );
          const updateFilePath = context.db.prepare(
            'UPDATE DocumentVersionFiles SET FilePath = ? WHERE Id = ?'
          );

          for (const doc of documents) {
            const newDocFolderPath = rewritePathPrefix(doc.DocumentFolderPath, oldFolderPath, newFolderPath);
            updateDocFolder.run(newDocFolderPath, doc.Id);

            const fileRows = context.db
              .prepare(
                `SELECT f.Id, f.FilePath
                 FROM DocumentVersionFiles f
                 INNER JOIN DocumentVersions v ON v.Id = f.DocumentVersionId
                 WHERE v.DocumentId = ?`
              )
              .all(doc.Id) as Array<{ Id: number; FilePath: string }>;

            for (const file of fileRows) {
              updateFilePath.run(rewritePathPrefix(file.FilePath, oldFolderPath, newFolderPath), file.Id);
            }
          }
        }
      })();
    } catch (error) {
      if (folderPathChanged) {
        try {
          this.fileStorageService.renameDocumentTypeDirectory(
            context.rootPath,
            name,
            existingType.Name,
            context.settings
          );
        } catch {
          // Rollback failed — surface the original error.
        }
      }
      throw error;
    }

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

    const existingType = context.db
      .prepare('SELECT Name FROM DocumentTypes WHERE Id = ?')
      .get(id) as { Name: string } | undefined;

    if (!existingType) {
      throw new Error('Document type could not be found.');
    }

    const result = context.db.prepare('DELETE FROM DocumentTypes WHERE Id = ?').run(id);
    if (result.changes === 0) {
      throw new Error('Document type could not be found.');
    }

    this.fileStorageService.deleteDocumentTypeDirectory(
      context.rootPath,
      existingType.Name,
      context.settings
    );
  }
}
