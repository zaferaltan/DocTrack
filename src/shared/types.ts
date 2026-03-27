import type {
  DocumentVersionFileRole,
  DocumentVersionScheme,
  VersionBumpType
} from '@shared/documentModel';
import type { WorkspaceSettings } from '@shared/workspaceLayout';

export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Released', 'Archived'] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type ThemeMode = 'light' | 'dark' | 'system';

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

export interface DocumentListItem {
  id: number;
  documentId: string;
  title: string;
  typeId: number;
  typeName: string;
  versionScheme: DocumentVersionScheme;
  status: DocumentStatus | null;
  latestVersionLabel: string | null;
  modifiedDate: string;
  createdDate: string;
  author: string;
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
  sequenceNumber: number;
  versionLabel: string;
  status: DocumentStatus;
  createdDate: string;
  notes: string;
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
  versions: DocumentVersion[];
}

export interface CreateDocumentInput {
  title: string;
  documentTypeId: number;
  author: string;
  versionScheme: DocumentVersionScheme;
}

export interface CreateVersionInput {
  documentRecordId: number;
  notes: string;
  bumpType?: VersionBumpType;
}

export interface UpdateDocumentStatusInput {
  documentRecordId: number;
  status: DocumentStatus;
}

export interface DocumentTypeInput {
  name: string;
  numberPrefix: string;
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
  statuses: DocumentStatus[];
}

export interface OpenWorkspaceResult {
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
  warnings?: string[];
}

export interface WorkspaceCreateInput {
  name: string;
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
  themeMode: ThemeMode;
}
