import { existsSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { shell } from 'electron';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { FileStorageService } from '@main/services/fileStorageService';
import { nowIso } from '@main/utils/date';
import type {
  CreateDocumentInput,
  CreateVersionInput,
  DocumentDetail,
  DocumentListItem,
  DocumentStatus,
  DocumentVersion,
  UpdateDocumentStatusInput
} from '@shared/types';

interface DocumentListRow {
  Id: number;
  DocumentID: string;
  Title: string;
  DocumentTypeId: number;
  TypeName: string;
  Status: DocumentStatus;
  LatestVersion: number;
  ModifiedDate: string;
  CreatedDate: string;
  Author: string;
}

interface DocumentRow {
  Id: number;
  DocumentID: string;
  Title: string;
  DocumentTypeId: number;
  TypeName: string;
  DocumentFolderPath: string;
  CreatedDate: string;
  ModifiedDate: string;
  Author: string;
}

interface VersionRow {
  Id: number;
  DocumentId: number;
  VersionNumber: number;
  Status: DocumentStatus;
  FilePath: string;
  CreatedDate: string;
  Notes: string;
}

const latestVersionJoin = `
  INNER JOIN (
    SELECT DocumentId, MAX(VersionNumber) AS LatestVersionNumber
    FROM DocumentVersions
    GROUP BY DocumentId
  ) latest ON latest.DocumentId = d.Id
  INNER JOIN DocumentVersions dv
    ON dv.DocumentId = latest.DocumentId
    AND dv.VersionNumber = latest.LatestVersionNumber
`;

export class DocumentService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly documentIdGenerator: DocumentIdGeneratorService,
    private readonly fileStorageService: FileStorageService
  ) {}

  list(rootPath: string): DocumentListItem[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare(
        `
          SELECT
            d.Id,
            d.DocumentID,
            d.Title,
            d.DocumentTypeId,
            dt.Name AS TypeName,
            dv.Status,
            dv.VersionNumber AS LatestVersion,
            d.ModifiedDate,
            d.CreatedDate,
            d.Author
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          ${latestVersionJoin}
          ORDER BY d.ModifiedDate DESC, d.DocumentID ASC
        `
      )
      .all() as DocumentListRow[];

    return rows.map((row) => ({
      id: row.Id,
      documentId: row.DocumentID,
      title: row.Title,
      typeId: row.DocumentTypeId,
      typeName: row.TypeName,
      status: row.Status,
      latestVersion: row.LatestVersion,
      modifiedDate: row.ModifiedDate,
      createdDate: row.CreatedDate,
      author: row.Author
    }));
  }

  getDetail(rootPath: string, documentRecordId: number): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    return this.getDetailFromDatabase(context.db, documentRecordId);
  }

  create(rootPath: string, input: CreateDocumentInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateDocumentInput(input);

    let copiedAbsolutePath: string | null = null;
    let insertedDocumentId = 0;
    const transaction = context.db.transaction(() => {
      const type = context.db
        .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes WHERE Id = @id')
        .get({ id: input.documentTypeId }) as
        | { Id: number; Name: string; NumberPrefix: string }
        | undefined;

      if (!type) {
        throw new Error('The selected document type could not be found.');
      }

      const createdDate = nowIso();
      const documentId = this.documentIdGenerator.generateNextDocumentId(
        context.db,
        type.NumberPrefix,
        createdDate
      );
      const documentFolderPath = this.fileStorageService.getDocumentFolderRelativePath(
        context.settings,
        type.Name,
        documentId,
        input.title.trim()
      );
      const storedFile = this.fileStorageService.copyManagedFile(
        context.rootPath,
        documentFolderPath,
        1,
        input.sourceFilePath
      );
      copiedAbsolutePath = storedFile.absolutePath;

      const documentInsert = context.db
        .prepare(
          `
            INSERT INTO Documents (
              DocumentID,
              Title,
              DocumentTypeId,
              DocumentFolderPath,
              CreatedDate,
              ModifiedDate,
              Author
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          documentId,
          input.title.trim(),
          input.documentTypeId,
          documentFolderPath,
          createdDate,
          createdDate,
          input.author.trim()
        );

      insertedDocumentId = Number(documentInsert.lastInsertRowid);

      context.db
        .prepare(
          `
            INSERT INTO DocumentVersions (
              DocumentId,
              VersionNumber,
              Status,
              FilePath,
              CreatedDate,
              Notes
            ) VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          insertedDocumentId,
          1,
          'Draft',
          storedFile.relativePath,
          createdDate,
          input.notes.trim()
        );
    });

    try {
      transaction.immediate();
      return this.getDetail(rootPath, insertedDocumentId);
    } catch (error) {
      if (copiedAbsolutePath) {
        this.fileStorageService.cleanupManagedPath(copiedAbsolutePath);
      }
      throw error;
    }
  }

  createVersion(rootPath: string, input: CreateVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateVersionInput(input);

    let copiedAbsolutePath: string | null = null;
    const transaction = context.db.transaction(() => {
      const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);

      if (!latestVersion) {
        throw new Error('The selected document could not be found.');
      }

      const document = this.getDocumentRow(context.db, input.documentRecordId);
      const nextVersionNumber = latestVersion.VersionNumber + 1;
      const createdDate = nowIso();
      const documentFolderPath = this.getDocumentFolderPath(context, document);
      const storedFile = this.fileStorageService.copyManagedFile(
        context.rootPath,
        documentFolderPath,
        nextVersionNumber,
        input.sourceFilePath
      );
      copiedAbsolutePath = storedFile.absolutePath;

      context.db
        .prepare(
          `
            INSERT INTO DocumentVersions (
              DocumentId,
              VersionNumber,
              Status,
              FilePath,
              CreatedDate,
              Notes
            ) VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          input.documentRecordId,
          nextVersionNumber,
          latestVersion.Status,
          storedFile.relativePath,
          createdDate,
          input.notes.trim()
        );

      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        createdDate,
        input.documentRecordId
      );
    });

    try {
      transaction.immediate();
      return this.getDetail(rootPath, input.documentRecordId);
    } catch (error) {
      if (copiedAbsolutePath) {
        this.fileStorageService.cleanupManagedPath(copiedAbsolutePath);
      }
      throw error;
    }
  }

  updateStatus(rootPath: string, input: UpdateDocumentStatusInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertStatus(input.status);

    const transaction = context.db.transaction(() => {
      const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);

      if (!latestVersion) {
        throw new Error('The selected document could not be found.');
      }

      const modifiedDate = nowIso();
      context.db.prepare('UPDATE DocumentVersions SET Status = ? WHERE Id = ?').run(
        input.status,
        latestVersion.Id
      );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        modifiedDate,
        input.documentRecordId
      );
    });

    transaction.immediate();
    return this.getDetail(rootPath, input.documentRecordId);
  }

  openFile(rootPath: string, documentVersionId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const version = context.db
      .prepare('SELECT FilePath FROM DocumentVersions WHERE Id = @id')
      .get({ id: documentVersionId }) as { FilePath: string | null } | undefined;

    if (!version?.FilePath) {
      throw new Error('The selected file could not be found.');
    }

    const resolvedPath = this.fileStorageService.resolveStoredFilePath(context.rootPath, version.FilePath);
    if (!existsSync(resolvedPath)) {
      throw new Error('The managed document file could not be found on disk.');
    }

    void shell.openPath(resolvedPath);
  }

  private getDetailFromDatabase(db: Database.Database, documentRecordId: number): DocumentDetail {
    const document = this.getDocumentRow(db, documentRecordId);
    const versionRows = db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionNumber,
            Status,
            FilePath,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY VersionNumber DESC
        `
      )
      .all({ documentRecordId }) as VersionRow[];

    const versions: DocumentVersion[] = versionRows.map((row) => ({
      id: row.Id,
      documentId: row.DocumentId,
      versionNumber: row.VersionNumber,
      status: row.Status,
      filePath: row.FilePath,
      createdDate: row.CreatedDate,
      notes: row.Notes
    }));

    return {
      id: document.Id,
      documentId: document.DocumentID,
      title: document.Title,
      typeId: document.DocumentTypeId,
      typeName: document.TypeName,
      createdDate: document.CreatedDate,
      modifiedDate: document.ModifiedDate,
      author: document.Author,
      versions
    };
  }

  private getDocumentFolderPath(
    context: ReturnType<WorkspaceManager['getContext']>,
    document: DocumentRow
  ): string {
    if (document.DocumentFolderPath.trim()) {
      return document.DocumentFolderPath;
    }

    return this.fileStorageService.getDocumentFolderRelativePath(
      context.settings,
      document.TypeName,
      document.DocumentID,
      document.Title
    );
  }

  private getDocumentRow(db: Database.Database, documentRecordId: number): DocumentRow {
    const document = db
      .prepare(
        `
          SELECT
            d.Id,
            d.DocumentID,
            d.Title,
            d.DocumentTypeId,
            dt.Name AS TypeName,
            d.DocumentFolderPath,
            d.CreatedDate,
            d.ModifiedDate,
            d.Author
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          WHERE d.Id = @documentRecordId
        `
      )
      .get({ documentRecordId }) as DocumentRow | undefined;

    if (!document) {
      throw new Error('The selected document could not be found.');
    }

    return document;
  }

  private getLatestVersion(db: Database.Database, documentRecordId: number): VersionRow | undefined {
    return db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            VersionNumber,
            Status,
            FilePath,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY VersionNumber DESC
          LIMIT 1
        `
      )
      .get({ documentRecordId }) as VersionRow | undefined;
  }

  private assertCreateDocumentInput(input: CreateDocumentInput): void {
    if (!input.title.trim()) {
      throw new Error('Document title is required.');
    }

    if (!input.author.trim()) {
      throw new Error('Author is required.');
    }

    if (!input.sourceFilePath.trim()) {
      throw new Error('Please select a file to upload.');
    }
  }

  private assertCreateVersionInput(input: CreateVersionInput): void {
    if (!input.sourceFilePath.trim()) {
      throw new Error('Please select a file to upload.');
    }
  }

  private assertStatus(status: string): asserts status is DocumentStatus {
    if (!['Draft', 'In Review', 'Released', 'Archived'].includes(status)) {
      throw new Error('Invalid document status.');
    }
  }
}
