import type {
  DocumentVersionFileRole,
  DocumentVersionScheme,
  VersionBumpType
} from '@shared/documentModel';
import type { ApplicationSettings } from '@shared/applicationSettings';
import type { DocumentTableColumn, WorkspaceSettings } from '@shared/workspaceLayout';

export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'] as const;
export const DOCUMENT_HEALTH_FLAGS = [
  'overdueReview',
  'missingFiles',
  'unversionedShell',
  'unmanagedPaths',
  'staleDocument'
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentHealthFlag = (typeof DOCUMENT_HEALTH_FLAGS)[number];

export interface WorkspaceInfo {
  id: number;
  name: string;
  rootPath: string;
  createdDate: string;
  isOpen: boolean;
}

export interface DocumentType {
  id: number;
  name: string;
  numberPrefix: string;
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

export interface DocumentListItem {
  id: number;
  documentId: string;
  title: string;
  typeId: number;
  typeName: string;
  versionScheme: DocumentVersionScheme;
  status: DocumentStatus | null;
  latestVersionLabel: string | null;
  releasedDate: string | null;
  approvedBy: string;
  revisionDescription: string;
  modifiedDate: string;
  createdDate: string;
  author: string;
  languageId: number | null;
  languageCode: string | null;
  confidentialityClassId: number | null;
  confidentialityClassName: string | null;
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
}

export interface RecentActivityItem {
  id: number;
  eventType: string;
  message: string;
  createdDate: string;
  documentRecordId: number | null;
  documentVersionId: number | null;
}

export interface DashboardInsight {
  id: string;
  label: string;
  count: number;
  tone: 'default' | 'success' | 'warning' | 'danger';
  status?: DocumentStatus | 'Not started';
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
  project: string;
}

export interface DocumentExportRequest {
  format: DocumentExportFormat;
  scope: DocumentExportScope;
  groupBy: DocumentExportGrouping;
  pdfColorMode: DocumentExportPdfColorMode;
  workspaceName: string;
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
  approvedBy: string;
  createdDate: string;
  revisionDescription: string;
  files: DocumentVersionFile[];
  unmanagedPaths: string[];
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
  languageId: number | null;
  languageCode: string | null;
  confidentialityClassId: number | null;
  confidentialityClassName: string | null;
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
  author: string;
  versionScheme: DocumentVersionScheme;
  startDate?: string | null;
  languageId?: number | null;
  confidentialityClassId?: number | null;
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
  author: string;
  startDate?: string | null;
  languageId?: number | null;
  confidentialityClassId?: number | null;
  projectId?: number | null;
  company?: string;
  department?: string;
  revisionIntervalMonths?: number | null;
}

export interface UpdateDocumentVersionInput {
  documentVersionId: number;
  status: DocumentStatus;
  releasedDate: string | null;
  reviewedBy: string;
  approvedBy: string;
  revisionDescription: string;
}

export interface UpdateLatestVersionInput {
  documentRecordId: number;
  status: DocumentStatus;
  releasedDate: string | null;
  reviewedBy: string;
  approvedBy: string;
  revisionDescription: string;
}

export interface DocumentTypeInput {
  name: string;
  numberPrefix: string;
}

export interface ProjectInput {
  name: string;
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

export interface WorkspaceSummary {
  workspace: WorkspaceInfo;
  settings: WorkspaceSettings;
  documents: DocumentListItem[];
  dashboard: WorkspaceDashboardSummary;
  documentTypes: DocumentType[];
  projects: Project[];
  confidentialityClasses: ConfidentialityClass[];
  languages: WorkspaceLanguage[];
  statuses: DocumentStatus[];
}

export interface OpenWorkspaceResult {
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
  warnings?: string[];
}

export interface WorkspaceCreateInput {
  name: string;
  folderName?: string;
  parentPath: string;
  settings: WorkspaceSettings;
  includeExampleData?: boolean;
}

export interface WorkspaceSettingsUpdateInput {
  settings: WorkspaceSettings;
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

export interface RestoreBackupInput {
  backupId: string;
  destinationParentPath: string;
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

export interface ExampleSeedOptions {
  includeExampleData?: boolean;
}

export interface AppCatalogState {
  recentWorkspaces: RecentWorkspace[];
  applicationSettings: ApplicationSettings;
}
