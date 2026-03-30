import { DOCUMENT_VERSION_FILE_ROLES, isDocumentVersionFileRole } from '@shared/documentModel';

export const WORKSPACE_DATABASE_DIRECTORY_NAME = 'Database';
export const WORKSPACE_DATABASE_FILE_NAME = 'workspace.sqlite';
export const WORKSPACE_DOCUMENTS_DIRECTORY_NAME = 'Documents';

export const WORKSPACE_STORAGE_LAYOUT_PRESETS = ['stable-id', 'friendly-id'] as const;
export const WORKSPACE_FILE_ORGANIZATION_MODES = ['flat', 'role-subfolders'] as const;
export const DOCUMENT_TABLE_COLUMNS = [
  'documentId',
  'title',
  'documentType',
  'version',
  'status',
  'author',
  'language',
  'confidentialityClass',
  'project',
  'company',
  'department',
  'createdDate',
  'modifiedDate',
  'releasedDate',
  'approvedBy',
  'revisionIntervalMonths',
  'revisionDescription'
] as const;

export type WorkspaceStorageLayoutPreset = (typeof WORKSPACE_STORAGE_LAYOUT_PRESETS)[number];
export type WorkspaceFileOrganizationMode = (typeof WORKSPACE_FILE_ORGANIZATION_MODES)[number];
export type DocumentTableColumn = (typeof DOCUMENT_TABLE_COLUMNS)[number];

export interface WorkspaceSettings {
  storageLayoutPreset: WorkspaceStorageLayoutPreset;
  fileOrganizationMode: WorkspaceFileOrganizationMode;
  visibleDocumentColumns: DocumentTableColumn[];
  defaultCompany: string;
  defaultDepartment: string;
  autoMarkPreviousVersionObsolete: boolean;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  storageLayoutPreset: 'stable-id',
  fileOrganizationMode: 'flat',
  visibleDocumentColumns: [...DOCUMENT_TABLE_COLUMNS],
  defaultCompany: '',
  defaultDepartment: '',
  autoMarkPreviousVersionObsolete: true
};

export const WORKSPACE_STORAGE_LAYOUT_OPTIONS: Array<{
  value: WorkspaceStorageLayoutPreset;
  label: string;
  description: string;
}> = [
  {
    value: 'stable-id',
    label: 'Stable document IDs',
    description: 'Documents/<Type>/<DocumentId>/v<Version>/<File>'
  },
  {
    value: 'friendly-id',
    label: 'Friendly document folders',
    description: 'Documents/<Type>/<DocumentId> - <Title>/v<Version>/<File>'
  }
];

export const WORKSPACE_FILE_ORGANIZATION_OPTIONS: Array<{
  value: WorkspaceFileOrganizationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'flat',
    label: 'Flat version folders',
    description: '<Version>/<File>'
  },
  {
    value: 'role-subfolders',
    label: 'Role subfolders',
    description: '<Version>/<Role>/<File>'
  }
];

export const DOCUMENT_TABLE_COLUMN_OPTIONS: Array<{
  value: DocumentTableColumn;
  label: string;
}> = [
  { value: 'documentId', label: 'Document ID' },
  { value: 'title', label: 'Title' },
  { value: 'documentType', label: 'Document Type' },
  { value: 'version', label: 'Version' },
  { value: 'status', label: 'Status' },
  { value: 'author', label: 'Author' },
  { value: 'language', label: 'Language' },
  { value: 'confidentialityClass', label: 'Confidentiality Class' },
  { value: 'project', label: 'Project' },
  { value: 'company', label: 'Company' },
  { value: 'department', label: 'Department' },
  { value: 'createdDate', label: 'Created Date' },
  { value: 'modifiedDate', label: 'Modified Date' },
  { value: 'releasedDate', label: 'Released Date' },
  { value: 'approvedBy', label: 'Approved By' },
  { value: 'revisionIntervalMonths', label: 'Revision Interval' },
  { value: 'revisionDescription', label: 'Revision Description' }
];

const INVALID_PATH_SEGMENT = /[<>:"/\\|?*\u0000-\u001f]/g;

const joinRelativeSegments = (...segments: string[]): string =>
  segments
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => segment.replace(/^[/\\]+|[/\\]+$/g, ''))
    .filter(Boolean)
    .join('/');

export const sanitizeStoragePathSegment = (value: string, fallback = 'Untitled'): string => {
  const sanitized = value
    .replace(INVALID_PATH_SEGMENT, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return sanitized || fallback;
};

export const isWorkspaceStorageLayoutPreset = (
  value: string
): value is WorkspaceStorageLayoutPreset => WORKSPACE_STORAGE_LAYOUT_PRESETS.includes(value as WorkspaceStorageLayoutPreset);

export const isWorkspaceFileOrganizationMode = (
  value: string
): value is WorkspaceFileOrganizationMode =>
  WORKSPACE_FILE_ORGANIZATION_MODES.includes(value as WorkspaceFileOrganizationMode);

export const isDocumentTableColumn = (value: string): value is DocumentTableColumn =>
  DOCUMENT_TABLE_COLUMNS.includes(value as DocumentTableColumn);

export const normalizeVisibleDocumentColumns = (value: unknown): DocumentTableColumn[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns];
  }

  const selected = new Set(
    value.filter((item): item is DocumentTableColumn => typeof item === 'string' && isDocumentTableColumn(item))
  );

  const normalized = DOCUMENT_TABLE_COLUMNS.filter((column) => selected.has(column));
  return normalized.length > 0 ? normalized : [...DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns];
};

export const getWorkspaceDatabaseRelativePath = (): string =>
  joinRelativeSegments(WORKSPACE_DATABASE_DIRECTORY_NAME, WORKSPACE_DATABASE_FILE_NAME);

export const getDocumentTypeDirectoryRelativePath = (documentTypeName: string): string =>
  joinRelativeSegments(
    WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
    sanitizeStoragePathSegment(documentTypeName, 'Uncategorized')
  );

export const buildDocumentFolderRelativePath = (
  settings: WorkspaceSettings,
  documentTypeName: string,
  documentId: string,
  title: string
): string => {
  const typeDirectory = getDocumentTypeDirectoryRelativePath(documentTypeName);
  const documentDirectory =
    settings.storageLayoutPreset === 'friendly-id'
      ? `${documentId} - ${sanitizeStoragePathSegment(title)}`
      : documentId;

  return joinRelativeSegments(typeDirectory, documentDirectory);
};

export const buildDocumentVersionRelativePath = (
  documentFolderPath: string,
  versionLabel: string
): string => joinRelativeSegments(documentFolderPath, sanitizeStoragePathSegment(versionLabel, 'version'));

export const buildVersionFileRelativePath = (
  settings: WorkspaceSettings,
  versionFolderPath: string,
  role: string,
  fileName: string
): string =>
  joinRelativeSegments(
    versionFolderPath,
    settings.fileOrganizationMode === 'role-subfolders' && isDocumentVersionFileRole(role)
      ? role
      : '',
    sanitizeStoragePathSegment(fileName, 'document.bin')
  );

export const getRecognizedRoleDirectoryNames = (): string[] => [...DOCUMENT_VERSION_FILE_ROLES];

export const isRecognizedRoleDirectoryName = (value: string): boolean =>
  isDocumentVersionFileRole(value);
