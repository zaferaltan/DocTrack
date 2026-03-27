export const WORKSPACE_DATABASE_DIRECTORY_NAME = 'Database';
export const WORKSPACE_DATABASE_FILE_NAME = 'workspace.sqlite';
export const WORKSPACE_DOCUMENTS_DIRECTORY_NAME = 'Documents';

export const WORKSPACE_STORAGE_LAYOUT_PRESETS = ['stable-id', 'friendly-id'] as const;

export type WorkspaceStorageLayoutPreset = (typeof WORKSPACE_STORAGE_LAYOUT_PRESETS)[number];

export interface WorkspaceSettings {
  storageLayoutPreset: WorkspaceStorageLayoutPreset;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  storageLayoutPreset: 'stable-id'
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
  versionNumber: number,
  fileName: string
): string =>
  joinRelativeSegments(
    documentFolderPath,
    `v${versionNumber}`,
    sanitizeStoragePathSegment(fileName, 'document.bin')
  );
