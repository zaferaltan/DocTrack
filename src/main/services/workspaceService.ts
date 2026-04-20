import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import type { WorkspaceContext, WorkspaceManager } from '@main/database/workspaceManager';
import { ActivityLogService } from '@main/services/activityLogService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { FileStorageService } from '@main/services/fileStorageService';
import { SavedViewService } from '@main/services/savedViewService';
import { TemplateService } from '@main/services/templateService';
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import type { WorkspaceFilesystemWatcherService } from '@main/services/workspaceFilesystemWatcherService';
import { WorkspaceRoleService } from '@main/services/workspaceRoleService';
import { WorkspaceUserService } from '@main/services/workspaceUserService';
import { nowIso } from '@main/utils/date';
import {
  createDefaultWorkspaceLifecycle,
  getLifecycleDashboardTone,
  getWorkspaceLifecycleStatusNames,
  getWorkspaceLifecycleStatuses,
  normalizeWorkspaceLifecycle,
  validateWorkspaceLifecycle,
  type WorkspaceLifecycle
} from '@shared/documentLifecycle';
import type { SavedView, SavedViewStatusNameRemap } from '@shared/savedViews';
import { DOCUMENT_HEALTH_FLAGS } from '@shared/types';
import type {
  CreateBackupResult,
  DashboardInsight,
  DocumentListItem,
  DocumentStatus,
  DocumentType,
  IntegrityCheckResult,
  RestoreBackupDiffResult,
  RestoreBackupInput,
  RestoreBackupPreview,
  RecentActivityItem,
  UpdateDashboardLayoutInput,
  WorkspaceBackupSummary,
  WorkspaceCreateInput,
  WorkspaceDashboardSummary,
  WorkspaceInfo,
  WorkspaceSummary,
  WorkspaceSettingsUpdateInput
} from '@shared/types';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_ROOT_DIRECTORY_SETTING_KEYS,
  getWorkspaceDatabaseDirectoryRelativePath,
  isValidWorkspaceRootDirectoryName,
  normalizeWorkspaceRootDirectoryNames,
  isDocumentIdFormatPreset,
  normalizeDocumentIdFormatTemplate,
  resolveDocumentIdFormatTemplate,
  isWorkspaceFileOrganizationMode,
  isWorkspaceStorageLayoutPreset,
  isWorkspaceVersionManagementMode,
  normalizeVisibleDocumentColumns,
  normalizeWorkspaceActivityLogMaxRows,
  type WorkspaceSettings
} from '@shared/workspaceLayout';

const STARTER_TYPES: Array<{ name: string; numberPrefix: string }> = [
  { name: 'Specification', numberPrefix: '01' },
  { name: 'Procedure', numberPrefix: '02' },
  { name: 'Report', numberPrefix: '03' }
];
const DEFAULT_INITIAL_ADMIN = {
  username: 'admin',
  displayName: 'Workspace Admin',
  password: 'admin'
};

export interface WorkspaceSummaryResult {
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
  warnings?: string[];
}

export class WorkspaceService {
  private readonly workspaceUserService: WorkspaceUserService;
  private readonly workspaceRoleService: WorkspaceRoleService;

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly documentService: DocumentService,
    private readonly fileStorageService: FileStorageService,
    private readonly templateService: TemplateService,
    private readonly workspaceCatalogService: WorkspaceCatalogService,
    private readonly catalogService: AppCatalogService,
    private readonly savedViewService: SavedViewService,
    private readonly documentIdGenerator: DocumentIdGeneratorService,
    private readonly activityLogService: ActivityLogService,
    private readonly workspaceBackupService: WorkspaceBackupService,
    workspaceRoleService?: WorkspaceRoleService,
    workspaceUserService?: WorkspaceUserService,
    private readonly workspaceFilesystemWatcherService?: Pick<
      WorkspaceFilesystemWatcherService,
      'ensureWatching' | 'closeWatching'
    >
  ) {
    this.workspaceRoleService =
      workspaceRoleService ?? new WorkspaceRoleService(workspaceManager);
    this.workspaceUserService =
      workspaceUserService ??
      new WorkspaceUserService(workspaceManager, this.workspaceRoleService);
  }

  create(input: WorkspaceCreateInput): WorkspaceSummaryResult {
    const initialAdmin = input.initialAdmin ?? DEFAULT_INITIAL_ADMIN;
    const nextSettings = this.normalizeWorkspaceSettings(input.settings);
    const nextLifecycle = this.normalizeWorkspaceLifecycle(
      input.lifecycle,
      nextSettings.autoMarkPreviousVersionObsolete
    );
    this.assertDocumentIdTemplateIsValid(nextSettings);
    const context = this.workspaceManager.createWorkspace(input, (workspaceContext) => {
      if (nextSettings.userSystemEnabled) {
        this.workspaceUserService.createInitialAdmin(workspaceContext.db, initialAdmin);
      }
      this.persistWorkspaceLifecycle(workspaceContext, nextLifecycle);
      workspaceContext.lifecycle = nextLifecycle;
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
    this.workspaceFilesystemWatcherService?.ensureWatching(context.rootPath, context.settings);

    return this.getSummary(context.rootPath);
  }

  open(rootPath: string): WorkspaceSummaryResult {
    const context = this.workspaceManager.openWorkspace(rootPath);
    this.workspaceFilesystemWatcherService?.ensureWatching(context.rootPath, context.settings);
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

  getSummary(rootPath: string, warnings: string[] = []): WorkspaceSummaryResult {
    const context = this.workspaceManager.getContext(rootPath);
    const documents = this.documentService.list(rootPath);
    const users = context.settings.userSystemEnabled
      ? this.workspaceUserService.list(rootPath)
      : [];
    const typeRows = context.db
      .prepare('SELECT Id, Name, NumberPrefix FROM DocumentTypes ORDER BY NumberPrefix ASC')
      .all() as Array<{ Id: number; Name: string; NumberPrefix: string }>;

    return {
      workspace: context.workspace,
      summary: {
        workspace: context.workspace,
        settings: context.settings,
        lifecycle: context.lifecycle,
        roleSettings: this.workspaceRoleService.list(rootPath),
        users,
        documents,
        dashboard: this.buildDashboardSummary(context, documents),
        dashboardLayout: this.savedViewService.getDashboardLayout(rootPath),
        documentTypes: this.mapTypeRows(typeRows),
        groups: this.workspaceCatalogService.listGroups(rootPath),
        projects: this.workspaceCatalogService.listProjects(rootPath),
        templates: this.templateService.list(rootPath),
        confidentialityClasses: this.workspaceCatalogService.listConfidentialityClasses(rootPath),
        languages: this.workspaceCatalogService.listLanguages(rootPath),
        statuses: getWorkspaceLifecycleStatusNames(context.lifecycle),
        savedViews: this.savedViewService.list(rootPath)
      },
      warnings
    };
  }

  isUserSystemEnabled(rootPath: string): boolean {
    return this.workspaceManager.getContext(rootPath).settings.userSystemEnabled;
  }

  updateSettings(
    rootPath: string,
    input: WorkspaceSettings | WorkspaceSettingsUpdateInput
  ): WorkspaceSummaryResult {
    const context = this.workspaceManager.getContext(rootPath);
    const normalizedInput =
      'settings' in input
        ? input
        : ({
            settings: input
          } satisfies WorkspaceSettingsUpdateInput);
    let nextSettings = this.normalizeWorkspaceSettings(normalizedInput.settings);
    const nextLifecycle = this.normalizeWorkspaceLifecycle(
      normalizedInput.lifecycle ?? context.lifecycle,
      nextSettings.autoMarkPreviousVersionObsolete
    );
    this.assertWorkspaceRootDirectoriesAreValid(nextSettings);
    this.assertDocumentIdTemplateIsValid(nextSettings);
    const requiresStorageMigration =
      context.settings.storageLayoutPreset !== nextSettings.storageLayoutPreset ||
      context.settings.fileOrganizationMode !== nextSettings.fileOrganizationMode;
    const documentsDirectoryChanged =
      context.settings.documentsDirectoryName !== nextSettings.documentsDirectoryName;
    const templatesDirectoryChanged =
      context.settings.templatesDirectoryName !== nextSettings.templatesDirectoryName;
    const backupsDirectoryChanged =
      context.settings.backupsDirectoryName !== nextSettings.backupsDirectoryName;
    const databaseDirectoryChanged =
      context.settings.databaseDirectoryName !== nextSettings.databaseDirectoryName;

    nextSettings = this.resolveNextWorkspaceBrandingSettings(
      context,
      nextSettings,
      normalizedInput,
      databaseDirectoryChanged
    );

    if (!context.settings.userSystemEnabled && nextSettings.userSystemEnabled) {
      const hasExistingUsers = this.workspaceUserService.list(rootPath).length > 0;
      if (!hasExistingUsers) {
        if (!normalizedInput.initialAdmin) {
          throw new Error('Provide an initial admin before enabling the user system for this workspace.');
        }

        this.workspaceUserService.createInitialAdmin(context.db, normalizedInput.initialAdmin);
      }
    }

    if (
      this.areWorkspaceSettingsEqual(context.settings, nextSettings) &&
      this.areWorkspaceLifecyclesEqual(context.lifecycle, nextLifecycle) &&
      !normalizedInput.clearCompanyLogo &&
      !normalizedInput.companyLogoSourceFilePath
    ) {
      return this.getSummary(rootPath);
    }

    this.workspaceFilesystemWatcherService?.closeWatching(rootPath);

    const warnings = requiresStorageMigration
      ? this.migrateWorkspaceStorageLayout(context, nextSettings)
      : documentsDirectoryChanged
        ? this.renameDocumentsRootDirectory(context, nextSettings)
        : [];

    if (templatesDirectoryChanged) {
      this.renameWorkspaceRootDirectory(
        rootPath,
        context.settings.templatesDirectoryName,
        nextSettings.templatesDirectoryName,
        'Templates'
      );
    }

    if (backupsDirectoryChanged) {
      this.renameWorkspaceRootDirectory(
        rootPath,
        context.settings.backupsDirectoryName,
        nextSettings.backupsDirectoryName,
        'Backups'
      );
    }

    if (normalizedInput.clearCompanyLogo) {
      this.removeWorkspaceCompanyLogo(context, context.settings.companyLogoPath);
    }

    if (!databaseDirectoryChanged && normalizedInput.companyLogoSourceFilePath) {
      this.storeWorkspaceCompanyLogo(
        context,
        normalizedInput.companyLogoSourceFilePath,
        nextSettings
      );
    }

    this.persistWorkspaceSettings(context, nextSettings);
    const savedViewStatusRemaps = this.persistWorkspaceLifecycleUpdate(
      context,
      nextLifecycle,
      normalizedInput.statusRemaps ?? []
    );

    if (databaseDirectoryChanged) {
      this.workspaceManager.closeWorkspace(rootPath);
      this.renameWorkspaceRootDirectory(
        rootPath,
        context.settings.databaseDirectoryName,
        nextSettings.databaseDirectoryName,
        'Database'
      );
      this.open(rootPath);

      if (normalizedInput.companyLogoSourceFilePath) {
        const reopenedContext = this.workspaceManager.getContext(rootPath);
        this.storeWorkspaceCompanyLogo(
          reopenedContext,
          normalizedInput.companyLogoSourceFilePath,
          reopenedContext.settings
        );
      }
    } else {
      context.settings = nextSettings;
      context.lifecycle = nextLifecycle;
      this.refreshContextLayoutPaths(context);
      this.ensureDocumentTypeDirectories(context);
      this.workspaceFilesystemWatcherService?.ensureWatching(rootPath, context.settings);
    }

    if (savedViewStatusRemaps.length > 0) {
      this.savedViewService.remapSharedSavedViewStatuses(rootPath, savedViewStatusRemaps);
      this.catalogService.remapPersonalSavedViewStatuses(rootPath, savedViewStatusRemaps);
    }

    const finalContext = this.workspaceManager.getContext(rootPath);
    if (finalContext.settings.activityLogEnabled) {
      this.activityLogService.log(finalContext.db, {
        eventType: 'workspace.settings.updated',
        message: `Workspace settings were updated for "${finalContext.workspace.name}".`
      });
    } else {
      this.activityLogService.prune(finalContext.db, finalContext.settings.activityLogMaxRows);
    }
    return this.getSummary(rootPath, warnings);
  }

  getDashboard(rootPath: string): WorkspaceDashboardSummary {
    const context = this.workspaceManager.getContext(rootPath);
    return this.buildDashboardSummary(context, this.documentService.list(rootPath));
  }

  getDashboardLayout(rootPath: string) {
    return this.savedViewService.getDashboardLayout(rootPath);
  }

  updateDashboardLayout(rootPath: string, input: UpdateDashboardLayoutInput) {
    return this.savedViewService.updateDashboardLayout(rootPath, input);
  }

  listActivity(rootPath: string): RecentActivityItem[] {
    const context = this.workspaceManager.getContext(rootPath);
    return context.settings.activityLogEnabled
      ? this.activityLogService.listAll(context.db)
      : [];
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

  getRestoreDiff(rootPath: string, backupId: string): RestoreBackupDiffResult {
    return this.workspaceBackupService.getRestoreDiff(rootPath, backupId);
  }

  restoreBackup(rootPath: string, input: RestoreBackupInput): WorkspaceSummaryResult {
    if (input.mode === 'overwrite-current-database') {
      return this.restoreBackupIntoCurrentWorkspace(rootPath, input.backupId);
    }

    const context = this.workspaceManager.getContext(rootPath);
    if (!input.destinationParentPath) {
      throw new Error('Choose a destination folder for the restored workspace.');
    }

    const restoredRootPath = this.workspaceBackupService.restoreBackup(
      rootPath,
      input.backupId,
      input.destinationParentPath,
      input.destinationFolderName
    );
    this.open(restoredRootPath);
    this.reconcileSafeRestoredManagedPaths(restoredRootPath);
    const summary = this.getSummary(restoredRootPath, this.getIntegrityWarnings(restoredRootPath));
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

  private restoreBackupIntoCurrentWorkspace(rootPath: string, backupId: string): WorkspaceSummaryResult {
    const context = this.workspaceManager.getContext(rootPath);
    this.workspaceBackupService.createBackup(rootPath, 'safety');
    this.workspaceFilesystemWatcherService?.closeWatching(rootPath);
    this.workspaceManager.closeWorkspace(rootPath);
    this.workspaceBackupService.overwriteCurrentWorkspace(rootPath, backupId, context.settings);
    this.open(rootPath);
    this.reconcileSafeRestoredManagedPaths(rootPath);
    const summary = this.getSummary(rootPath, this.getIntegrityWarnings(rootPath));
    this.activityLogService.log(this.workspaceManager.getContext(rootPath).db, {
      eventType: 'workspace.backup.restored',
      message: `Overwrote the live workspace database with snapshot "${backupId}".`
    });
    return summary;
  }

  private reconcileSafeRestoredManagedPaths(rootPath: string): void {
    const context = this.workspaceManager.getContext(rootPath);
    const versionRows = context.db
      .prepare('SELECT Id FROM DocumentVersions ORDER BY Id ASC')
      .all() as Array<{ Id: number }>;

    for (const versionRow of versionRows) {
      const preview = this.documentService.getVersionFilesystemPreview(rootPath, versionRow.Id);
      const changeIndexes = preview.filesystemChanges.flatMap((change, index) =>
        change.kind === 'renamed' || change.kind === 'roleMoved' || change.kind === 'modified'
          ? [index]
          : []
      );

      if (changeIndexes.length === 0) {
        continue;
      }

      this.documentService.applyVersionFilesystemReconciliation(rootPath, versionRow.Id, {
        changeIndexes
      });
    }
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
            UserSystemEnabled = ?,
            StorageLayoutPreset = ?,
            FileOrganizationMode = ?,
            VersionManagementMode = ?,
            DocumentIdFormatPreset = ?,
            DocumentIdFormatTemplate = ?,
            DatabaseDirectoryName = ?,
            DocumentsDirectoryName = ?,
            TemplatesDirectoryName = ?,
            BackupsDirectoryName = ?,
            VisibleDocumentColumns = ?,
            DefaultCompany = ?,
            DefaultDepartment = ?,
            CompanyLogoPath = ?,
            AutoMarkPreviousVersionObsolete = ?,
            ActivityLogEnabled = ?,
            ActivityLogMaxRows = ?
          WHERE Id = 1
        `
      )
      .run(
        settings.userSystemEnabled ? 1 : 0,
        settings.storageLayoutPreset,
        settings.fileOrganizationMode,
        settings.versionManagementMode,
        settings.documentIdFormatPreset,
        settings.documentIdFormatTemplate,
        settings.databaseDirectoryName,
        settings.documentsDirectoryName,
        settings.templatesDirectoryName,
        settings.backupsDirectoryName,
        JSON.stringify(settings.visibleDocumentColumns),
        settings.defaultCompany,
        settings.defaultDepartment,
        settings.companyLogoPath,
        settings.autoMarkPreviousVersionObsolete ? 1 : 0,
        settings.activityLogEnabled ? 1 : 0,
        settings.activityLogMaxRows
      );
  }

  private normalizeWorkspaceLifecycle(
    lifecycle: WorkspaceLifecycle | undefined,
    requireAutoPreviousVersionStatus: boolean
  ): WorkspaceLifecycle {
    const nextLifecycle = normalizeWorkspaceLifecycle(lifecycle);
    const errors = validateWorkspaceLifecycle(nextLifecycle, {
      requireAutoPreviousVersionStatus
    });
    if (errors.length > 0) {
      throw new Error(errors[0]);
    }

    const initialStatus =
      nextLifecycle.statuses.find((status) => status.key === nextLifecycle.initialStatusKey) ?? null;
    if (
      initialStatus &&
      (initialStatus.requiresReleasedDate ||
        initialStatus.requiresReviewedBy ||
        initialStatus.requiresApprovedBy)
    ) {
      throw new Error('The initial lifecycle status cannot require release metadata.');
    }

    const autoPreviousStatus =
      nextLifecycle.autoPreviousVersionStatusKey === null
        ? null
        : nextLifecycle.statuses.find(
            (status) => status.key === nextLifecycle.autoPreviousVersionStatusKey
          ) ?? null;
    if (
      requireAutoPreviousVersionStatus &&
      autoPreviousStatus &&
      (autoPreviousStatus.requiresReleasedDate ||
        autoPreviousStatus.requiresReviewedBy ||
        autoPreviousStatus.requiresApprovedBy)
    ) {
      throw new Error('The previous-version lifecycle status cannot require release metadata.');
    }

    return nextLifecycle;
  }

  private persistWorkspaceLifecycle(context: WorkspaceContext, lifecycle: WorkspaceLifecycle): void {
    context.db.transaction(() => {
      context.db.prepare('DELETE FROM StatusTransitions').run();
      context.db.prepare('DELETE FROM Statuses').run();
      this.insertLifecycleStatuses(context.db, lifecycle);
      this.insertLifecycleTransitions(context.db, lifecycle);
      this.persistWorkspaceLifecycleMetadata(context.db, lifecycle);
    })();
  }

  private persistWorkspaceLifecycleUpdate(
    context: WorkspaceContext,
    nextLifecycle: WorkspaceLifecycle,
    statusRemaps: Array<{ fromStatusKey: string; toStatusKey: string }>
  ): SavedViewStatusNameRemap[] {
    if (this.areWorkspaceLifecyclesEqual(context.lifecycle, nextLifecycle)) {
      return [];
    }

    const currentStatusByKey = new Map(context.lifecycle.statuses.map((status) => [status.key, status]));
    const nextStatusByKey = new Map(nextLifecycle.statuses.map((status) => [status.key, status]));
    const removedStatuses = context.lifecycle.statuses.filter((status) => !nextStatusByKey.has(status.key));
    const remapByFromKey = new Map(
      statusRemaps
        .filter(
          (remap) =>
            typeof remap.fromStatusKey === 'string' &&
            remap.fromStatusKey.trim().length > 0 &&
            typeof remap.toStatusKey === 'string' &&
            remap.toStatusKey.trim().length > 0
        )
        .map((remap) => [remap.fromStatusKey, remap.toStatusKey])
    );
    const requiredRemovedStatusKeys = this.getRemovedStatusKeysRequiringRemap(
      context,
      removedStatuses.map((status) => status.name)
    );

    for (const status of removedStatuses) {
      if (!requiredRemovedStatusKeys.has(status.key)) {
        continue;
      }

      const destinationKey = remapByFromKey.get(status.key);
      if (!destinationKey || !nextStatusByKey.has(destinationKey)) {
        throw new Error(
          `Map the removed status "${status.name}" to a replacement status before saving the lifecycle.`
        );
      }
    }

    const savedViewStatusRemaps = this.buildSavedViewStatusRemaps(
      context.lifecycle,
      nextLifecycle,
      remapByFromKey
    );

    context.db.transaction(() => {
      const updateStatus = context.db.prepare(
        `
          UPDATE Statuses
          SET
            Name = ?,
            SortOrder = ?,
            SemanticRole = ?,
            RequiresReleasedDate = ?,
            RequiresReviewedBy = ?,
            RequiresApprovedBy = ?
          WHERE Key = ?
        `
      );
      const insertStatus = context.db.prepare(
        `
          INSERT INTO Statuses (
            Key,
            Name,
            SortOrder,
            SemanticRole,
            RequiresReleasedDate,
            RequiresReviewedBy,
            RequiresApprovedBy
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const status of nextLifecycle.statuses) {
        if (currentStatusByKey.has(status.key)) {
          updateStatus.run(
            status.name,
            status.sortOrder,
            status.role,
            status.requiresReleasedDate ? 1 : 0,
            status.requiresReviewedBy ? 1 : 0,
            status.requiresApprovedBy ? 1 : 0,
            status.key
          );
          continue;
        }

        insertStatus.run(
          status.key,
          status.name,
          status.sortOrder,
          status.role,
          status.requiresReleasedDate ? 1 : 0,
          status.requiresReviewedBy ? 1 : 0,
          status.requiresApprovedBy ? 1 : 0
        );
      }

      const updateDocumentVersions = context.db.prepare(
        'UPDATE DocumentVersions SET Status = ? WHERE Status = ?'
      );
      for (const status of removedStatuses) {
        const destinationKey = remapByFromKey.get(status.key);
        if (!destinationKey) {
          continue;
        }

        const destinationStatus = nextStatusByKey.get(destinationKey);
        if (!destinationStatus) {
          throw new Error(`The replacement status for "${status.name}" could not be found.`);
        }

        updateDocumentVersions.run(destinationStatus.name, status.name);
      }

      context.db.prepare('DELETE FROM StatusTransitions').run();

      if (removedStatuses.length > 0) {
        const deleteStatus = context.db.prepare('DELETE FROM Statuses WHERE Key = ?');
        for (const status of removedStatuses) {
          deleteStatus.run(status.key);
        }
      }

      this.insertLifecycleTransitions(context.db, nextLifecycle);
      this.persistWorkspaceLifecycleMetadata(context.db, nextLifecycle);
    })();

    return savedViewStatusRemaps;
  }

  private insertLifecycleStatuses(db: Database.Database, lifecycle: WorkspaceLifecycle): void {
    const insertStatus = db.prepare(
      `
        INSERT INTO Statuses (
          Key,
          Name,
          SortOrder,
          SemanticRole,
          RequiresReleasedDate,
          RequiresReviewedBy,
          RequiresApprovedBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const status of lifecycle.statuses) {
      insertStatus.run(
        status.key,
        status.name,
        status.sortOrder,
        status.role,
        status.requiresReleasedDate ? 1 : 0,
        status.requiresReviewedBy ? 1 : 0,
        status.requiresApprovedBy ? 1 : 0
      );
    }
  }

  private insertLifecycleTransitions(db: Database.Database, lifecycle: WorkspaceLifecycle): void {
    const insertTransition = db.prepare(
      'INSERT INTO StatusTransitions (FromStatusKey, ToStatusKey) VALUES (?, ?)'
    );

    for (const transition of lifecycle.allowedTransitions) {
      insertTransition.run(transition.fromStatusKey, transition.toStatusKey);
    }
  }

  private persistWorkspaceLifecycleMetadata(
    db: Database.Database,
    lifecycle: WorkspaceLifecycle
  ): void {
    db.prepare(
      `
        UPDATE Workspaces
        SET
          LifecycleMode = ?,
          InitialStatusKey = ?,
          AutoPreviousVersionStatusKey = ?
        WHERE Id = 1
      `
    ).run(
      lifecycle.mode,
      lifecycle.initialStatusKey,
      lifecycle.autoPreviousVersionStatusKey
    );
  }

  private getRemovedStatusKeysRequiringRemap(
    context: WorkspaceContext,
    removedStatusNames: string[]
  ): Set<string> {
    if (removedStatusNames.length === 0) {
      return new Set<string>();
    }

    const inUseStatusNames = new Set<string>();
    const placeholders = removedStatusNames.map(() => '?').join(', ');
    const rows = context.db
      .prepare(
        `SELECT DISTINCT Status FROM DocumentVersions WHERE Status IN (${placeholders})`
      )
      .all(...removedStatusNames) as Array<{ Status: string }>;
    for (const row of rows) {
      inUseStatusNames.add(row.Status);
    }

    const savedViews = this.savedViewService.list(context.rootPath);
    for (const removedStatusName of removedStatusNames) {
      if (savedViews.some((savedView) => this.savedViewReferencesStatus(savedView, removedStatusName))) {
        inUseStatusNames.add(removedStatusName);
      }
    }

    return new Set(
      context.lifecycle.statuses
        .filter((status) => inUseStatusNames.has(status.name))
        .map((status) => status.key)
    );
  }

  private savedViewReferencesStatus(savedView: SavedView, statusName: string): boolean {
    return (
      savedView.query.statusFilter === statusName ||
      savedView.query.rules.some(
        (rule) =>
          rule.field === 'status' &&
          (rule.value === statusName || rule.secondaryValue === statusName)
      )
    );
  }

  private buildSavedViewStatusRemaps(
    currentLifecycle: WorkspaceLifecycle,
    nextLifecycle: WorkspaceLifecycle,
    remapByFromKey: Map<string, string>
  ): SavedViewStatusNameRemap[] {
    const remaps: SavedViewStatusNameRemap[] = [];
    const nextStatusByKey = new Map(nextLifecycle.statuses.map((status) => [status.key, status]));

    for (const currentStatus of currentLifecycle.statuses) {
      const nextStatus = nextStatusByKey.get(currentStatus.key);
      if (nextStatus && nextStatus.name !== currentStatus.name) {
        remaps.push({
          from: currentStatus.name,
          to: nextStatus.name
        });
      }
    }

    for (const [fromKey, toKey] of remapByFromKey.entries()) {
      const currentStatus = currentLifecycle.statuses.find((status) => status.key === fromKey);
      const nextStatus = nextStatusByKey.get(toKey);
      if (!currentStatus || !nextStatus) {
        continue;
      }

      remaps.push({
        from: currentStatus.name,
        to: nextStatus.name
      });
    }

    return remaps.filter(
      (remap, index, items) =>
        remap.from !== remap.to &&
        items.findIndex((item) => item.from === remap.from && item.to === remap.to) === index
    );
  }

  private buildDashboardSummary(
    context: WorkspaceContext,
    documents: DocumentListItem[]
  ): WorkspaceDashboardSummary {
    const statusCounts = new Map<string, number>();
    statusCounts.set('Not started', 0);
    for (const status of getWorkspaceLifecycleStatuses(context.lifecycle)) {
      statusCounts.set(status.name, 0);
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

    const countsByGroup = [...documents.reduce((accumulator, document) => {
      const key = String(document.groupId ?? '');
      const item = accumulator.get(key) ?? {
        id: key || 'no-group',
        label: document.groupName ?? 'No group',
        count: 0,
        groupId: document.groupId ?? null
      };
      item.count += 1;
      accumulator.set(key, item);
      return accumulator;
    }, new Map<string, { id: string; label: string; count: number; groupId: number | null }>()).values()]
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
      countsByStatus: [...statusCounts.entries()].map(([status, count]) => {
        const lifecycleStatus = status === 'Not started'
          ? null
          : context.lifecycle.statuses.find((item) => item.name === status) ?? null;

        return {
          id: status.toLowerCase().replace(/\s+/g, '-'),
          label: status,
          count,
          tone: lifecycleStatus ? getLifecycleDashboardTone(lifecycleStatus.role) : 'default',
          status: status as 'Not started' | DocumentStatus
        };
      }),
      countsByType,
      countsByGroup,
      countsByProject,
      healthInsights,
      recentActivity: context.settings.activityLogEnabled
        ? this.activityLogService.listRecent(context.db)
        : []
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
      left.userSystemEnabled === right.userSystemEnabled &&
      left.storageLayoutPreset === right.storageLayoutPreset &&
      left.fileOrganizationMode === right.fileOrganizationMode &&
      left.versionManagementMode === right.versionManagementMode &&
      left.documentIdFormatPreset === right.documentIdFormatPreset &&
      left.documentIdFormatTemplate === right.documentIdFormatTemplate &&
      left.databaseDirectoryName === right.databaseDirectoryName &&
      left.documentsDirectoryName === right.documentsDirectoryName &&
      left.templatesDirectoryName === right.templatesDirectoryName &&
      left.backupsDirectoryName === right.backupsDirectoryName &&
      left.defaultCompany === right.defaultCompany &&
      left.defaultDepartment === right.defaultDepartment &&
      left.companyLogoPath === right.companyLogoPath &&
      left.autoMarkPreviousVersionObsolete === right.autoMarkPreviousVersionObsolete &&
      left.activityLogEnabled === right.activityLogEnabled &&
      left.activityLogMaxRows === right.activityLogMaxRows &&
      left.visibleDocumentColumns.length === right.visibleDocumentColumns.length &&
      left.visibleDocumentColumns.every((column, index) => column === right.visibleDocumentColumns[index])
    );
  }

  private areWorkspaceLifecyclesEqual(left: WorkspaceLifecycle, right: WorkspaceLifecycle): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private ensureDocumentTypeDirectories(context: WorkspaceContext): void {
    const typeNames = context.db
      .prepare('SELECT Name FROM DocumentTypes ORDER BY NumberPrefix ASC, Name ASC')
      .all() as Array<{ Name: string }>;

    this.fileStorageService.ensureDocumentTypeDirectories(
      context.rootPath,
      typeNames.map((type) => type.Name),
      context.settings
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
          move.nextFolderPath,
          context.settings
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
            move.currentFolderPath,
            context.settings
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

    const resolveStatusName = (
      role: WorkspaceLifecycle['statuses'][number]['role']
    ): string =>
      context.lifecycle.statuses.find((status) => status.role === role)?.name ??
      context.lifecycle.statuses[0]?.name ??
      'Draft';

    const transaction = context.db.transaction(() => {
      this.createSeedDocument(context, {
        title: 'Quality Manual',
        author: 'Avery Chen',
        prefix: '01',
        versions: [
          {
            versionLabel: '001',
            sequenceNumber: 1,
            status: resolveStatusName('draft'),
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
            status: resolveStatusName('review'),
            notes: 'Drafted for review by QA leads.',
            role: 'working',
            fileName: 'audit-procedure.docx',
            content: 'Version 001 working document.'
          },
          {
            versionLabel: '002',
            sequenceNumber: 2,
            status: resolveStatusName('released'),
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
            status: resolveStatusName('archived'),
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
        status: string;
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
    const authorUser = context.settings.userSystemEnabled
      ? this.workspaceUserService.ensureImportedUser(context.db, input.author)
      : {
          id: null,
          displayName: input.author.trim()
        };
    const documentId = this.documentIdGenerator.generateNextDocumentId(context.db, context.settings, {
      numberPrefix: type.NumberPrefix,
      documentTypeName: type.Name,
      createdDate,
      title: input.title,
      author: authorUser.displayName,
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
            AuthorUserId,
            StartDate,
            Company,
            Department
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        authorUser.displayName,
        authorUser.id,
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
          ReviewedByUserId,
          ApprovedBy,
          ApprovedByUserId,
          CreatedDate,
          Notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            author: authorUser.displayName,
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
        null,
        '',
        null,
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
      userSystemEnabled:
        typeof settings.userSystemEnabled === 'boolean'
          ? settings.userSystemEnabled
          : DEFAULT_WORKSPACE_SETTINGS.userSystemEnabled,
      storageLayoutPreset: settings.storageLayoutPreset,
      fileOrganizationMode: settings.fileOrganizationMode,
      versionManagementMode: settings.versionManagementMode,
      documentIdFormatPreset: settings.documentIdFormatPreset,
      documentIdFormatTemplate: normalizeDocumentIdFormatTemplate(
        settings.documentIdFormatTemplate,
        settings.documentIdFormatPreset
      ),
      ...normalizeWorkspaceRootDirectoryNames(settings),
      visibleDocumentColumns: normalizeVisibleDocumentColumns(settings.visibleDocumentColumns),
      defaultCompany: typeof settings.defaultCompany === 'string' ? settings.defaultCompany.trim() : '',
      defaultDepartment:
        typeof settings.defaultDepartment === 'string' ? settings.defaultDepartment.trim() : '',
      companyLogoPath: typeof settings.companyLogoPath === 'string' ? settings.companyLogoPath.trim() : '',
      autoMarkPreviousVersionObsolete:
        typeof settings.autoMarkPreviousVersionObsolete === 'boolean'
          ? settings.autoMarkPreviousVersionObsolete
          : DEFAULT_WORKSPACE_SETTINGS.autoMarkPreviousVersionObsolete,
      activityLogEnabled:
        typeof settings.activityLogEnabled === 'boolean'
          ? settings.activityLogEnabled
          : DEFAULT_WORKSPACE_SETTINGS.activityLogEnabled,
      activityLogMaxRows: normalizeWorkspaceActivityLogMaxRows(settings.activityLogMaxRows)
    };
  }

  private resolveNextWorkspaceBrandingSettings(
    context: WorkspaceContext,
    settings: WorkspaceSettings,
    input: WorkspaceSettingsUpdateInput,
    databaseDirectoryChanged: boolean
  ): WorkspaceSettings {
    if (input.clearCompanyLogo) {
      return {
        ...settings,
        companyLogoPath: ''
      };
    }

    if (input.companyLogoSourceFilePath) {
      return {
        ...settings,
        companyLogoPath: this.buildCompanyLogoRelativePath(settings, input.companyLogoSourceFilePath)
      };
    }

    return {
      ...settings,
      companyLogoPath:
        databaseDirectoryChanged && context.settings.companyLogoPath.trim()
          ? this.rewriteWorkspaceRootPrefix(
              context.settings.companyLogoPath,
              context.settings.databaseDirectoryName,
              settings.databaseDirectoryName
            )
          : context.settings.companyLogoPath
    };
  }

  private assertWorkspaceRootDirectoriesAreValid(settings: WorkspaceSettings): void {
    const seenNames = new Set<string>();

    for (const key of WORKSPACE_ROOT_DIRECTORY_SETTING_KEYS) {
      const value = settings[key].trim();
      if (!isValidWorkspaceRootDirectoryName(value)) {
        throw new Error(`${key} contains characters that are not allowed in folder names.`);
      }

      const dedupeKey = value.toLowerCase();
      if (seenNames.has(dedupeKey)) {
        throw new Error('Workspace root folder names must be unique.');
      }

      seenNames.add(dedupeKey);
    }
  }

  private renameDocumentsRootDirectory(
    context: WorkspaceContext,
    nextSettings: WorkspaceSettings
  ): string[] {
    const currentDirectoryName = context.settings.documentsDirectoryName;
    const nextDirectoryName = nextSettings.documentsDirectoryName;

    if (currentDirectoryName === nextDirectoryName) {
      return [];
    }

    const currentPrefix = `${currentDirectoryName}/`;
    const documentRows = context.db
      .prepare('SELECT Id, DocumentFolderPath FROM Documents ORDER BY Id ASC')
      .all() as Array<{ Id: number; DocumentFolderPath: string }>;
    const fileRows = context.db
      .prepare('SELECT Id, FilePath FROM DocumentVersionFiles ORDER BY Id ASC')
      .all() as Array<{ Id: number; FilePath: string }>;

    context.db.transaction(() => {
      for (const documentRow of documentRows) {
        const normalizedPath = this.fileStorageService.normalizeRelativePath(documentRow.DocumentFolderPath);
        const nextPath = normalizedPath.startsWith(currentPrefix)
          ? `${nextDirectoryName}/${normalizedPath.slice(currentPrefix.length)}`
          : normalizedPath;
        context.db.prepare('UPDATE Documents SET DocumentFolderPath = ? WHERE Id = ?').run(nextPath, documentRow.Id);
      }

      for (const fileRow of fileRows) {
        const normalizedPath = this.fileStorageService.normalizeRelativePath(fileRow.FilePath);
        const nextPath = normalizedPath.startsWith(currentPrefix)
          ? `${nextDirectoryName}/${normalizedPath.slice(currentPrefix.length)}`
          : normalizedPath;
        context.db.prepare('UPDATE DocumentVersionFiles SET FilePath = ? WHERE Id = ?').run(nextPath, fileRow.Id);
      }
    })();

    this.renameWorkspaceRootDirectory(
      context.rootPath,
      currentDirectoryName,
      nextDirectoryName,
      'Documents'
    );

    return [];
  }

  private renameWorkspaceRootDirectory(
    rootPath: string,
    currentDirectoryName: string,
    nextDirectoryName: string,
    label: string
  ): void {
    if (currentDirectoryName === nextDirectoryName) {
      return;
    }

    const currentPath = path.join(rootPath, currentDirectoryName);
    const nextPath = path.join(rootPath, nextDirectoryName);

    if (existsSync(nextPath)) {
      throw new Error(`${label} folder "${nextDirectoryName}" already exists in the workspace root.`);
    }

    if (!existsSync(currentPath)) {
      mkdirSync(nextPath, { recursive: true });
      return;
    }

    renameSync(currentPath, nextPath);
  }

  private refreshContextLayoutPaths(context: WorkspaceContext): void {
    context.databaseDirectoryPath = path.join(context.rootPath, context.settings.databaseDirectoryName);
    context.documentsDirectoryPath = path.join(context.rootPath, context.settings.documentsDirectoryName);
    context.templatesDirectoryPath = path.join(context.rootPath, context.settings.templatesDirectoryName);
    context.backupsDirectoryPath = path.join(context.rootPath, context.settings.backupsDirectoryName);
    context.databaseFilePath = path.join(
      context.rootPath,
      context.settings.databaseDirectoryName,
      WORKSPACE_DATABASE_FILE_NAME
    );
  }

  private buildCompanyLogoRelativePath(settings: WorkspaceSettings, sourceFilePath: string): string {
    const extension = (path.extname(sourceFilePath).toLowerCase() || '.png').replace(/[^.\w-]/g, '');
    return `${getWorkspaceDatabaseDirectoryRelativePath(settings)}/branding/company-logo${extension}`;
  }

  private rewriteWorkspaceRootPrefix(
    relativePath: string,
    currentDirectoryName: string,
    nextDirectoryName: string
  ): string {
    const normalized = this.fileStorageService.normalizeRelativePath(relativePath);
    if (!normalized) {
      return normalized;
    }

    if (normalized === currentDirectoryName) {
      return nextDirectoryName;
    }

    const prefix = `${currentDirectoryName}/`;
    return normalized.startsWith(prefix)
      ? `${nextDirectoryName}/${normalized.slice(prefix.length)}`
      : normalized;
  }

  private storeWorkspaceCompanyLogo(
    context: WorkspaceContext,
    sourceFilePath: string,
    settings: WorkspaceSettings = context.settings
  ): string {
    const relativePath = this.buildCompanyLogoRelativePath(settings, sourceFilePath);
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

    const brandingDirectory = path.join(
      context.rootPath,
      context.settings.databaseDirectoryName,
      'branding'
    );
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
