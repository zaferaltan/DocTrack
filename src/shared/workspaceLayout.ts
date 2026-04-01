import { DOCUMENT_VERSION_FILE_ROLES, isDocumentVersionFileRole } from '@shared/documentModel';

export const WORKSPACE_DATABASE_DIRECTORY_NAME = 'Database';
export const WORKSPACE_DATABASE_FILE_NAME = 'workspace.sqlite';
export const WORKSPACE_DOCUMENTS_DIRECTORY_NAME = 'Documents';

export const WORKSPACE_STORAGE_LAYOUT_PRESETS = ['stable-id', 'friendly-id'] as const;
export const WORKSPACE_FILE_ORGANIZATION_MODES = ['flat', 'role-subfolders'] as const;
export const WORKSPACE_VERSION_MANAGEMENT_MODES = [
  'shared-document-id',
  'version-specific-document-id'
] as const;
export const DOCUMENT_ID_FORMAT_PRESETS = [
  'legacy-numeric',
  'type-year-sequence',
  'type-language-year-sequence',
  'custom'
] as const;
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
  'startDate',
  'createdDate',
  'modifiedDate',
  'releasedDate',
  'reviewedBy',
  'approvedBy',
  'revisionIntervalMonths',
  'revisionDescription'
] as const;

export type WorkspaceStorageLayoutPreset = (typeof WORKSPACE_STORAGE_LAYOUT_PRESETS)[number];
export type WorkspaceFileOrganizationMode = (typeof WORKSPACE_FILE_ORGANIZATION_MODES)[number];
export type WorkspaceVersionManagementMode = (typeof WORKSPACE_VERSION_MANAGEMENT_MODES)[number];
export type DocumentIdFormatPreset = (typeof DOCUMENT_ID_FORMAT_PRESETS)[number];
export type DocumentTableColumn = (typeof DOCUMENT_TABLE_COLUMNS)[number];

export const DOCUMENT_ID_FORMAT_PRESET_TEMPLATES: Record<
  Exclude<DocumentIdFormatPreset, 'custom'>,
  string
> = {
  'legacy-numeric': '<docTypePrefix><year><sequence:5>',
  'type-year-sequence': '<docType>-<year>-<sequence:4>',
  'type-language-year-sequence': '<docType>-<language>-<year>-<sequence:4>'
};

export interface WorkspaceSettings {
  storageLayoutPreset: WorkspaceStorageLayoutPreset;
  fileOrganizationMode: WorkspaceFileOrganizationMode;
  versionManagementMode: WorkspaceVersionManagementMode;
  documentIdFormatPreset: DocumentIdFormatPreset;
  documentIdFormatTemplate: string;
  visibleDocumentColumns: DocumentTableColumn[];
  defaultCompany: string;
  defaultDepartment: string;
  companyLogoPath: string;
  autoMarkPreviousVersionObsolete: boolean;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  storageLayoutPreset: 'stable-id',
  fileOrganizationMode: 'flat',
  versionManagementMode: 'shared-document-id',
  documentIdFormatPreset: 'legacy-numeric',
  documentIdFormatTemplate: DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['legacy-numeric'],
  visibleDocumentColumns: [...DOCUMENT_TABLE_COLUMNS],
  defaultCompany: '',
  defaultDepartment: '',
  companyLogoPath: '',
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

export const WORKSPACE_VERSION_MANAGEMENT_OPTIONS: Array<{
  value: WorkspaceVersionManagementMode;
  label: string;
  description: string;
}> = [
  {
    value: 'shared-document-id',
    label: 'One document ID for all versions',
    description: 'Every version in the linked history keeps the same document ID.'
  },
  {
    value: 'version-specific-document-id',
    label: 'New document ID per version',
    description: 'Each new version gets its own document ID while the versions stay linked together.'
  }
];

export const DOCUMENT_ID_FORMAT_OPTIONS: Array<{
  value: DocumentIdFormatPreset;
  label: string;
  description: string;
  template: string;
}> = [
  {
    value: 'legacy-numeric',
    label: 'Legacy numeric',
    description: 'Classic prefix + year + padded sequence, like 02202600001.',
    template: DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['legacy-numeric']
  },
  {
    value: 'type-year-sequence',
    label: 'Type + year',
    description: 'Readable IDs based on document type, year, and sequence.',
    template: DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['type-year-sequence']
  },
  {
    value: 'type-language-year-sequence',
    label: 'Type + language + year',
    description: 'Readable IDs that also include the selected language code.',
    template: DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['type-language-year-sequence']
  },
  {
    value: 'custom',
    label: 'Custom template',
    description: 'Define your own format with placeholders and literal text.',
    template: DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['legacy-numeric']
  }
];

export const DOCUMENT_ID_TEMPLATE_PLACEHOLDER_OPTIONS: Array<{
  placeholder: string;
  label: string;
  example: string;
}> = [
  { placeholder: '<docTypePrefix>', label: '2-digit document type prefix', example: '02' },
  { placeholder: '<docType>', label: 'Document type name', example: 'PROCEDURE' },
  { placeholder: '<year>', label: '4-digit UTC year', example: '2026' },
  { placeholder: '<year2>', label: '2-digit UTC year', example: '26' },
  { placeholder: '<month>', label: '2-digit UTC month', example: '03' },
  { placeholder: '<day>', label: '2-digit UTC day', example: '31' },
  { placeholder: '<author>', label: 'Document author', example: 'JORDAN-SINGH' },
  { placeholder: '<language>', label: 'Language code or XX', example: 'EN' },
  { placeholder: '<company>', label: 'Company name', example: 'ACME-MANUFACTURING' },
  { placeholder: '<department>', label: 'Department name', example: 'QUALITY-ASSURANCE' },
  { placeholder: '<project>', label: 'Project name', example: 'QMS-ROLLOUT' },
  { placeholder: '<title>', label: 'Document title', example: 'OPERATING-PROCEDURE' },
  { placeholder: '<sequence:5>', label: 'Padded sequence number', example: '00001' }
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
  { value: 'startDate', label: 'Start Date' },
  { value: 'createdDate', label: 'Created Date' },
  { value: 'modifiedDate', label: 'Modified Date' },
  { value: 'releasedDate', label: 'Released Date' },
  { value: 'reviewedBy', label: 'Reviewed By' },
  { value: 'approvedBy', label: 'Approved By' },
  { value: 'revisionIntervalMonths', label: 'Revision Interval' },
  { value: 'revisionDescription', label: 'Revision Description' }
];

export const DOCUMENT_TABLE_COLUMN_LABELS: Record<DocumentTableColumn, string> =
  DOCUMENT_TABLE_COLUMN_OPTIONS.reduce(
    (labels, column) => ({
      ...labels,
      [column.value]: column.label
    }),
    {} as Record<DocumentTableColumn, string>
  );

export const getDocumentTableColumnLabel = (column: DocumentTableColumn): string =>
  DOCUMENT_TABLE_COLUMN_LABELS[column];

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

export const isWorkspaceVersionManagementMode = (
  value: string
): value is WorkspaceVersionManagementMode =>
  WORKSPACE_VERSION_MANAGEMENT_MODES.includes(value as WorkspaceVersionManagementMode);

export const isDocumentIdFormatPreset = (value: string): value is DocumentIdFormatPreset =>
  DOCUMENT_ID_FORMAT_PRESETS.includes(value as DocumentIdFormatPreset);

export const isDocumentTableColumn = (value: string): value is DocumentTableColumn =>
  DOCUMENT_TABLE_COLUMNS.includes(value as DocumentTableColumn);

export const getDocumentIdFormatTemplateForPreset = (preset: DocumentIdFormatPreset): string =>
  preset === 'custom'
    ? DOCUMENT_ID_FORMAT_PRESET_TEMPLATES['legacy-numeric']
    : DOCUMENT_ID_FORMAT_PRESET_TEMPLATES[preset];

export const normalizeDocumentIdFormatTemplate = (
  value: unknown,
  fallbackPreset: DocumentIdFormatPreset = DEFAULT_WORKSPACE_SETTINGS.documentIdFormatPreset
): string => {
  if (typeof value !== 'string') {
    return getDocumentIdFormatTemplateForPreset(fallbackPreset);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : getDocumentIdFormatTemplateForPreset(fallbackPreset);
};

export const resolveDocumentIdFormatTemplate = (
  settings: Pick<WorkspaceSettings, 'documentIdFormatPreset' | 'documentIdFormatTemplate'>
): string =>
  settings.documentIdFormatPreset === 'custom'
    ? normalizeDocumentIdFormatTemplate(settings.documentIdFormatTemplate)
    : getDocumentIdFormatTemplateForPreset(settings.documentIdFormatPreset);

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
