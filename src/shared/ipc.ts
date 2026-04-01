import type { ApplicationSettings } from '@shared/applicationSettings';
import type {
  AddTemplateFilesInput,
  AddDocumentVersionFilesInput,
  ChangeDocumentVersionFileRoleInput,
  CreateBackupResult,
  ConfidentialityClass,
  ConfidentialityClassInput,
  CreateTemplateInput,
  CreateDocumentInput,
  DeleteDocumentInput,
  DeleteDocumentVersionInput,
  CreateVersionInput,
  DeleteDocumentVersionFileInput,
  DocumentDetail,
  DocumentExportRequest,
  DocumentExportResult,
  FilePreviewResult,
  IntegrityCheckResult,
  DocumentListItem,
  DocumentVersion,
  DocumentVersionFile,
  DocumentType,
  DocumentTypeInput,
  OpenWorkspaceResult,
  Project,
  ProjectInput,
  RecentWorkspace,
  RenameDocumentVersionFileInput,
  RestoreBackupInput,
  RestoreBackupPreview,
  TemplateSummary,
  UpdateDocumentVersionInput,
  VersionComparisonResult,
  VersionFileImportPlan,
  WorkspaceBackupSummary,
  WorkspaceDashboardSummary,
  UpdateDocumentInput,
  UpdateLatestVersionInput,
  WorkspaceLanguage,
  WorkspaceLanguageInput,
  WorkspaceCreateInput,
  WorkspaceInfo,
  WorkspaceSettingsUpdateInput
} from '@shared/types';
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
  workspaceUpdateSettings: 'workspace:updateSettings',
  workspaceListBackups: 'workspace:listBackups',
  workspaceCreateBackup: 'workspace:createBackup',
  workspaceGetRestorePreview: 'workspace:getRestorePreview',
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
  appSettingsUpdate: 'appSettings:update'
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
    updateSettings: (rootPath: string, input: WorkspaceSettingsUpdateInput) => Promise<OpenWorkspaceResult>;
    listBackups: (rootPath: string) => Promise<WorkspaceBackupSummary[]>;
    createBackup: (rootPath: string) => Promise<CreateBackupResult>;
    getRestorePreview: (
      rootPath: string,
      backupId: string,
      destinationParentPath: string,
      destinationFolderName?: string
    ) => Promise<RestoreBackupPreview>;
    restoreBackup: (rootPath: string, input: RestoreBackupInput) => Promise<OpenWorkspaceResult>;
    integrityCheck: (rootPath: string) => Promise<IntegrityCheckResult>;
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
}
