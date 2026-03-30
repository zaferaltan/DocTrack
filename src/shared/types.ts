import type {
  DocumentVersionFileRole,
  DocumentVersionScheme,
  VersionBumpType
} from '@shared/documentModel';
import type { ApplicationSettings } from '@shared/applicationSettings';
import type { WorkspaceSettings } from '@shared/workspaceLayout';

export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

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
  revisionIntervalMonths: number | null;
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

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionDocumentId: string;
  sequenceNumber: number;
  versionLabel: string;
  status: DocumentStatus;
  releasedDate: string | null;
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
  revisionIntervalMonths: number | null;
  versions: DocumentVersion[];
}

export interface CreateDocumentInput {
  title: string;
  documentTypeId: number;
  author: string;
  versionScheme: DocumentVersionScheme;
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

export interface UpdateDocumentInput {
  documentRecordId: number;
  title: string;
  author: string;
  languageId?: number | null;
  confidentialityClassId?: number | null;
  projectId?: number | null;
  company?: string;
  department?: string;
  revisionIntervalMonths?: number | null;
}

export interface UpdateLatestVersionInput {
  documentRecordId: number;
  status: DocumentStatus;
  releasedDate: string | null;
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

export interface WorkspaceOpenInput {
  rootPath: string;
}

export interface RecentWorkspace {
  rootPath: string;
  name: string;
  lastOpenedDate: string;
}

export interface ExampleSeedOptions {
  includeExampleData?: boolean;
}

export interface AppCatalogState {
  recentWorkspaces: RecentWorkspace[];
  applicationSettings: ApplicationSettings;
}
