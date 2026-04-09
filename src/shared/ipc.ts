import type { ApplicationSettings } from '@shared/applicationSettings';
import type { AppUpdateState } from '@shared/appUpdates';
import type {
  AddTemplateFilesInput,
  AddDocumentVersionFilesInput,
  ChangeDocumentVersionFileRoleInput,
  CreateBackupResult,
  CreateSavedViewInput,
  ConfidentialityClass,
  ConfidentialityClassInput,
  CreateTemplateInput,
  CreateDocumentInput,
  DeleteDocumentInput,
  DeleteDocumentVersionInput,
  DeleteSavedViewInput,
  CreateVersionInput,
  DeleteDocumentVersionFileInput,
  DuplicateSavedViewInput,
  DocumentDetail,
  DocumentExportRequest,
  DocumentExportResult,
  ApplyVersionFilesystemReconciliationInput,
  FilePreviewResult,
  IntegrityCheckResult,
  DocumentListItem,
  DocumentVersion,
  DocumentVersionFile,
  DocumentType,
  DocumentTypeInput,
  OpenWorkspaceResult,
  Project,
  PromoteSavedViewToSharedInput,
  PromoteSavedViewToSharedResult,
  ProjectInput,
  RecentWorkspace,
  RenameDocumentVersionFileInput,
  RestoreBackupDiffResult,
  RestoreBackupInput,
  RestoreBackupPreview,
  TemplateSummary,
  UpdateDocumentVersionInput,
  VersionComparisonResult,
  VersionFileImportPlan,
  WorkspaceFilesystemDriftEvent,
  WorkspaceBackupSummary,
  WorkspaceDashboardSummary,
  UpdateDocumentInput,
  UpdateDashboardLayoutInput,
  UpdateLatestVersionInput,
  UpdateSavedViewInput,
  WorkspaceLanguage,
  WorkspaceLanguageInput,
  WorkspaceCreateInput,
  WorkspaceInfo,
  RecentActivityItem,
  WorkspaceSettingsUpdateInput
} from '@shared/types';
import type { DashboardLayout, SavedView } from '@shared/savedViews';
import type { WorkspaceSettings } from '@shared/workspaceLayout';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceClose: 'workspace:close',
  workspaceListOpen: 'workspace:listOpen',
  workspaceListRecent: 'workspace:listRecent',
  workspaceDismissRecent: 'workspace:dismissRecent',
  workspaceGetSummary: 'workspace:getSummary',
  workspaceGetDashboard: 'workspace:getDashboard',
  workspaceGetDashboardLayout: 'workspace:getDashboardLayout',
  workspaceListActivity: 'workspace:listActivity',
  workspaceSignIn: 'workspace:signIn',
  workspaceSignOut: 'workspace:signOut',
  workspaceGetSession: 'workspace:getSession',
  workspaceListUsers: 'workspace:listUsers',
  workspaceRecoverAccess: 'workspace:recoverAccess',
    workspaceCreateUser: 'workspace:createUser',
    workspaceUpdateUser: 'workspace:updateUser',
    workspaceActivateUser: 'workspace:activateUser',
    workspaceDeactivateUser: 'workspace:deactivateUser',
    workspaceDeleteUser: 'workspace:deleteUser',
    workspaceUnarchiveUser: 'workspace:unarchiveUser',
    workspaceResetUserPassword: 'workspace:resetUserPassword',
  workspaceUpdateSettings: 'workspace:updateSettings',
  workspaceUpdateDashboardLayout: 'workspace:updateDashboardLayout',
  workspaceListBackups: 'workspace:listBackups',
  workspaceCreateBackup: 'workspace:createBackup',
  workspaceGetRestorePreview: 'workspace:getRestorePreview',
  workspaceGetRestoreDiff: 'workspace:getRestoreDiff',
  workspaceRestoreBackup: 'workspace:restoreBackup',
  workspaceIntegrityCheck: 'workspace:integrityCheck',
  dialogPickWorkspaceCreatePath: 'dialog:pickWorkspaceCreatePath',
  dialogPickWorkspaceOpenPath: 'dialog:pickWorkspaceOpenPath',
  dialogPickWorkspaceLogoFile: 'dialog:pickWorkspaceLogoFile',
  dialogPickDocumentFiles: 'dialog:pickDocumentFiles',
  documentsList: 'documents:list',
  documentsDetail: 'documents:detail',
  documentsCreate: 'documents:create',
  documentsUpdate: 'documents:update',
  documentsCreateVersion: 'documents:createVersion',
  documentsDelete: 'documents:delete',
  documentsDeleteVersion: 'documents:deleteVersion',
  documentsUpdateLatestVersion: 'documents:updateLatestVersion',
  documentsUpdateVersion: 'documents:updateVersion',
  documentsAddVersionFiles: 'documents:addVersionFiles',
  documentsRenameVersionFile: 'documents:renameVersionFile',
  documentsDeleteVersionFile: 'documents:deleteVersionFile',
  documentsChangeVersionFileRole: 'documents:changeVersionFileRole',
  documentsSyncVersionFiles: 'documents:syncVersionFiles',
  documentsGetVersionFilesystemPreview: 'documents:getVersionFilesystemPreview',
  documentsApplyVersionFilesystemReconciliation: 'documents:applyVersionFilesystemReconciliation',
  documentsOpenVersionFile: 'documents:openVersionFile',
  documentsOpenDocumentFolder: 'documents:openDocumentFolder',
  documentsOpenVersionFolder: 'documents:openVersionFolder',
  documentsOpenStoredPath: 'documents:openStoredPath',
  documentsExport: 'documents:export',
  documentsPreviewVersionFile: 'documents:previewVersionFile',
  documentsCompareVersions: 'documents:compareVersions',
  documentsPlanVersionFileImport: 'documents:planVersionFileImport',
  documentsReconcileUnmanagedPath: 'documents:reconcileUnmanagedPath',
  documentsIgnoreUnmanagedPath: 'documents:ignoreUnmanagedPath',
  workspaceFilesystemDrift: 'workspace:filesystemDrift',
  savedViewsList: 'savedViews:list',
  savedViewsCreate: 'savedViews:create',
  savedViewsUpdate: 'savedViews:update',
  savedViewsDelete: 'savedViews:delete',
  savedViewsDuplicate: 'savedViews:duplicate',
  savedViewsPromoteToShared: 'savedViews:promoteToShared',
  documentTypesList: 'documentTypes:list',
  documentTypesCreate: 'documentTypes:create',
  documentTypesUpdate: 'documentTypes:update',
  documentTypesDelete: 'documentTypes:delete',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsDelete: 'projects:delete',
  templatesList: 'templates:list',
  templatesCreate: 'templates:create',
  templatesAddFiles: 'templates:addFiles',
  templatesDelete: 'templates:delete',
  confidentialityClassesList: 'confidentialityClasses:list',
  confidentialityClassesCreate: 'confidentialityClasses:create',
  confidentialityClassesUpdate: 'confidentialityClasses:update',
  confidentialityClassesDelete: 'confidentialityClasses:delete',
  languagesList: 'languages:list',
  languagesCreate: 'languages:create',
  languagesUpdate: 'languages:update',
  languagesDelete: 'languages:delete',
  appSettingsGet: 'appSettings:get',
  appSettingsUpdate: 'appSettings:update',
  appUpdatesGetState: 'appUpdates:getState',
  appUpdatesCheckForUpdates: 'appUpdates:checkForUpdates',
  appUpdatesDownloadUpdate: 'appUpdates:downloadUpdate',
  appUpdatesQuitAndInstall: 'appUpdates:quitAndInstall',
  appUpdatesStateChanged: 'appUpdates:stateChanged'
} as const;

export interface DocTrackApi {
  workspace: {
    create: (input: WorkspaceCreateInput) => Promise<OpenWorkspaceResult>;
    open: (rootPath: string) => Promise<OpenWorkspaceResult>;
    close: (rootPath: string) => Promise<WorkspaceInfo[]>;
    listOpen: () => Promise<WorkspaceInfo[]>;
    listRecent: () => Promise<RecentWorkspace[]>;
    dismissRecent: (rootPath: string) => Promise<RecentWorkspace[]>;
    getSummary: (rootPath: string) => Promise<OpenWorkspaceResult>;
    getDashboard: (rootPath: string) => Promise<WorkspaceDashboardSummary>;
    getDashboardLayout: (rootPath: string) => Promise<DashboardLayout>;
    listActivity: (rootPath: string) => Promise<RecentActivityItem[]>;
    signIn: (
      rootPath: string,
      credentials: import('@shared/types').WorkspaceUserCredentialsInput
    ) => Promise<OpenWorkspaceResult>;
    signOut: (rootPath: string) => Promise<void>;
    getSession: (rootPath: string) => Promise<import('@shared/types').WorkspaceSession | null>;
    listUsers: (rootPath: string) => Promise<import('@shared/types').WorkspaceUser[]>;
    recoverAccess: (
      rootPath: string,
      input: import('@shared/types').WorkspaceAccessRecoveryInput
    ) => Promise<OpenWorkspaceResult>;
    createUser: (
      rootPath: string,
      input: import('@shared/types').WorkspaceUserCreateInput
    ) => Promise<import('@shared/types').WorkspaceUser>;
    updateUser: (
      rootPath: string,
      userId: number,
      input: import('@shared/types').WorkspaceUserUpdateInput
    ) => Promise<import('@shared/types').WorkspaceUser>;
    activateUser: (rootPath: string, userId: number) => Promise<import('@shared/types').WorkspaceUser>;
    deactivateUser: (rootPath: string, userId: number) => Promise<import('@shared/types').WorkspaceUser>;
    deleteUser: (
      rootPath: string,
      userId: number
    ) => Promise<import('@shared/types').WorkspaceUserRemovalResult>;
    unarchiveUser: (rootPath: string, userId: number) => Promise<import('@shared/types').WorkspaceUser>;
    resetUserPassword: (
      rootPath: string,
      input: import('@shared/types').WorkspaceUserPasswordResetInput
    ) => Promise<import('@shared/types').WorkspaceUser>;
    updateSettings: (rootPath: string, input: WorkspaceSettingsUpdateInput) => Promise<OpenWorkspaceResult>;
    updateDashboardLayout: (
      rootPath: string,
      input: UpdateDashboardLayoutInput
    ) => Promise<DashboardLayout>;
    listBackups: (rootPath: string) => Promise<WorkspaceBackupSummary[]>;
    createBackup: (rootPath: string) => Promise<CreateBackupResult>;
    getRestorePreview: (
      rootPath: string,
      backupId: string,
      destinationParentPath: string,
      destinationFolderName?: string
    ) => Promise<RestoreBackupPreview>;
    getRestoreDiff: (rootPath: string, backupId: string) => Promise<RestoreBackupDiffResult>;
    restoreBackup: (rootPath: string, input: RestoreBackupInput) => Promise<OpenWorkspaceResult>;
    integrityCheck: (rootPath: string) => Promise<IntegrityCheckResult>;
    onFilesystemDrift: (
      listener: (event: WorkspaceFilesystemDriftEvent) => void
    ) => () => void;
  };
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName?: string) => Promise<string | null>;
    pickWorkspaceOpenPath: () => Promise<string | null>;
    pickWorkspaceLogoFile: () => Promise<string | null>;
    pickDocumentFiles: () => Promise<string[]>;
    resolveDroppedFilePaths: (files: File[]) => Promise<string[]>;
  };
  documents: {
    list: (rootPath: string) => Promise<DocumentListItem[]>;
    detail: (rootPath: string, documentRecordId: number) => Promise<DocumentDetail>;
    create: (rootPath: string, input: CreateDocumentInput) => Promise<DocumentDetail>;
    update: (rootPath: string, input: UpdateDocumentInput) => Promise<DocumentDetail>;
    createVersion: (rootPath: string, input: CreateVersionInput) => Promise<DocumentDetail>;
    delete: (rootPath: string, input: DeleteDocumentInput) => Promise<void>;
    deleteVersion: (rootPath: string, input: DeleteDocumentVersionInput) => Promise<DocumentDetail>;
    updateLatestVersion: (rootPath: string, input: UpdateLatestVersionInput) => Promise<DocumentDetail>;
    updateVersion: (rootPath: string, input: UpdateDocumentVersionInput) => Promise<DocumentDetail>;
    addVersionFiles: (rootPath: string, input: AddDocumentVersionFilesInput) => Promise<DocumentVersion>;
    renameVersionFile: (
      rootPath: string,
      input: RenameDocumentVersionFileInput
    ) => Promise<DocumentVersion>;
    deleteVersionFile: (
      rootPath: string,
      input: DeleteDocumentVersionFileInput
    ) => Promise<DocumentVersion>;
    changeVersionFileRole: (
      rootPath: string,
      input: ChangeDocumentVersionFileRoleInput
    ) => Promise<DocumentVersion>;
    syncVersionFiles: (rootPath: string, documentVersionId: number) => Promise<DocumentVersion>;
    getVersionFilesystemPreview: (
      rootPath: string,
      documentVersionId: number
    ) => Promise<DocumentVersion>;
    applyVersionFilesystemReconciliation: (
      rootPath: string,
      documentVersionId: number,
      input: ApplyVersionFilesystemReconciliationInput
    ) => Promise<DocumentVersion>;
    openVersionFile: (rootPath: string, fileId: number) => Promise<void>;
    openDocumentFolder: (rootPath: string, documentRecordId: number) => Promise<void>;
    openVersionFolder: (rootPath: string, documentVersionId: number) => Promise<void>;
    openStoredPath: (rootPath: string, relativePath: string) => Promise<void>;
    export: (rootPath: string, request: DocumentExportRequest) => Promise<DocumentExportResult>;
    previewVersionFile: (rootPath: string, fileId: number) => Promise<FilePreviewResult>;
    compareVersions: (
      rootPath: string,
      currentVersionId: number,
      previousVersionId: number
    ) => Promise<VersionComparisonResult>;
    planVersionFileImport: (
      rootPath: string,
      documentVersionId: number,
      sourceFilePaths: string[]
    ) => Promise<VersionFileImportPlan>;
    reconcileUnmanagedPath: (
      rootPath: string,
      documentVersionId: number,
      relativePath: string
    ) => Promise<DocumentVersion>;
    ignoreUnmanagedPath: (
      rootPath: string,
      documentVersionId: number,
      relativePath: string
    ) => Promise<DocumentVersion>;
  };
  savedViews: {
    list: (rootPath: string) => Promise<SavedView[]>;
    create: (rootPath: string, input: CreateSavedViewInput) => Promise<SavedView>;
    update: (
      rootPath: string,
      savedViewId: string,
      scope: SavedView['scope'],
      input: UpdateSavedViewInput
    ) => Promise<SavedView>;
    delete: (rootPath: string, input: DeleteSavedViewInput) => Promise<void>;
    duplicate: (rootPath: string, input: DuplicateSavedViewInput) => Promise<SavedView>;
    promoteToShared: (
      rootPath: string,
      input: PromoteSavedViewToSharedInput
    ) => Promise<PromoteSavedViewToSharedResult>;
  };
  documentTypes: {
    list: (rootPath: string) => Promise<DocumentType[]>;
    create: (rootPath: string, input: DocumentTypeInput) => Promise<DocumentType>;
    update: (rootPath: string, id: number, input: DocumentTypeInput) => Promise<DocumentType>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  projects: {
    list: (rootPath: string) => Promise<Project[]>;
    create: (rootPath: string, input: ProjectInput) => Promise<Project>;
    update: (rootPath: string, id: number, input: ProjectInput) => Promise<Project>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  templates: {
    list: (rootPath: string) => Promise<TemplateSummary[]>;
    create: (rootPath: string, input: CreateTemplateInput) => Promise<TemplateSummary>;
    addFiles: (rootPath: string, input: AddTemplateFilesInput) => Promise<TemplateSummary>;
    delete: (rootPath: string, templateId: string) => Promise<void>;
  };
  confidentialityClasses: {
    list: (rootPath: string) => Promise<ConfidentialityClass[]>;
    create: (rootPath: string, input: ConfidentialityClassInput) => Promise<ConfidentialityClass>;
    update: (
      rootPath: string,
      id: number,
      input: ConfidentialityClassInput
    ) => Promise<ConfidentialityClass>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  languages: {
    list: (rootPath: string) => Promise<WorkspaceLanguage[]>;
    create: (rootPath: string, input: WorkspaceLanguageInput) => Promise<WorkspaceLanguage>;
    update: (rootPath: string, id: number, input: WorkspaceLanguageInput) => Promise<WorkspaceLanguage>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  appSettings: {
    get: () => Promise<ApplicationSettings>;
    update: (settings: ApplicationSettings) => Promise<ApplicationSettings>;
  };
  appUpdates: {
    getState: () => Promise<AppUpdateState>;
    checkForUpdates: () => Promise<AppUpdateState>;
    downloadUpdate: () => Promise<AppUpdateState>;
    quitAndInstall: () => Promise<void>;
    onStateChange: (listener: (state: AppUpdateState) => void) => () => void;
  };
}
