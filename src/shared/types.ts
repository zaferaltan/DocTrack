export const DOCUMENT_STATUSES = ['Draft', 'In Review', 'Released', 'Archived'] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WorkspaceInfo {
  id: number;
  name: string;
  filePath: string;
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
  status: DocumentStatus;
  latestVersion: number;
  modifiedDate: string;
  createdDate: string;
  author: string;
}

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionNumber: number;
  status: DocumentStatus;
  filePath: string;
  createdDate: string;
  notes: string;
}

export interface DocumentDetail {
  id: number;
  documentId: string;
  title: string;
  typeId: number;
  typeName: string;
  createdDate: string;
  modifiedDate: string;
  author: string;
  versions: DocumentVersion[];
}

export interface CreateDocumentInput {
  title: string;
  documentTypeId: number;
  author: string;
  notes: string;
  sourceFilePath: string;
}

export interface CreateVersionInput {
  documentRecordId: number;
  notes: string;
  sourceFilePath: string;
}

export interface UpdateDocumentStatusInput {
  documentRecordId: number;
  status: DocumentStatus;
}

export interface DocumentTypeInput {
  name: string;
  numberPrefix: string;
}

export interface WorkspaceSummary {
  workspace: WorkspaceInfo;
  documents: DocumentListItem[];
  documentTypes: DocumentType[];
  statuses: DocumentStatus[];
}

export interface OpenWorkspaceResult {
  workspace: WorkspaceInfo;
  summary: WorkspaceSummary;
}

export interface WorkspaceCreateInput {
  name: string;
  filePath: string;
  includeExampleData?: boolean;
}

export interface WorkspaceOpenInput {
  filePath: string;
}

export interface RecentWorkspace {
  filePath: string;
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
