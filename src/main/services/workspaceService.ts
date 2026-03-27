import type Database from 'better-sqlite3';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import type { WorkspaceContext, WorkspaceManager } from '@main/database/workspaceManager';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { FileStorageService } from '@main/services/fileStorageService';
import { nowIso } from '@main/utils/date';
import { DOCUMENT_STATUSES } from '@shared/types';
import type { DocumentType, OpenWorkspaceResult, WorkspaceCreateInput } from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  isWorkspaceStorageLayoutPreset,
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
    private readonly catalogService: AppCatalogService,
    private readonly documentIdGenerator: DocumentIdGeneratorService
  ) {}

  create(input: WorkspaceCreateInput): OpenWorkspaceResult {
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

  getSummary(rootPath: string): OpenWorkspaceResult {
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
        statuses: [...DOCUMENT_STATUSES]
      }
    };
  }

  updateSettings(rootPath: string, settings: WorkspaceSettings): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const nextSettings = this.normalizeWorkspaceSettings(settings);
    context.db
      .prepare('UPDATE Workspaces SET StorageLayoutPreset = ? WHERE Id = 1')
      .run(nextSettings.storageLayoutPreset);
    context.settings = nextSettings;
    return this.getSummary(rootPath);
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

  private ensureDocumentTypeDirectories(context: WorkspaceContext): void {
    const typeNames = context.db
      .prepare('SELECT Name FROM DocumentTypes ORDER BY NumberPrefix ASC, Name ASC')
      .all() as Array<{ Name: string }>;

    this.fileStorageService.ensureDocumentTypeDirectories(
      context.rootPath,
      typeNames.map((type) => type.Name)
    );
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
            versionNumber: 1,
            status: 'Draft',
            notes: 'Initial scope and process baseline.',
            fileName: 'quality-manual-v1.md',
            content: '# Quality Manual\n\nInitial quality manual draft for the workspace.'
          }
        ]
      });

      this.createSeedDocument(context, {
        title: 'Internal Audit Procedure',
        author: 'Jordan Singh',
        prefix: '02',
        versions: [
          {
            versionNumber: 1,
            status: 'In Review',
            notes: 'Drafted for review by QA leads.',
            fileName: 'audit-procedure-v1.md',
            content: '# Internal Audit Procedure\n\nVersion 1 submitted for review.'
          },
          {
            versionNumber: 2,
            status: 'Released',
            notes: 'Approved release after stakeholder review.',
            fileName: 'audit-procedure-v2.md',
            content: '# Internal Audit Procedure\n\nVersion 2 released to production teams.'
          }
        ]
      });

      this.createSeedDocument(context, {
        title: 'Supplier Assessment Report',
        author: 'Morgan Ellis',
        prefix: '03',
        versions: [
          {
            versionNumber: 1,
            status: 'Archived',
            notes: 'Historical supplier baseline report.',
            fileName: 'supplier-report-v1.md',
            content: '# Supplier Assessment Report\n\nArchived report for prior supplier onboarding.'
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
        versionNumber: number;
        status: 'Draft' | 'In Review' | 'Released' | 'Archived';
        notes: string;
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
    const documentId = this.documentIdGenerator.generateNextDocumentId(
      context.db,
      type.NumberPrefix,
      createdDate
    );
    const documentFolderPath = this.fileStorageService.getDocumentFolderRelativePath(
      context.settings,
      type.Name,
      documentId,
      input.title
    );

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
      .run(documentId, input.title, type.Id, documentFolderPath, createdDate, createdDate, input.author);

    const documentRecordId = Number(documentInsert.lastInsertRowid);
    const insertVersion = context.db.prepare(
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
    );

    for (const version of input.versions) {
      const storedFile = this.fileStorageService.writeManagedTextFile(
        context.rootPath,
        documentFolderPath,
        version.versionNumber,
        version.fileName,
        version.content
      );

      insertVersion.run(
        documentRecordId,
        version.versionNumber,
        version.status,
        storedFile.relativePath,
        createdDate,
        version.notes
      );
    }

    context.db.prepare('UPDATE Documents SET ModifiedDate = ? WHERE Id = ?').run(
      createdDate,
      documentRecordId
    );
  }

  private normalizeWorkspaceSettings(settings: WorkspaceSettings): WorkspaceSettings {
    if (!isWorkspaceStorageLayoutPreset(settings.storageLayoutPreset)) {
      return { ...DEFAULT_WORKSPACE_SETTINGS };
    }

    return {
      storageLayoutPreset: settings.storageLayoutPreset
    };
  }
}
