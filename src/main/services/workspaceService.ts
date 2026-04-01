import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import type { WorkspaceContext, WorkspaceManager } from '@main/database/workspaceManager';
import { ActivityLogService } from '@main/services/activityLogService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { FileStorageService } from '@main/services/fileStorageService';
import { TemplateService } from '@main/services/templateService';
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import type { WorkspaceFilesystemWatcherService } from '@main/services/workspaceFilesystemWatcherService';
import { nowIso } from '@main/utils/date';
import { DOCUMENT_HEALTH_FLAGS, DOCUMENT_STATUSES } from '@shared/types';
import type {
  CreateBackupResult,
  DashboardInsight,
  DocumentListItem,
  DocumentType,
  IntegrityCheckResult,
  OpenWorkspaceResult,
  RestoreBackupInput,
  RestoreBackupPreview,
  WorkspaceBackupSummary,
  WorkspaceCreateInput,
  WorkspaceDashboardSummary,
  WorkspaceSettingsUpdateInput
} from '@shared/types';
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
    private readonly templateService: TemplateService,
    private readonly workspaceCatalogService: WorkspaceCatalogService,
    private readonly catalogService: AppCatalogService,
    private readonly documentIdGenerator: DocumentIdGeneratorService,
    private readonly activityLogService: ActivityLogService,
    private readonly workspaceBackupService: WorkspaceBackupService,
    private readonly workspaceFilesystemWatcherService?: Pick<
      WorkspaceFilesystemWatcherService,
      'ensureWatching' | 'closeWatching'
    >
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

    this.activityLogService.log(this.workspaceManager.getContext(context.rootPath).db, {
      eventType: 'workspace.created',
      message: `Workspace "${context.workspace.name}" was created.`
    });
    this.workspaceFilesystemWatcherService?.ensureWatching(context.rootPath);

    return this.getSummary(context.rootPath);
  }

  open(rootPath: string): OpenWorkspaceResult {
    const context = this.workspaceManager.openWorkspace(rootPath);
    this.workspaceFilesystemWatcherService?.ensureWatching(context.rootPath);
    this.catalogService.touchRecentWorkspace({
      rootPath: context.rootPath,
      name: context.workspace.name
    });
    this.activityLogService.log(context.db, {
      eventType: 'workspace.opened',
      message: `Workspace "${context.workspace.name}" was opened.`
    });
    return this.getSummary(rootPath, this.getIntegrityWarnings(rootPath));
  }

  close(rootPath: string) {
    this.workspaceFilesystemWatcherService?.closeWatching(rootPath);
    return this.workspaceManager.closeWorkspace(rootPath);
  }

  listOpen() {
    return this.workspaceManager.listOpenWorkspaces();
  }

  listRecent() {
    return this.catalogService.listRecentWorkspaces();
  }

  dismissRecent(rootPath: string) {
    return this.catalogService.dismissRecentWorkspace(rootPath);
  }

  getSummary(rootPath: string, warnings: string[] = []): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const documents = this.documentService.list(rootPath);
    const typeRows = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY NumberPrefix ASC')
      .all() as Array<{ Id: number; Name: string; NumberPrefix: string }>;

    return {
      workspace: context.workspace,
      summary: {
        workspace: context.workspace,
        settings: context.settings,
        documents,
        dashboard: this.buildDashboardSummary(context, documents),
        documentTypes: this.mapTypeRows(typeRows),
        projects: this.workspaceCatalogService.listProjects(rootPath),
        templates: this.templateService.list(rootPath),
        confidentialityClasses: this.workspaceCatalogService.listConfidentialityClasses(rootPath),
        languages: this.workspaceCatalogService.listLanguages(rootPath),
        statuses: [...DOCUMENT_STATUSES]
      },
      warnings
    };
  }

  updateSettings(
    rootPath: string,
    input: WorkspaceSettings | WorkspaceSettingsUpdateInput
  ): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const normalizedInput =
      'settings' in input
        ? input
        : ({
            settings: input
          } satisfies WorkspaceSettingsUpdateInput);
    const nextSettings = this.applyWorkspaceBrandingUpdate(
      context,
      this.normalizeWorkspaceSettings(normalizedInput.settings),
      normalizedInput
    );
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
    this.activityLogService.log(context.db, {
      eventType: 'workspace.settings.updated',
      message: `Workspace settings were updated for "${context.workspace.name}".`
    });
    return this.getSummary(rootPath, warnings);
  }

  getDashboard(rootPath: string): WorkspaceDashboardSummary {
    const context = this.workspaceManager.getContext(rootPath);
    return this.buildDashboardSummary(context, this.documentService.list(rootPath));
  }

  listBackups(rootPath: string): WorkspaceBackupSummary[] {
    return this.workspaceBackupService.list(rootPath);
  }

  createBackup(rootPath: string): CreateBackupResult {
    const context = this.workspaceManager.getContext(rootPath);
    const result = this.workspaceBackupService.createBackup(rootPath);
    this.activityLogService.log(context.db, {
      eventType: 'workspace.backup.created',
      message: `Created a ${result.backup.reason} snapshot.`,
    });
    return result;
  }

  getRestorePreview(
    rootPath: string,
    backupId: string,
    destinationParentPath: string,
    destinationFolderName?: string
  ): RestoreBackupPreview {
    return this.workspaceBackupService.getRestorePreview(
      rootPath,
      backupId,
      destinationParentPath,
      destinationFolderName
    );
  }

  restoreBackup(rootPath: string, input: RestoreBackupInput): OpenWorkspaceResult {
    const context = this.workspaceManager.getContext(rootPath);
    const restoredRootPath = this.workspaceBackupService.restoreBackup(
      rootPath,
      input.backupId,
      input.destinationParentPath,
      input.destinationFolderName
    );
    const summary = this.open(restoredRootPath);
    this.activityLogService.log(context.db, {
      eventType: 'workspace.backup.restored',
      message: `Restored snapshot "${input.backupId}" into "${restoredRootPath}".`
    });
    return summary;
  }

  integrityCheck(rootPath: string): IntegrityCheckResult {
    return this.workspaceBackupService.integrityCheck(rootPath);
  }

  private getIntegrityWarnings(rootPath: string): string[] {
    const integrity = this.workspaceBackupService.integrityCheck(rootPath);
    return integrity.issues.slice(0, 10).map((issue) => issue.message);
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
            CompanyLogoPath = ?,
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
        settings.companyLogoPath,
        settings.autoMarkPreviousVersionObsolete ? 1 : 0
      );
  }

  private buildDashboardSummary(
    context: WorkspaceContext,
    documents: DocumentListItem[]
  ): WorkspaceDashboardSummary {
    const statusCounts = new Map<string, number>();
    statusCounts.set('Not started', 0);
    for (const status of DOCUMENT_STATUSES) {
      statusCounts.set(status, 0);
    }

    for (const document of documents) {
      const key = document.status ?? 'Not started';
      statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
    }

    const countsByType = [...documents.reduce((accumulator, document) => {
      accumulator.set(document.typeName, (accumulator.get(document.typeName) ?? 0) + 1);
      return accumulator;
    }, new Map<string, number>()).entries()]
      .map(([label, count]) => ({
        id: label,
        label,
        count
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    const countsByProject = [...documents.reduce((accumulator, document) => {
      const key = String(document.projectId ?? '');
      const item = accumulator.get(key) ?? {
        id: key || 'no-project',
        label: document.projectName ?? 'No project',
        count: 0,
        projectId: document.projectId ?? null
      };
      item.count += 1;
      accumulator.set(key, item);
      return accumulator;
    }, new Map<string, { id: string; label: string; count: number; projectId: number | null }>()).values()]
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    const healthInsights: DashboardInsight[] = DOCUMENT_HEALTH_FLAGS.map((flag) => ({
      id: flag,
      label: this.getHealthFlagLabel(flag),
      count: documents.filter((document) => document.healthFlags.includes(flag)).length,
      tone: (
        flag === 'overdueReview' || flag === 'missingFiles'
          ? 'danger'
          : flag === 'unmanagedPaths'
            ? 'warning'
            : 'default'
      ) as DashboardInsight['tone'],
      healthFlag: flag
    })).filter((item) => item.count > 0);

    return {
      generatedDate: nowIso(),
      totalDocuments: documents.length,
      countsByStatus: [...statusCounts.entries()].map(([status, count]) => ({
        id: status.toLowerCase().replace(/\s+/g, '-'),
        label: status,
        count,
        tone: (
          status === 'Released'
            ? 'success'
            : status === 'Draft' || status === 'In Review'
              ? 'warning'
              : status === 'Obsolete'
                ? 'danger'
                : 'default'
        ) as DashboardInsight['tone'],
        status: status as 'Not started' | (typeof DOCUMENT_STATUSES)[number]
      })),
      countsByType,
      countsByProject,
      healthInsights,
      recentActivity: this.activityLogService.listRecent(context.db)
    };
  }

  private getHealthFlagLabel(flag: (typeof DOCUMENT_HEALTH_FLAGS)[number]): string {
    switch (flag) {
      case 'overdueReview':
        return 'Overdue review';
      case 'missingFiles':
        return 'Missing tracked files';
      case 'unversionedShell':
        return 'Unversioned shells';
      case 'unmanagedPaths':
        return 'Unmanaged paths';
      case 'staleDocument':
        return 'Stale documents';
    }
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
      left.companyLogoPath === right.companyLogoPath &&
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
    const currentTrackedFilePathById = new Map<number, string>();

    for (const versionRow of versionRows) {
      const version = this.documentService.getVersionFilesystemPreview(context.rootPath, versionRow.Id);
      if (version.unmanagedPaths.length > 0) {
        warnings.push(
          `Version ${version.versionLabel} contains unmanaged paths: ${version.unmanagedPaths.join(', ')}`
        );
      }

      if (version.filesystemState === 'ambiguous') {
        throw new Error(
          `Version ${version.versionLabel} has ambiguous filesystem drift. Resolve it before changing the workspace storage layout.`
        );
      }

      for (const change of version.filesystemChanges) {
        if (change.kind === 'missingTracked') {
          throw new Error(
            `Version ${version.versionLabel} has missing tracked files. Resolve the filesystem drift before changing the workspace storage layout.`
          );
        }

        if (
          (change.kind === 'renamed' || change.kind === 'roleMoved' || change.kind === 'modified') &&
          change.trackedFileId &&
          change.discoveredPath
        ) {
          currentTrackedFilePathById.set(change.trackedFileId, change.discoveredPath);
        }
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
    const versionFolderPaths = dbVersionRows.map((versionRow) => {
      const documentMove = documentMoveById.get(versionRow.DocumentId);
      if (!documentMove) {
        throw new Error('A version is missing its document record.');
      }

      return this.fileStorageService.getVersionFolderRelativePath(
        documentMove.nextFolderPath,
        versionRow.VersionLabel
      );
    });
    const fileMoves = fileRows.map((fileRow) => {
      const versionRow = versionById.get(fileRow.DocumentVersionId);
      if (!versionRow) {
        throw new Error('A version file is missing its version record.');
      }

      const documentMove = documentMoveById.get(versionRow.DocumentId);
      if (!documentMove) {
        throw new Error('A version file is missing its document record.');
      }

      const effectiveCurrentFilePath = currentTrackedFilePathById.get(fileRow.Id) ?? fileRow.FilePath;
      const rewrittenCurrentFilePath = this.rewriteRelativePathPrefix(
        effectiveCurrentFilePath,
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

      if (nextSettings.fileOrganizationMode === 'flat') {
        for (const versionFolderPath of versionFolderPaths) {
          this.fileStorageService.cleanupEmptyRoleDirectoriesInVersionFolder(
            context.rootPath,
            versionFolderPath
          );
        }
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
            StartDate,
            Company,
            Department
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        createdDate.slice(0, 10),
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
          ReviewedBy,
          CreatedDate,
          Notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        '',
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
      companyLogoPath: typeof settings.companyLogoPath === 'string' ? settings.companyLogoPath.trim() : '',
      autoMarkPreviousVersionObsolete:
        typeof settings.autoMarkPreviousVersionObsolete === 'boolean'
          ? settings.autoMarkPreviousVersionObsolete
          : DEFAULT_WORKSPACE_SETTINGS.autoMarkPreviousVersionObsolete
    };
  }

  private applyWorkspaceBrandingUpdate(
    context: WorkspaceContext,
    settings: WorkspaceSettings,
    input: WorkspaceSettingsUpdateInput
  ): WorkspaceSettings {
    if (input.clearCompanyLogo) {
      this.removeWorkspaceCompanyLogo(context, context.settings.companyLogoPath);
      return {
        ...settings,
        companyLogoPath: ''
      };
    }

    if (input.companyLogoSourceFilePath) {
      return {
        ...settings,
        companyLogoPath: this.storeWorkspaceCompanyLogo(context, input.companyLogoSourceFilePath)
      };
    }

    return settings;
  }

  private storeWorkspaceCompanyLogo(context: WorkspaceContext, sourceFilePath: string): string {
    const extension = (path.extname(sourceFilePath).toLowerCase() || '.png').replace(/[^.\w-]/g, '');
    const relativePath = `Database/branding/company-logo${extension}`;
    const absolutePath = path.join(context.rootPath, ...relativePath.split('/'));

    this.removeWorkspaceCompanyLogo(context, context.settings.companyLogoPath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    copyFileSync(sourceFilePath, absolutePath);

    return relativePath;
  }

  private removeWorkspaceCompanyLogo(context: WorkspaceContext, companyLogoPath: string): void {
    const normalized = companyLogoPath.trim();
    if (!normalized) {
      return;
    }

    const absolutePath = path.join(context.rootPath, ...normalized.split('/'));
    if (existsSync(absolutePath)) {
      rmSync(absolutePath, { force: true });
    }

    const brandingDirectory = path.join(context.rootPath, 'Database', 'branding');
    if (existsSync(brandingDirectory)) {
      rmSync(brandingDirectory, { recursive: true, force: true });
    }
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
