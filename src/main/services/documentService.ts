import type Database from 'better-sqlite3';
import { shell } from 'electron';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { FileStorageService, type ManagedFileInfo } from '@main/services/fileStorageService';
import { nowIso } from '@main/utils/date';
import {
  isDocumentVersionFileRole,
  isDocumentVersionScheme,
  isVersionBumpType,
  type DocumentVersionFileRole,
  type DocumentVersionScheme,
  type VersionBumpType
} from '@shared/documentModel';
import type {
  AddDocumentVersionFilesInput,
  ChangeDocumentVersionFileRoleInput,
  CreateDocumentInput,
  CreateVersionInput,
  DeleteDocumentVersionFileInput,
  DocumentDetail,
  DocumentListItem,
  DocumentStatus,
  DocumentVersion,
  DocumentVersionFile,
  RenameDocumentVersionFileInput,
  UpdateDocumentStatusInput
} from '@shared/types';

interface DocumentListRow {
  Id: number;
  DocumentID: string;
  Title: string;
  DocumentTypeId: number;
  TypeName: string;
  VersionScheme: DocumentVersionScheme;
  Status: DocumentStatus | null;
  LatestVersionLabel: string | null;
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
  VersionScheme: DocumentVersionScheme;
  DocumentFolderPath: string;
  CreatedDate: string;
  ModifiedDate: string;
  Author: string;
}

interface VersionRow {
  Id: number;
  DocumentId: number;
  SequenceNumber: number;
  VersionLabel: string;
  Status: DocumentStatus;
  CreatedDate: string;
  Notes: string;
}

interface VersionFileRow {
  Id: number;
  DocumentVersionId: number;
  Role: DocumentVersionFileRole;
  FileName: string;
  FilePath: string;
  ContentHash: string;
  FileSize: number;
  ModifiedDate: string;
  CreatedDate: string;
}

interface VersionFileContextRow extends VersionFileRow {
  VersionId: number;
  VersionLabel: string;
  DocumentId: number;
}

const FILE_ROLE_SORT_ORDER: DocumentVersionFileRole[] = [
  'working',
  'concept-pdf',
  'final-pdf',
  'other'
];

const latestVersionJoin = `
  LEFT JOIN (
    SELECT DocumentId, MAX(SequenceNumber) AS LatestSequenceNumber
    FROM DocumentVersions
    GROUP BY DocumentId
  ) latest ON latest.DocumentId = d.Id
  LEFT JOIN DocumentVersions dv
    ON dv.DocumentId = latest.DocumentId
    AND dv.SequenceNumber = latest.LatestSequenceNumber
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
            d.VersionScheme,
            dv.Status,
            dv.VersionLabel AS LatestVersionLabel,
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
      versionScheme: row.VersionScheme,
      status: row.Status,
      latestVersionLabel: row.LatestVersionLabel,
      modifiedDate: row.ModifiedDate,
      createdDate: row.CreatedDate,
      author: row.Author
    }));
  }

  getDetail(rootPath: string, documentRecordId: number): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    const unmanagedPathsByVersionId = this.syncDocumentVersions(context, documentRecordId);
    return this.getDetailFromDatabase(context.db, documentRecordId, unmanagedPathsByVersionId);
  }

  create(rootPath: string, input: CreateDocumentInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateDocumentInput(input);

    const insertedDocumentId = context.db.transaction(() => {
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
      this.fileStorageService.ensureDocumentFolder(context.rootPath, documentFolderPath);

      const documentInsert = context.db
        .prepare(
          `
            INSERT INTO Documents (
              DocumentID,
              Title,
              DocumentTypeId,
              VersionScheme,
              DocumentFolderPath,
              CreatedDate,
              ModifiedDate,
              Author
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          documentId,
          input.title.trim(),
          input.documentTypeId,
          input.versionScheme,
          documentFolderPath,
          createdDate,
          createdDate,
          input.author.trim()
        );

      return Number(documentInsert.lastInsertRowid);
    })();

    return this.getDetail(rootPath, insertedDocumentId);
  }

  createVersion(rootPath: string, input: CreateVersionInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertCreateVersionInput(input);

    const documentRecordId = context.db.transaction(() => {
      const document = this.getDocumentRow(context.db, input.documentRecordId);
      const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);
      const createdDate = nowIso();
      const sequenceNumber = (latestVersion?.SequenceNumber ?? 0) + 1;
      const versionLabel = this.getNextVersionLabel(document.VersionScheme, latestVersion, input.bumpType);

      this.fileStorageService.ensureDocumentFolder(context.rootPath, document.DocumentFolderPath);
      this.fileStorageService.ensureVersionFolder(
        context.rootPath,
        context.settings,
        document.DocumentFolderPath,
        versionLabel
      );

      context.db
        .prepare(
          `
            INSERT INTO DocumentVersions (
              DocumentId,
              SequenceNumber,
              VersionLabel,
              Status,
              CreatedDate,
              Notes
            ) VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          document.Id,
          sequenceNumber,
          versionLabel,
          'Draft',
          createdDate,
          input.notes.trim()
        );

      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        createdDate,
        document.Id
      );

      return document.Id;
    })();

    return this.getDetail(rootPath, documentRecordId);
  }

  addVersionFiles(rootPath: string, input: AddDocumentVersionFilesInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertAddVersionFilesInput(input);

    const version = this.getVersionRow(context.db, input.documentVersionId);
    this.assertVersionIsMutable(context.db, version);
    this.syncVersionFilesInternal(context, version);

    const document = this.getDocumentRow(context.db, version.DocumentId);
    const importedFiles: ManagedFileInfo[] = [];

    try {
      const newFiles = this.fileStorageService.importManagedFiles(
        context.rootPath,
        context.settings,
        document.DocumentFolderPath,
        version.VersionLabel,
        input.role,
        input.sourceFilePaths
      );
      importedFiles.push(...newFiles);

      context.db.transaction(() => {
        const createdDate = nowIso();
        const insert = context.db.prepare(
          `
            INSERT INTO DocumentVersionFiles (
              DocumentVersionId,
              Role,
              FileName,
              FilePath,
              ContentHash,
              FileSize,
              ModifiedDate,
              CreatedDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        );

        for (const file of newFiles) {
          insert.run(
            version.Id,
            input.role,
            file.fileName,
            file.relativePath,
            file.contentHash,
            file.fileSize,
            file.modifiedDate,
            createdDate
          );
        }

        context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
          createdDate,
          document.Id
        );
      })();
    } catch (error) {
      for (const file of importedFiles) {
        this.fileStorageService.deleteManagedFile(context.rootPath, file.relativePath);
      }

      throw error;
    }

    return this.syncVersionFiles(rootPath, version.Id);
  }

  renameVersionFile(rootPath: string, input: RenameDocumentVersionFileInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    const document = this.getDocumentRow(context.db, fileRow.DocumentId);
    this.assertVersionIsMutable(context.db, version);
    this.assertRenameInput(input);
    this.syncVersionFilesInternal(context, version);

    const nextRelativePath = this.fileStorageService.getStoredRelativePath(
      context.settings,
      document.DocumentFolderPath,
      version.VersionLabel,
      fileRow.Role,
      input.nextFileName
    );

    const updatedFile = this.fileStorageService.renameManagedFile(
      context.rootPath,
      fileRow.FilePath,
      nextRelativePath
    );

    context.db.transaction(() => {
      context.db
        .prepare(
          `
            UPDATE DocumentVersionFiles
            SET FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
            WHERE Id = ?
          `
        )
        .run(
          updatedFile.fileName,
          updatedFile.relativePath,
          updatedFile.contentHash,
          updatedFile.fileSize,
          updatedFile.modifiedDate,
          input.fileId
        );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        document.Id
      );
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  deleteVersionFile(rootPath: string, input: DeleteDocumentVersionFileInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    this.assertVersionIsMutable(context.db, version);
    this.syncVersionFilesInternal(context, version);

    this.fileStorageService.deleteManagedFile(context.rootPath, fileRow.FilePath);
    context.db.transaction(() => {
      context.db.prepare('DELETE FROM DocumentVersionFiles WHERE Id = ?').run(input.fileId);
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        fileRow.DocumentId
      );
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  changeVersionFileRole(rootPath: string, input: ChangeDocumentVersionFileRoleInput): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    if (!isDocumentVersionFileRole(input.role)) {
      throw new Error('Invalid file role.');
    }

    const fileRow = this.getVersionFileContextRow(context.db, input.fileId);
    const version = this.getVersionRow(context.db, fileRow.VersionId);
    const document = this.getDocumentRow(context.db, fileRow.DocumentId);
    this.assertVersionIsMutable(context.db, version);
    this.syncVersionFilesInternal(context, version);

    const nextRelativePath = this.fileStorageService.getStoredRelativePath(
      context.settings,
      document.DocumentFolderPath,
      version.VersionLabel,
      input.role,
      fileRow.FileName
    );

    const updatedFile =
      this.fileStorageService.normalizeRelativePath(nextRelativePath) ===
      this.fileStorageService.normalizeRelativePath(fileRow.FilePath)
        ? this.fileStorageService.readManagedFileInfo(context.rootPath, fileRow.FilePath)
        : this.fileStorageService.moveManagedFile(context.rootPath, fileRow.FilePath, nextRelativePath);

    context.db.transaction(() => {
      context.db
        .prepare(
          `
            UPDATE DocumentVersionFiles
            SET Role = ?, FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
            WHERE Id = ?
          `
        )
        .run(
          input.role,
          updatedFile.fileName,
          updatedFile.relativePath,
          updatedFile.contentHash,
          updatedFile.fileSize,
          updatedFile.modifiedDate,
          input.fileId
        );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        document.Id
      );
    })();

    return this.syncVersionFiles(rootPath, version.Id);
  }

  syncVersionFiles(rootPath: string, documentVersionId: number): DocumentVersion {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const unmanagedPaths = this.syncVersionFilesInternal(context, version);
    return this.getVersionFromDatabase(context.db, documentVersionId, unmanagedPaths);
  }

  updateStatus(rootPath: string, input: UpdateDocumentStatusInput): DocumentDetail {
    const context = this.workspaceManager.getContext(rootPath);
    this.assertStatus(input.status);

    const latestVersion = this.getLatestVersion(context.db, input.documentRecordId);
    if (!latestVersion) {
      throw new Error('Create a version before changing the document status.');
    }

    context.db.transaction(() => {
      context.db.prepare('UPDATE DocumentVersions SET Status = ? WHERE Id = ?').run(
        input.status,
        latestVersion.Id
      );
      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        nowIso(),
        input.documentRecordId
      );
    })();

    return this.getDetail(rootPath, input.documentRecordId);
  }

  openVersionFile(rootPath: string, fileId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const fileRow = this.getVersionFileContextRow(context.db, fileId);
    this.syncVersionFilesInternal(context, this.getVersionRow(context.db, fileRow.VersionId));

    const refreshed = context.db
      .prepare('SELECT FilePath FROM DocumentVersionFiles WHERE Id = @id')
      .get({ id: fileId }) as { FilePath: string } | undefined;

    if (!refreshed?.FilePath) {
      throw new Error('The selected file could not be found.');
    }

    const resolvedPath = this.fileStorageService.resolveStoredFilePath(context.rootPath, refreshed.FilePath);
    void shell.openPath(resolvedPath);
  }

  openDocumentFolder(rootPath: string, documentRecordId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const document = this.getDocumentRow(context.db, documentRecordId);
    const folderPath = this.fileStorageService.ensureDocumentFolder(
      context.rootPath,
      this.getDocumentFolderPath(context, document)
    );
    void shell.openPath(folderPath);
  }

  openVersionFolder(rootPath: string, documentVersionId: number): void {
    const context = this.workspaceManager.getContext(rootPath);
    const version = this.getVersionRow(context.db, documentVersionId);
    const document = this.getDocumentRow(context.db, version.DocumentId);
    const folderPath = this.fileStorageService.ensureVersionFolder(
      context.rootPath,
      context.settings,
      this.getDocumentFolderPath(context, document),
      version.VersionLabel
    );
    void shell.openPath(folderPath);
  }

  private syncDocumentVersions(
    context: ReturnType<WorkspaceManager['getContext']>,
    documentRecordId: number
  ): Map<number, string[]> {
    const versions = context.db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            SequenceNumber,
            VersionLabel,
            Status,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
        `
      )
      .all({ documentRecordId }) as VersionRow[];

    const unmanagedPathsByVersionId = new Map<number, string[]>();
    for (const version of versions) {
      unmanagedPathsByVersionId.set(version.Id, this.syncVersionFilesInternal(context, version));
    }

    return unmanagedPathsByVersionId;
  }

  private syncVersionFilesInternal(
    context: ReturnType<WorkspaceManager['getContext']>,
    version: VersionRow
  ): string[] {
    const document = this.getDocumentRow(context.db, version.DocumentId);
    const documentFolderPath = this.getDocumentFolderPath(context, document);
    this.fileStorageService.ensureDocumentFolder(context.rootPath, documentFolderPath);
    this.fileStorageService.ensureVersionFolder(
      context.rootPath,
      context.settings,
      documentFolderPath,
      version.VersionLabel
    );

    const versionFolderPath = this.fileStorageService.getVersionFolderRelativePath(
      documentFolderPath,
      version.VersionLabel
    );
    const scanResult = this.fileStorageService.scanVersionFolder(context.rootPath, versionFolderPath);
    const existingRows = this.getVersionFileRows(context.db, version.Id);
    const existingByPath = new Map<string, VersionFileRow>(
      existingRows.map((row) => [this.fileStorageService.normalizeRelativePath(row.FilePath), row])
    );
    const matchedExistingIds = new Set<number>();
    const matchedDiscoveredIndices = new Set<number>();
    const updates: Array<{ row: VersionFileRow; file: ManagedFileInfo }> = [];
    const inserts: Array<{ file: ManagedFileInfo; role: DocumentVersionFileRole }> = [];

    scanResult.files.forEach((file, index) => {
      const exactMatch = existingByPath.get(this.fileStorageService.normalizeRelativePath(file.relativePath));
      if (!exactMatch) {
        return;
      }

      matchedExistingIds.add(exactMatch.Id);
      matchedDiscoveredIndices.add(index);
      updates.push({ row: exactMatch, file });
    });

    const remainingExisting = existingRows.filter((row) => !matchedExistingIds.has(row.Id));
    const remainingDiscovered = scanResult.files
      .map((file, index) => ({ file, index }))
      .filter((item) => !matchedDiscoveredIndices.has(item.index));
    const existingByHash = new Map<string, VersionFileRow[]>();

    for (const row of remainingExisting) {
      const queue = existingByHash.get(row.ContentHash) ?? [];
      queue.push(row);
      existingByHash.set(row.ContentHash, queue);
    }

    for (const discovered of remainingDiscovered) {
      const queue = existingByHash.get(discovered.file.contentHash);
      const hashMatch = queue?.shift();

      if (hashMatch) {
        matchedExistingIds.add(hashMatch.Id);
        updates.push({ row: hashMatch, file: discovered.file });
        continue;
      }

      inserts.push({
        file: discovered.file,
        role: isDocumentVersionFileRole(discovered.file.inferredRole)
          ? discovered.file.inferredRole
          : 'other'
      });
    }

    const deleteIds = existingRows
      .filter((row) => !matchedExistingIds.has(row.Id) && !updates.some((update) => update.row.Id === row.Id))
      .map((row) => row.Id);

    const hasChanges =
      inserts.length > 0 ||
      deleteIds.length > 0 ||
      updates.some(({ row, file }) => this.hasFileMetadataChanges(row, file));

    if (!hasChanges) {
      return scanResult.unmanagedPaths;
    }

    context.db.transaction(() => {
      const insert = context.db.prepare(
        `
          INSERT INTO DocumentVersionFiles (
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      );
      const update = context.db.prepare(
        `
          UPDATE DocumentVersionFiles
          SET Role = ?, FileName = ?, FilePath = ?, ContentHash = ?, FileSize = ?, ModifiedDate = ?
          WHERE Id = ?
        `
      );
      const remove = context.db.prepare('DELETE FROM DocumentVersionFiles WHERE Id = ?');
      const changedDate = nowIso();

      for (const item of inserts) {
        insert.run(
          version.Id,
          item.role,
          item.file.fileName,
          item.file.relativePath,
          item.file.contentHash,
          item.file.fileSize,
          item.file.modifiedDate,
          changedDate
        );
      }

      for (const item of updates) {
        update.run(
          item.row.Role,
          item.file.fileName,
          item.file.relativePath,
          item.file.contentHash,
          item.file.fileSize,
          item.file.modifiedDate,
          item.row.Id
        );
      }

      for (const id of deleteIds) {
        remove.run(id);
      }

      context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
        changedDate,
        document.Id
      );
    })();

    return scanResult.unmanagedPaths;
  }

  private getDetailFromDatabase(
    db: Database.Database,
    documentRecordId: number,
    unmanagedPathsByVersionId: Map<number, string[]>
  ): DocumentDetail {
    const document = this.getDocumentRow(db, documentRecordId);
    const versionRows = db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            SequenceNumber,
            VersionLabel,
            Status,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
        `
      )
      .all({ documentRecordId }) as VersionRow[];
    const fileRows = db
      .prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          FROM DocumentVersionFiles
          WHERE DocumentVersionId IN (
            SELECT Id FROM DocumentVersions WHERE DocumentId = @documentRecordId
          )
        `
      )
      .all({ documentRecordId }) as VersionFileRow[];

    const filesByVersionId = new Map<number, DocumentVersionFile[]>();
    for (const row of fileRows) {
      const versionFiles = filesByVersionId.get(row.DocumentVersionId) ?? [];
      versionFiles.push(this.mapVersionFileRow(row));
      filesByVersionId.set(row.DocumentVersionId, versionFiles);
    }

    const versions: DocumentVersion[] = versionRows.map((row) => ({
      id: row.Id,
      documentId: row.DocumentId,
      sequenceNumber: row.SequenceNumber,
      versionLabel: row.VersionLabel,
      status: row.Status,
      createdDate: row.CreatedDate,
      notes: row.Notes,
      files: this.sortVersionFiles(filesByVersionId.get(row.Id) ?? []),
      unmanagedPaths: unmanagedPathsByVersionId.get(row.Id) ?? []
    }));

    return {
      id: document.Id,
      documentId: document.DocumentID,
      title: document.Title,
      typeId: document.DocumentTypeId,
      typeName: document.TypeName,
      versionScheme: document.VersionScheme,
      documentFolderPath: document.DocumentFolderPath,
      createdDate: document.CreatedDate,
      modifiedDate: document.ModifiedDate,
      author: document.Author,
      versions
    };
  }

  private getVersionFromDatabase(
    db: Database.Database,
    documentVersionId: number,
    unmanagedPaths: string[]
  ): DocumentVersion {
    const version = this.getVersionRow(db, documentVersionId);
    const files = this.getVersionFileRows(db, documentVersionId).map((row) => this.mapVersionFileRow(row));

    return {
      id: version.Id,
      documentId: version.DocumentId,
      sequenceNumber: version.SequenceNumber,
      versionLabel: version.VersionLabel,
      status: version.Status,
      createdDate: version.CreatedDate,
      notes: version.Notes,
      files: this.sortVersionFiles(files),
      unmanagedPaths
    };
  }

  private sortVersionFiles(files: DocumentVersionFile[]): DocumentVersionFile[] {
    return [...files].sort((left, right) => {
      const leftIndex = FILE_ROLE_SORT_ORDER.indexOf(left.role);
      const rightIndex = FILE_ROLE_SORT_ORDER.indexOf(right.role);

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.fileName.localeCompare(right.fileName);
    });
  }

  private mapVersionFileRow(row: VersionFileRow): DocumentVersionFile {
    return {
      id: row.Id,
      documentVersionId: row.DocumentVersionId,
      role: row.Role,
      fileName: row.FileName,
      filePath: row.FilePath,
      contentHash: row.ContentHash,
      fileSize: row.FileSize,
      modifiedDate: row.ModifiedDate,
      createdDate: row.CreatedDate
    };
  }

  private getDocumentFolderPath(
    _context: ReturnType<WorkspaceManager['getContext']>,
    document: DocumentRow
  ): string {
    return document.DocumentFolderPath.trim();
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
            d.VersionScheme,
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

  private getVersionRow(db: Database.Database, documentVersionId: number): VersionRow {
    const version = db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            SequenceNumber,
            VersionLabel,
            Status,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE Id = @documentVersionId
        `
      )
      .get({ documentVersionId }) as VersionRow | undefined;

    if (!version) {
      throw new Error('The selected document version could not be found.');
    }

    return version;
  }

  private getLatestVersion(db: Database.Database, documentRecordId: number): VersionRow | undefined {
    return db
      .prepare(
        `
          SELECT
            Id,
            DocumentId,
            SequenceNumber,
            VersionLabel,
            Status,
            CreatedDate,
            Notes
          FROM DocumentVersions
          WHERE DocumentId = @documentRecordId
          ORDER BY SequenceNumber DESC
          LIMIT 1
        `
      )
      .get({ documentRecordId }) as VersionRow | undefined;
  }

  private getVersionFileRows(db: Database.Database, documentVersionId: number): VersionFileRow[] {
    return db
      .prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath,
            ContentHash,
            FileSize,
            ModifiedDate,
            CreatedDate
          FROM DocumentVersionFiles
          WHERE DocumentVersionId = @documentVersionId
        `
      )
      .all({ documentVersionId }) as VersionFileRow[];
  }

  private getVersionFileContextRow(db: Database.Database, fileId: number): VersionFileContextRow {
    const row = db
      .prepare(
        `
          SELECT
            f.Id,
            f.DocumentVersionId,
            f.Role,
            f.FileName,
            f.FilePath,
            f.ContentHash,
            f.FileSize,
            f.ModifiedDate,
            f.CreatedDate,
            v.Id AS VersionId,
            v.VersionLabel,
            v.DocumentId
          FROM DocumentVersionFiles f
          INNER JOIN DocumentVersions v ON v.Id = f.DocumentVersionId
          WHERE f.Id = @fileId
        `
      )
      .get({ fileId }) as VersionFileContextRow | undefined;

    if (!row) {
      throw new Error('The selected file could not be found.');
    }

    return row;
  }

  private hasFileMetadataChanges(row: VersionFileRow, file: ManagedFileInfo): boolean {
    return (
      row.FileName !== file.fileName ||
      row.FilePath !== file.relativePath ||
      row.ContentHash !== file.contentHash ||
      row.FileSize !== file.fileSize ||
      row.ModifiedDate !== file.modifiedDate
    );
  }

  private getNextVersionLabel(
    scheme: DocumentVersionScheme,
    latestVersion: VersionRow | undefined,
    bumpType: VersionBumpType | undefined
  ): string {
    if (scheme === 'numeric-3') {
      return String((latestVersion?.SequenceNumber ?? 0) + 1).padStart(3, '0');
    }

    if (scheme === 'v-prefix') {
      return `v${(latestVersion?.SequenceNumber ?? 0) + 1}`;
    }

    if (!latestVersion) {
      return '1.0';
    }

    if (!bumpType || !isVersionBumpType(bumpType)) {
      throw new Error('Choose whether the next major-minor version is a major or minor bump.');
    }

    const match = latestVersion.VersionLabel.match(/^(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error('The current major-minor version label could not be parsed.');
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    return bumpType === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
  }

  private assertVersionIsMutable(db: Database.Database, version: VersionRow): void {
    const latestVersion = this.getLatestVersion(db, version.DocumentId);
    if (!latestVersion || latestVersion.Id !== version.Id) {
      throw new Error('Only the latest version can be changed.');
    }
  }

  private assertCreateDocumentInput(input: CreateDocumentInput): void {
    if (!input.title.trim()) {
      throw new Error('Document title is required.');
    }

    if (!input.author.trim()) {
      throw new Error('Author is required.');
    }

    if (!isDocumentVersionScheme(input.versionScheme)) {
      throw new Error('Choose a version scheme for this document.');
    }
  }

  private assertCreateVersionInput(input: CreateVersionInput): void {
    if (typeof input.documentRecordId !== 'number' || input.documentRecordId <= 0) {
      throw new Error('The selected document could not be found.');
    }
  }

  private assertAddVersionFilesInput(input: AddDocumentVersionFilesInput): void {
    if (!isDocumentVersionFileRole(input.role)) {
      throw new Error('Invalid file role.');
    }

    if (input.sourceFilePaths.length === 0) {
      throw new Error('Select at least one file to add.');
    }
  }

  private assertRenameInput(input: RenameDocumentVersionFileInput): void {
    if (!input.nextFileName.trim()) {
      throw new Error('File name is required.');
    }
  }

  private assertStatus(status: string): asserts status is DocumentStatus {
    if (!['Draft', 'In Review', 'Released', 'Archived'].includes(status)) {
      throw new Error('Invalid document status.');
    }
  }
}
