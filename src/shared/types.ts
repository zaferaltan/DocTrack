import type { DocumentVersionFileRole, DocumentVersionScheme, VersionBumpType } from '@shared/documentModel';
import {
  DEFAULT_DOCUMENT_STATUSES,
  type WorkspaceLifecycle
} from '@shared/documentLifecycle';
import type {
  DashboardLayout,
  SavedView,
  SavedViewPresentation,
  SavedViewQuery,
  SavedViewScope
} from '@shared/savedViews';
import type { ApplicationSettings } from '@shared/applicationSettings';
import type { DocumentTableColumn, WorkspaceSettings } from '@shared/workspaceLayout';

export const DOCUMENT_STATUSES = [...DEFAULT_DOCUMENT_STATUSES];
export const DOCUMENT_HEALTH_FLAGS = [
  'overdueReview',
  'missingFiles',
  'unversionedShell',
  'unmanagedPaths',
  'staleDocument'
] as const;

export type DocumentStatus = string;
export type DocumentHealthFlag = (typeof DOCUMENT_HEALTH_FLAGS)[number];

export interface WorkspaceInfo {
  id: number;
  name: string;
  rootPath: string;
  createdDate: string;
  isOpen: boolean;
}

export const WORKSPACE_ROLES = ['admin', 'editor', 'viewer'] as const;

export type WorkspaceRole = string;
export type WorkspaceRoleMode = 'default' | 'custom';

export interface WorkspaceRolePermissions {
  canViewWorkspace: boolean;
  canEditDocuments: boolean;
  canManageSharedViews: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageWorkspaceSettings: boolean;
  canManageWorkspaceMaintenance: boolean;
}

export interface WorkspaceRoleDefinition {
  key: string;
  name: string;
  sortOrder: number;
  permissions: WorkspaceRolePermissions;
}

export interface WorkspaceRoleSettings {
  mode: WorkspaceRoleMode;
  roles: WorkspaceRoleDefinition[];
}

export interface WorkspaceRoleRemap {
  fromRoleKey: string;
  toRoleKey: string;
}

export interface WorkspaceRoleSettingsUpdateInput {
  mode: WorkspaceRoleMode;
  roles?: WorkspaceRoleDefinition[];
  roleRemaps?: WorkspaceRoleRemap[];
}

export interface WorkspacePermissions {
  canReadWorkspace: boolean;
  canEditWorkspace: boolean;
  canManageWorkspace: boolean;
  canViewWorkspace: boolean;
  canEditDocuments: boolean;
  canManageSharedViews: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageWorkspaceSettings: boolean;
  canManageWorkspaceMaintenance: boolean;
}

export interface WorkspaceUser {
  id: number;
  username: string;
  displayName: string;
  role: WorkspaceRole;
  roleName?: string;
  signInEnabled: boolean;
  archived: boolean;
  linkedRecordCount: number;
  lastSignedInDate: string | null;
  createdDate: string;
  modifiedDate: string;
}

export interface WorkspaceSession {
  user: WorkspaceUser;
  permissions: WorkspacePermissions;
  signedInAt: string;
}

export interface WorkspaceUserCredentialsInput {
  username: string;
  password: string;
}

export interface WorkspaceInitialAdminInput extends WorkspaceUserCredentialsInput {
  displayName: string;
}

export interface WorkspaceAccessRecoveryInput extends WorkspaceInitialAdminInput {}

export interface WorkspaceUserCreateInput extends WorkspaceInitialAdminInput {
  role: WorkspaceRole;
  signInEnabled?: boolean;
}

export interface WorkspaceUserUpdateInput {
  username: string;
  displayName: string;
  role: WorkspaceRole;
}

export interface WorkspaceUserPasswordResetInput {
  userId: number;
  password: string;
}

export interface WorkspaceUserRemovalResult {
  action: 'deleted' | 'archived';
  userId: number;
  user?: WorkspaceUser;
}

export interface DocumentType {
  id: number;
  name: string;
  numberPrefix: string;
}

export interface Group {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
}

export interface ConfidentialityClass {
  id: number;
  name: string;
}

export interface WorkspaceLanguage {
  id: number;
  code: string;
}

export interface TemplateFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  modifiedDate: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  folderPath: string;
  fileCount: number;
  modifiedDate: string | null;
  files: TemplateFile[];
}

export interface DocumentListItem {
  id: number;
  documentId: string;
  title: string;
  typeId: number;
  typeName: string;
  versionScheme: DocumentVersionScheme;
  status: DocumentStatus | null;
  latestVersionLabel: string | null;
  effectiveDate: string | null;
  releasedDate: string | null;
  approvedBy: string;
  approvedByUserId?: number | null;
  revisionDescription: string;
  modifiedDate: string;
  createdDate: string;
  author: string;
  authorUserId?: number | null;
  languageId: number | null;
  languageCode: string | null;
  confidentialityClassId: number | null;
  confidentialityClassName: string | null;
  groupId: number | null;
  groupName: string | null;
  projectId: number | null;
  projectName: string | null;
  company: string;
  department: string;
  startDate: string;
  revisionIntervalMonths: number | null;
  nextReviewDate: string | null;
  isOverdue: boolean;
  healthFlags: DocumentHealthFlag[];
  latestVersionFileCount: number;
  lastActivityDate: string;
  reviewedBy: string;
  reviewedByUserId?: number | null;
}

export interface RecentActivityItem {
  id: number;
  eventType: string;
  message: string;
  createdDate: string;
  documentRecordId: number | null;
  documentVersionId: number | null;
  actorUserId?: number | null;
  actorDisplayName?: string | null;
}

export interface DashboardInsight {
  id: string;
  label: string;
  count: number;
  tone: 'default' | 'success' | 'warning' | 'danger';
  status?: DocumentStatus | 'Not started';
  groupId?: number | null;
  projectId?: number | null;
  healthFlag?: DocumentHealthFlag;
}

export interface WorkspaceDashboardSummary {
  generatedDate: string;
  totalDocuments: number;
  countsByStatus: DashboardInsight[];
  countsByType: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  countsByGroup: Array<{
    id: string;
    label: string;
    count: number;
    groupId: number | null;
  }>;
  countsByProject: Array<{
    id: string;
    label: string;
    count: number;
    projectId: number | null;
  }>;
  healthInsights: DashboardInsight[];
  recentActivity: RecentActivityItem[];
}

export const DOCUMENT_EXPORT_FORMATS = ['csv', 'pdf'] as const;
export const DOCUMENT_EXPORT_SCOPES = ['current-table', 'whole-workspace'] as const;
export const DOCUMENT_EXPORT_PDF_COLOR_MODES = ['color', 'black-and-white'] as const;
export const DOCUMENT_EXPORT_GROUPINGS = [
  'none',
  'documentType',
  'status',
  'group',
  'project',
  'language',
  'confidentialityClass',
  'company',
  'department',
  'author'
] as const;

export type DocumentExportFormat = (typeof DOCUMENT_EXPORT_FORMATS)[number];
export type DocumentExportScope = (typeof DOCUMENT_EXPORT_SCOPES)[number];
export type DocumentExportPdfColorMode = (typeof DOCUMENT_EXPORT_PDF_COLOR_MODES)[number];
export type DocumentExportGrouping = (typeof DOCUMENT_EXPORT_GROUPINGS)[number];

export interface DocumentExportColumn {
  key: DocumentTableColumn;
  label: string;
}

export interface DocumentExportFilterSummary {
  search: string;
  status: string;
  group: string;
  project: string;
}

export interface DocumentExportRequest {
  format: DocumentExportFormat;
  scope: DocumentExportScope;
  groupBy: DocumentExportGrouping;
  pdfColorMode: DocumentExportPdfColorMode;
  workspaceName: string;
  lifecycle?: WorkspaceLifecycle;
  companyLogoPath: string | null;
  exportTimestamp: string;
  columns: DocumentExportColumn[];
  rows: DocumentListItem[];
  filters: DocumentExportFilterSummary;
}

export interface DocumentExportResult {
  canceled: boolean;
  filePath: string | null;
}

export interface DocumentVersionFile {
  id: number;
  documentVersionId: number;
  role: DocumentVersionFileRole;
  fileName: string;
  filePath: string;
  contentHash: string;
  fileSize: number;
  modifiedDate: string;
  createdDate: string;
}

export const VERSION_FILESYSTEM_STATES = ['clean', 'dirty', 'ambiguous'] as const;

export type VersionFilesystemState = (typeof VERSION_FILESYSTEM_STATES)[number];

export const VERSION_FILESYSTEM_CHANGE_KINDS = [
  'missingTracked',
  'newUnmanaged',
  'renamed',
  'roleMoved',
  'modified',
  'collision',
  'nestedUnmanaged'
] as const;

export type VersionFilesystemChangeKind = (typeof VERSION_FILESYSTEM_CHANGE_KINDS)[number];

export interface VersionFilesystemChange {
  kind: VersionFilesystemChangeKind;
  trackedFileId?: number;
  trackedPath?: string;
  discoveredPath?: string;
  suggestedRole?: DocumentVersionFileRole;
  message: string;
}

export const FILE_PREVIEW_KINDS = ['pdf', 'image', 'text', 'csv', 'unsupported'] as const;

export type FilePreviewKind = (typeof FILE_PREVIEW_KINDS)[number];

export interface FilePreviewDescriptor {
  fileId: number;
  fileName: string;
  filePath: string;
  absolutePath: string;
  kind: FilePreviewKind;
}

export interface FilePreviewResult extends FilePreviewDescriptor {
  isSupported: boolean;
  previewUrl: string | null;
  textContent: string | null;
  warning: string | null;
}

export const VERSION_FILE_DELTA_TYPES = [
  'added',
  'removed',
  'renamed',
  'role-changed',
  'content-changed'
] as const;

export type VersionFileDeltaType = (typeof VERSION_FILE_DELTA_TYPES)[number];

export interface VersionFileDelta {
  changeType: VersionFileDeltaType;
  summary: string;
  before: DocumentVersionFile | null;
  after: DocumentVersionFile | null;
}

export interface VersionComparisonResult {
  currentVersionId: number;
  previousVersionId: number;
  currentVersionLabel: string;
  previousVersionLabel: string;
  deltas: VersionFileDelta[];
  unchangedCount: number;
}

export interface VersionFileImportCandidate {
  sourceFilePath: string;
  fileName: string;
  suggestedRole: DocumentVersionFileRole;
  duplicateWarnings: string[];
}

export interface VersionFileImportPlan {
  versionId: number;
  suggestedRole: DocumentVersionFileRole;
  hasBlockingDuplicates: boolean;
  warnings: string[];
  candidates: VersionFileImportCandidate[];
}

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionDocumentId: string;
  sequenceNumber: number;
  versionLabel: string;
  status: DocumentStatus;
  releasedDate: string | null;
  reviewedBy: string;
  reviewedByUserId?: number | null;
  approvedBy: string;
  approvedByUserId?: number | null;
  createdDate: string;
  revisionDescription: string;
  files: DocumentVersionFile[];
  unmanagedPaths: string[];
  filesystemState: VersionFilesystemState;
  filesystemChanges: VersionFilesystemChange[];
}

export interface DocumentDetail {
  id: number;
  documentId: string;
  title: string;
  typeId: number;
  typeName: string;
  versionScheme: DocumentVersionScheme;
  documentFolderPath: string;
  createdDate: string;
  modifiedDate: string;
  author: string;
  authorUserId?: number | null;
  languageId: number | null;
  languageCode: string | null;
  confidentialityClassId: number | null;
  confidentialityClassName: string | null;
  groupId: number | null;
  groupName: string | null;
  projectId: number | null;
  projectName: string | null;
  company: string;
  department: string;
  startDate: string;
  revisionIntervalMonths: number | null;
  versions: DocumentVersion[];
}

export interface CreateDocumentInput {
  title: string;
  documentTypeId: number;
  authorUserId?: number | null;
  author?: string;
  versionScheme: DocumentVersionScheme;
  templateId?: string | null;
  startDate?: string | null;
  languageId?: number | null;
  confidentialityClassId?: number | null;
  groupId?: number | null;
  projectId?: number | null;
  company?: string;
  department?: string;
  revisionIntervalMonths?: number | null;
}

export interface CreateVersionInput {
  documentRecordId: number;
  revisionDescription: string;
  bumpType?: VersionBumpType;
}

export interface DeleteDocumentInput {
  documentRecordId: number;
}

export interface DeleteDocumentVersionInput {
  documentVersionId: number;
}

export interface UpdateDocumentInput {
  documentRecordId: number;
  title: string;
  authorUserId?: number | null;
  author?: string;
  startDate?: string | null;
  languageId?: number | null;
  confidentialityClassId?: number | null;
  groupId?: number | null;
  projectId?: number | null;
  company?: string;
  department?: string;
  revisionIntervalMonths?: number | null;
}

export interface UpdateDocumentVersionInput {
  documentVersionId: number;
  status: DocumentStatus;
  releasedDate: string | null;
  reviewedByUserId?: number | null;
  reviewedBy?: string;
  approvedByUserId?: number | null;
  approvedBy?: string;
  revisionDescription: string;
}

export interface UpdateLatestVersionInput {
  documentRecordId: number;
  status: DocumentStatus;
  releasedDate: string | null;
  reviewedByUserId?: number | null;
  reviewedBy?: string;
  approvedByUserId?: number | null;
  approvedBy?: string;
  revisionDescription: string;
}

export interface DocumentTypeInput {
  name: string;
  numberPrefix: string;
}

export interface GroupInput {
  name: string;
}

export interface ProjectInput {
  name: string;
}

export interface CreateTemplateInput {
  name: string;
}

export interface AddTemplateFilesInput {
  templateId: string;
  sourceFilePaths: string[];
}

export interface ConfidentialityClassInput {
  name: string;
}

export interface WorkspaceLanguageInput {
  code: string;
}

export interface AddDocumentVersionFilesInput {
  documentVersionId: number;
  role: DocumentVersionFileRole;
  sourceFilePaths: string[];
}

export interface RenameDocumentVersionFileInput {
  fileId: number;
  nextFileName: string;
}

export interface DeleteDocumentVersionFileInput {
  fileId: number;
}

export interface ChangeDocumentVersionFileRoleInput {
  fileId: number;
  role: DocumentVersionFileRole;
}

export interface ApplyVersionFilesystemReconciliationInput {
  changeIndexes?: number[];
}

export interface WorkspaceSummary {
  workspace: WorkspaceInfo;
  settings: WorkspaceSettings;
  lifecycle: WorkspaceLifecycle;
  roleSettings?: WorkspaceRoleSettings;
  users?: WorkspaceUser[];
  documents: DocumentListItem[];
  dashboard: WorkspaceDashboardSummary;
  dashboardLayout: DashboardLayout;
  documentTypes: DocumentType[];
  groups: Group[];
  projects: Project[];
  templates: TemplateSummary[];
  confidentialityClasses: ConfidentialityClass[];
  languages: WorkspaceLanguage[];
  statuses: DocumentStatus[];
  savedViews: SavedView[];
}

export interface AuthenticatedWorkspaceResult {
  kind: 'authenticated';
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
  session: WorkspaceSession;
  users?: WorkspaceUser[];
  warnings?: string[];
}

export interface UnauthenticatedWorkspaceResult {
  kind: 'unauthenticated';
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
  users: WorkspaceUser[];
  canRecoverAccess: boolean;
  session: null;
  warnings?: string[];
}

export type OpenWorkspaceResult = AuthenticatedWorkspaceResult | UnauthenticatedWorkspaceResult;

export interface WorkspaceCreateInput {
  name: string;
  folderName?: string;
  parentPath: string;
  settings: WorkspaceSettings;
  lifecycle?: WorkspaceLifecycle;
  includeExampleData?: boolean;
  initialAdmin?: WorkspaceInitialAdminInput;
}

export interface WorkspaceSettingsUpdateInput {
  settings: WorkspaceSettings;
  lifecycle?: WorkspaceLifecycle;
  initialAdmin?: WorkspaceInitialAdminInput;
  statusRemaps?: Array<{
    fromStatusKey: string;
    toStatusKey: string;
  }>;
  companyLogoSourceFilePath?: string | null;
  clearCompanyLogo?: boolean;
}

export interface WorkspaceOpenInput {
  rootPath: string;
}

export interface RecentWorkspace {
  rootPath: string;
  name: string;
  lastOpenedDate: string;
}

export interface CreateSavedViewInput {
  name: string;
  scope: SavedViewScope;
  query: SavedViewQuery;
  presentation: SavedViewPresentation;
}

export interface UpdateSavedViewInput {
  name: string;
  query: SavedViewQuery;
  presentation: SavedViewPresentation;
}

export interface DuplicateSavedViewInput {
  savedViewId: string;
  scope: SavedViewScope;
  name?: string;
}

export interface DeleteSavedViewInput {
  savedViewId: string;
  scope: SavedViewScope;
}

export interface PromoteSavedViewToSharedInput {
  savedViewId: string;
}

export interface PromoteSavedViewToSharedResult {
  savedView: SavedView;
}

export interface WorkspaceRepairIssue {
  kind: 'misplacedDocument';
  documentRecordId: number;
  documentId: string;
  title: string;
  currentPath: string;
  expectedPath: string;
}

export interface WorkspaceScanResult {
  issues: WorkspaceRepairIssue[];
}

export interface UpdateDashboardLayoutInput {
  layout: DashboardLayout;
}

export interface WorkspaceBackupSummary {
  id: string;
  label: string;
  createdDate: string;
  backupPath: string;
  manifestPath: string;
  workspaceName: string;
  documentCount: number;
  versionCount: number;
  fileCount: number;
  sizeBytes: number;
  reason: 'manual' | 'safety';
}

export interface CreateBackupResult {
  backup: WorkspaceBackupSummary;
}

export interface RestoreBackupPreview {
  backup: WorkspaceBackupSummary;
  suggestedWorkspaceName: string;
  destinationRootPath: string;
  destinationExists: boolean;
}

export const RESTORE_BACKUP_MODES = [
  'overwrite-current-database',
  'export-to-new-workspace'
] as const;

export type RestoreBackupMode = (typeof RESTORE_BACKUP_MODES)[number];

export const RESTORE_BACKUP_DIFF_CHANGE_TYPES = ['added', 'removed', 'changed'] as const;

export type RestoreBackupDiffChangeType = (typeof RESTORE_BACKUP_DIFF_CHANGE_TYPES)[number];

export interface RestoreBackupDiffField {
  label: string;
  liveValue: string | null;
  backupValue: string | null;
}

export interface RestoreBackupDiffItem {
  id: string;
  label: string;
  changeType: RestoreBackupDiffChangeType;
  fields: RestoreBackupDiffField[];
}

export interface RestoreBackupDiffSection {
  id:
    | 'workspaceSettings'
    | 'users'
    | 'documentTypes'
    | 'groups'
    | 'projects'
    | 'confidentialityClasses'
    | 'languages'
    | 'documents'
    | 'versions'
    | 'trackedFiles';
  label: string;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  items: RestoreBackupDiffItem[];
}

export interface RestoreBackupDiffResult {
  backup: WorkspaceBackupSummary;
  generatedDate: string;
  sections: RestoreBackupDiffSection[];
  totals: {
    addedCount: number;
    removedCount: number;
    changedCount: number;
  };
}

export interface RestoreBackupInput {
  backupId: string;
  mode: RestoreBackupMode;
  destinationParentPath?: string;
  destinationFolderName?: string;
}

export interface IntegrityCheckIssue {
  code:
    | 'missing-database'
    | 'missing-document-folder'
    | 'missing-version-folder'
    | 'missing-managed-file'
    | 'unreadable-path';
  severity: 'warning' | 'error';
  path: string;
  message: string;
  documentRecordId?: number;
  documentVersionId?: number;
}

export interface IntegrityCheckResult {
  checkedDate: string;
  issueCount: number;
  issues: IntegrityCheckIssue[];
}

export interface WorkspaceFilesystemDriftEvent {
  rootPath: string;
  paths: string[];
  changedAt: string;
}

export interface ExampleSeedOptions {
  includeExampleData?: boolean;
}

export interface AppCatalogState {
  recentWorkspaces: RecentWorkspace[];
  applicationSettings: ApplicationSettings;
  personalSavedViewsByWorkspace: Record<string, SavedView[]>;
}
