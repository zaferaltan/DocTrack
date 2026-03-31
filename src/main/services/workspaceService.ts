import type Database from 'better-sqlite3';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import type { WorkspaceContext, WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { FileStorageService } from '@main/services/fileStorageService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { nowIso } from '@main/utils/date';
import { DOCUMENT_STATUSES } from '@shared/types';
import type { DocumentType, OpenWorkspaceResult, WorkspaceCreateInput } from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  isDocumentIdFormatPreset,
  normalizeDocumentIdFormatTemplate,
  resolveDocumentIdFormatTemplate,
  isWorkspaceFileOrganizationMode,
  isWorkspaceStorageLayoutPreset,
  isWorkspaceVersionManagementMode,
  normalizeVisibleDocumentColumns,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

const STARTER_TYPES: Array<{ name: string; numberPrefix: string }> = [
  { name: 'Specification', numberPrefix: '01' },
  { name: 'Procedure', numberPrefix: '02' },
  { name: 'Report', numberPrefix: '03' }
];

export class WorkspaceService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly documentService: DocumentService,
    private readonly fileStorageService: FileStorageService,
    private readonly workspaceCatalogService: WorkspaceCatalogService,
    private readonly catalogService: AppCatalogService,
    private readonly documentIdGenerator: DocumentIdGeneratorService
  ) {}

  create(input: WorkspaceCreateInput): OpenWorkspaceResult {
    this.assertDocumentIdTemplateIsValid(this.normalizeWorkspaceSettings(input.settings));
    const context = this.workspaceManager.createWorkspace(input, (workspaceContext) => {
      this.seedStarterTypes(workspaceContext.db);
      this.ensureDocumentTypeDirectories(workspaceContext);
      if (input.includeExampleData ?? true) {
        this.seedExampleData(workspaceContext);
      }
    });

    this.catalogService.touchRecentWorkspace({
      rootPath: context.rootPath,
      name: context.workspace.name
    });

    return this.getSummary(context.rootPath);
  }

  open(rootPath: string): OpenWorkspaceResult {
    const context = this.workspaceManager.openWorkspace(rootPath);
    this.catalogService.touchRecentWorkspace({
      rootPath: context.rootPath,
      name: context.workspace.name
    });
    return this.getSummary(rootPath);
  }

  close(rootPath: string) {
    return this.workspaceManager.closeWorkspace(rootPath);
  }

  listOpen() {
    return this.workspaceManager.listOpenWorkspaces();
  }

  listRecent() {
    return this.catalogService.listRecentWorkspaces();
  }

  getSummary(rootPath: string, warnings: string[] = []): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const typeRows = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY NumberPrefix ASC')
      .all() as Array<{ Id: number; Name: string; NumberPrefix: string }>;

    return {
      workspace: context.workspace,
      summary: {
        workspace: context.workspace,
        settings: context.settings,
        documents: this.documentService.list(rootPath),
        documentTypes: this.mapTypeRows(typeRows),
        projects: this.workspaceCatalogService.listProjects(rootPath),
        confidentialityClasses: this.workspaceCatalogService.listConfidentialityClasses(rootPath),
        languages: this.workspaceCatalogService.listLanguages(rootPath),
        statuses: [...DOCUMENT_STATUSES]
      },
      warnings
    };
  }

  updateSettings(rootPath: string, settings: WorkspaceSettings): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const nextSettings = this.normalizeWorkspaceSettings(settings);
    this.assertDocumentIdTemplateIsValid(nextSettings);
    const requiresStorageMigration =
      context.settings.storageLayoutPreset !== nextSettings.storageLayoutPreset ||
      context.settings.fileOrganizationMode !== nextSettings.fileOrganizationMode;

    if (this.areWorkspaceSettingsEqual(context.settings, nextSettings)) {
      return this.getSummary(rootPath);
    }

    const warnings = requiresStorageMigration
      ? this.migrateWorkspaceStorageLayout(context, nextSettings)
      : [];

    this.persistWorkspaceSettings(context, nextSettings);
    context.settings = nextSettings;
    this.ensureDocumentTypeDirectories(context);
    return this.getSummary(rootPath, warnings);
  }

  private mapTypeRows(rows: Array<{ Id: number; Name: string; NumberPrefix: string }>): DocumentType[] {
    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      numberPrefix: row.NumberPrefix
    }));
  }

  private seedStarterTypes(db: Database.Database): void {
    const insert = db.prepare('INSERT OR IGNORE INTO DocumentTypes (Name, NumberPrefix) VALUES (?, ?)');

    for (const type of STARTER_TYPES) {
      insert.run(type.name, type.numberPrefix);
    }
  }

  private persistWorkspaceSettings(context: WorkspaceContext, settings: WorkspaceSettings): void {
    context.db
      .prepare(
        `
          UPDATE Workspaces
          SET
            StorageLayoutPreset = ?,
            FileOrganizationMode = ?,
            VersionManagementMode = ?,
            DocumentIdFormatPreset = ?,
            DocumentIdFormatTemplate = ?,
            VisibleDocumentColumns = ?,
            DefaultCompany = ?,
            DefaultDepartment = ?,
            AutoMarkPreviousVersionObsolete = ?
          WHERE Id = 1
        `
      )
      .run(
        settings.storageLayoutPreset,
        settings.fileOrganizationMode,
        settings.versionManagementMode,
        settings.documentIdFormatPreset,
        settings.documentIdFormatTemplate,
        JSON.stringify(settings.visibleDocumentColumns),
        settings.defaultCompany,
        settings.defaultDepartment,
        settings.autoMarkPreviousVersionObsolete ? 1 : 0
      );
  }

  private areWorkspaceSettingsEqual(left: WorkspaceSettings, right: WorkspaceSettings): boolean {
    return (
      left.storageLayoutPreset === right.storageLayoutPreset &&
      left.fileOrganizationMode === right.fileOrganizationMode &&
      left.versionManagementMode === right.versionManagementMode &&
      left.documentIdFormatPreset === right.documentIdFormatPreset &&
      left.documentIdFormatTemplate === right.documentIdFormatTemplate &&
      left.defaultCompany === right.defaultCompany &&
      left.defaultDepartment === right.defaultDepartment &&
      left.autoMarkPreviousVersionObsolete === right.autoMarkPreviousVersionObsolete &&
      left.visibleDocumentColumns.length === right.visibleDocumentColumns.length &&
      left.visibleDocumentColumns.every((column, index) => column === right.visibleDocumentColumns[index])
    );
  }

  private ensureDocumentTypeDirectories(context: WorkspaceContext): void {
    const typeNames = context.db
      .prepare('SELECT Name FROM DocumentTypes ORDER BY NumberPrefix ASC, Name ASC')
      .all() as Array<{ Name: string }>;

    this.fileStorageService.ensureDocumentTypeDirectories(
      context.rootPath,
      typeNames.map((type) => type.Name)
    );
  }

  private migrateWorkspaceStorageLayout(
    context: WorkspaceContext,
    nextSettings: WorkspaceSettings
  ): string[] {
    const versionRows = context.db
      .prepare('SELECT Id FROM DocumentVersions ORDER BY Id ASC')
      .all() as Array<{ Id: number }>;
    const warnings: string[] = [];

    for (const versionRow of versionRows) {
      const version = this.documentService.syncVersionFiles(context.rootPath, versionRow.Id);
      if (version.unmanagedPaths.length > 0) {
        warnings.push(
          `Version ${version.versionLabel} contains unmanaged paths: ${version.unmanagedPaths.join(', ')}`
        );
      }
    }

    const documentRows = context.db
      .prepare(
        `
          SELECT
            d.Id,
            d.DocumentID,
            d.Title,
            d.DocumentFolderPath,
            dt.Name AS TypeName
          FROM Documents d
          INNER JOIN DocumentTypes dt ON dt.Id = d.DocumentTypeId
          ORDER BY d.Id ASC
        `
      )
      .all() as Array<{
      Id: number;
      DocumentID: string;
      Title: string;
      DocumentFolderPath: string;
      TypeName: string;
    }>;
    const dbVersionRows = context.db
      .prepare('SELECT Id, DocumentId, VersionLabel FROM DocumentVersions ORDER BY Id ASC')
      .all() as Array<{ Id: number; DocumentId: number; VersionLabel: string }>;
    const fileRows = context.db
      .prepare(
        `
          SELECT
            Id,
            DocumentVersionId,
            Role,
            FileName,
            FilePath
          FROM DocumentVersionFiles
          ORDER BY Id ASC
        `
      )
      .all() as Array<{
      Id: number;
      DocumentVersionId: number;
      Role: 'working' | 'concept-pdf' | 'final-pdf' | 'other';
      FileName: string;
      FilePath: string;
    }>;

    const documentMoves = documentRows.map((documentRow) => ({
      documentId: documentRow.Id,
      currentFolderPath: documentRow.DocumentFolderPath.trim(),
      nextFolderPath: this.fileStorageService.getDocumentFolderRelativePath(
        nextSettings,
        documentRow.TypeName,
        documentRow.DocumentID,
        documentRow.Title
      )
    }));
    const documentMoveById = new Map(documentMoves.map((move) => [move.documentId, move]));
    const versionById = new Map(dbVersionRows.map((versionRow) => [versionRow.Id, versionRow]));
    const fileMoves = fileRows.map((fileRow) => {
      const versionRow = versionById.get(fileRow.DocumentVersionId);
      if (!versionRow) {
        throw new Error('A version file is missing its version record.');
      }

      const documentMove = documentMoveById.get(versionRow.DocumentId);
      if (!documentMove) {
        throw new Error('A version file is missing its document record.');
      }

      const rewrittenCurrentFilePath = this.rewriteRelativePathPrefix(
        fileRow.FilePath,
        documentMove.currentFolderPath,
        documentMove.nextFolderPath
      );
      const nextFilePath = this.fileStorageService.getStoredRelativePath(
        nextSettings,
        documentMove.nextFolderPath,
        versionRow.VersionLabel,
        fileRow.Role,
        fileRow.FileName
      );

      return {
        fileId: fileRow.Id,
        currentFilePath: rewrittenCurrentFilePath,
        nextFilePath
      };
    });

    const seenNextPaths = new Map<string, number>();
    for (const move of fileMoves) {
      const normalizedNextPath = this.fileStorageService.normalizeRelativePath(move.nextFilePath);
      const existingFileId = seenNextPaths.get(normalizedNextPath);
      if (existingFileId && existingFileId !== move.fileId) {
        throw new Error(
          `Workspace migration would create two files at "${normalizedNextPath}". Resolve the filename collision first.`
        );
      }

      seenNextPaths.set(normalizedNextPath, move.fileId);
    }

    const appliedDocumentMoves: Array<{ currentFolderPath: string; nextFolderPath: string }> = [];
    const appliedFileMoves: Array<{ currentFilePath: string; nextFilePath: string }> = [];

    try {
      for (const move of documentMoves) {
        if (move.currentFolderPath === move.nextFolderPath) {
          continue;
        }

        this.fileStorageService.moveDocumentFolder(
          context.rootPath,
          move.currentFolderPath,
          move.nextFolderPath
        );
        appliedDocumentMoves.push(move);
      }

      for (const move of fileMoves) {
        if (move.currentFilePath === move.nextFilePath) {
          continue;
        }

        this.fileStorageService.moveManagedFile(
          context.rootPath,
          move.currentFilePath,
          move.nextFilePath
        );
        appliedFileMoves.push(move);
      }

      context.db.transaction(() => {
        context.db
          .prepare(
            `
              UPDATE Workspaces
              SET StorageLayoutPreset = ?, FileOrganizationMode = ?
              WHERE Id = 1
            `
          )
          .run(nextSettings.storageLayoutPreset, nextSettings.fileOrganizationMode);

        for (const move of documentMoves) {
          context.db
            .prepare('UPDATE Documents SET DocumentFolderPath = ? WHERE Id = ?')
            .run(move.nextFolderPath, move.documentId);
        }

        for (const move of fileMoves) {
          context.db
            .prepare('UPDATE DocumentVersionFiles SET FilePath = ? WHERE Id = ?')
            .run(move.nextFilePath, move.fileId);
        }
      })();
    } catch (error) {
      for (const move of appliedFileMoves.reverse()) {
        try {
          this.fileStorageService.moveManagedFile(
            context.rootPath,
            move.nextFilePath,
            move.currentFilePath
          );
        } catch {
          break;
        }
      }

      for (const move of appliedDocumentMoves.reverse()) {
        try {
          this.fileStorageService.moveDocumentFolder(
            context.rootPath,
            move.nextFolderPath,
            move.currentFolderPath
          );
        } catch {
          break;
        }
      }

      throw error;
    }

    return warnings;
  }

  private seedExampleData(context: WorkspaceContext): void {
    const types = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY NumberPrefix ASC')
      .all() as Array<{ Id: number; Name: string; NumberPrefix: string }>;

    if (types.length === 0) {
      return;
    }

    const transaction = context.db.transaction(() => {
      this.createSeedDocument(context, {
        title: 'Quality Manual',
        author: 'Avery Chen',
        prefix: '01',
        versions: [
          {
            versionLabel: '001',
            sequenceNumber: 1,
            status: 'Draft',
            notes: 'Initial scope and process baseline.',
            role: 'working',
            fileName: 'quality-manual.docx',
            content: 'Quality manual working draft.'
          }
        ]
      });

      this.createSeedDocument(context, {
        title: 'Internal Audit Procedure',
        author: 'Jordan Singh',
        prefix: '02',
        versions: [
          {
            versionLabel: '001',
            sequenceNumber: 1,
            status: 'In Review',
            notes: 'Drafted for review by QA leads.',
            role: 'working',
            fileName: 'audit-procedure.docx',
            content: 'Version 001 working document.'
          },
          {
            versionLabel: '002',
            sequenceNumber: 2,
            status: 'Released',
            notes: 'Approved release after stakeholder review.',
            role: 'final-pdf',
            fileName: 'audit-procedure.pdf',
            content: 'Released version PDF.'
          }
        ]
      });

      this.createSeedDocument(context, {
        title: 'Supplier Assessment Report',
        author: 'Morgan Ellis',
        prefix: '03',
        versions: [
          {
            versionLabel: '001',
            sequenceNumber: 1,
            status: 'Archived',
            notes: 'Historical supplier baseline report.',
            role: 'final-pdf',
            fileName: 'supplier-report.pdf',
            content: 'Archived supplier report.'
          }
        ]
      });
    });

    transaction.immediate();
  }

  private createSeedDocument(
    context: WorkspaceContext,
    input: {
      title: string;
      author: string;
      prefix: string;
      versions: Array<{
        versionLabel: string;
        sequenceNumber: number;
        status: 'Draft' | 'In Review' | 'Released' | 'Archived' | 'Obsolete';
        notes: string;
        role: 'working' | 'concept-pdf' | 'final-pdf' | 'other';
        fileName: string;
        content: string;
      }>;
    }
  ): void {
    const type = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes WHERE NumberPrefix = @prefix')
      .get({ prefix: input.prefix }) as { Id: number; Name: string; NumberPrefix: string } | undefined;

    if (!type) {
      return;
    }

    const createdDate = nowIso();
    const company = context.settings.defaultCompany;
    const department = context.settings.defaultDepartment;
    const documentId = this.documentIdGenerator.generateNextDocumentId(context.db, context.settings, {
      numberPrefix: type.NumberPrefix,
      documentTypeName: type.Name,
      createdDate,
      title: input.title,
      author: input.author,
      company,
      department
    });
    const documentFolderPath = this.fileStorageService.getDocumentFolderRelativePath(
      context.settings,
      type.Name,
      documentId,
      input.title
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
            Author,
            Company,
            Department
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        documentId,
        input.title,
        type.Id,
        'numeric-3',
        documentFolderPath,
        createdDate,
        createdDate,
        input.author,
        company,
        department
      );

    const documentRecordId = Number(documentInsert.lastInsertRowid);
    const insertVersion = context.db.prepare(
      `
        INSERT INTO DocumentVersions (
          DocumentId,
          VersionDocumentID,
          SequenceNumber,
          VersionLabel,
          Status,
          CreatedDate,
          Notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    );
    const insertFile = context.db.prepare(
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

    let currentVersionDocumentId = documentId;

    for (const [index, version] of input.versions.entries()) {
      if (
        context.settings.versionManagementMode === 'version-specific-document-id' &&
        index > 0
      ) {
        currentVersionDocumentId = this.documentIdGenerator.generateNextDocumentId(
          context.db,
          context.settings,
          {
            numberPrefix: type.NumberPrefix,
            documentTypeName: type.Name,
            createdDate,
            title: input.title,
            author: input.author,
            company,
            department
          }
        );
      }

      const versionInsert = insertVersion.run(
        documentRecordId,
        currentVersionDocumentId,
        version.sequenceNumber,
        version.versionLabel,
        version.status,
        createdDate,
        version.notes
      );
      const versionRecordId = Number(versionInsert.lastInsertRowid);
      const storedFile = this.fileStorageService.writeManagedTextFile(
        context.rootPath,
        context.settings,
        documentFolderPath,
        version.versionLabel,
        version.role,
        version.fileName,
        version.content
      );

      insertFile.run(
        versionRecordId,
        version.role,
        storedFile.fileName,
        storedFile.relativePath,
        storedFile.contentHash,
        storedFile.fileSize,
        storedFile.modifiedDate,
        createdDate
      );
    }
  }

  private normalizeWorkspaceSettings(settings: WorkspaceSettings): WorkspaceSettings {
    if (
      !isWorkspaceStorageLayoutPreset(settings.storageLayoutPreset) ||
      !isWorkspaceFileOrganizationMode(settings.fileOrganizationMode) ||
      !isWorkspaceVersionManagementMode(settings.versionManagementMode) ||
      !isDocumentIdFormatPreset(settings.documentIdFormatPreset)
    ) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: settings.storageLayoutPreset,
      fileOrganizationMode: settings.fileOrganizationMode,
      versionManagementMode: settings.versionManagementMode,
      documentIdFormatPreset: settings.documentIdFormatPreset,
      documentIdFormatTemplate: normalizeDocumentIdFormatTemplate(
        settings.documentIdFormatTemplate,
        settings.documentIdFormatPreset
      ),
      visibleDocumentColumns: normalizeVisibleDocumentColumns(settings.visibleDocumentColumns),
      defaultCompany: typeof settings.defaultCompany === 'string' ? settings.defaultCompany.trim() : '',
      defaultDepartment:
        typeof settings.defaultDepartment === 'string' ? settings.defaultDepartment.trim() : '',
      autoMarkPreviousVersionObsolete:
        typeof settings.autoMarkPreviousVersionObsolete === 'boolean'
          ? settings.autoMarkPreviousVersionObsolete
          : DEFAULT_WORKSPACE_SETTINGS.autoMarkPreviousVersionObsolete
    };
  }

  private assertDocumentIdTemplateIsValid(settings: WorkspaceSettings): void {
    this.documentIdGenerator.validateTemplate(resolveDocumentIdFormatTemplate(settings));
  }

  private rewriteRelativePathPrefix(
    relativePath: string,
    currentFolderPath: string,
    nextFolderPath: string
  ): string {
    const normalizedRelativePath = this.fileStorageService.normalizeRelativePath(relativePath);
    const normalizedCurrentFolderPath = this.fileStorageService.normalizeRelativePath(currentFolderPath);
    const normalizedNextFolderPath = this.fileStorageService.normalizeRelativePath(nextFolderPath);
    const prefix = `${normalizedCurrentFolderPath}/`;

    if (!normalizedRelativePath.startsWith(prefix)) {
      return normalizedRelativePath;
    }

    return `${normalizedNextFolderPath}/${normalizedRelativePath.slice(prefix.length)}`;
  }
}
