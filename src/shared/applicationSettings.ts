import type { DocumentVersionScheme } from '@shared/documentModel';
import { DOCUMENT_TABLE_COLUMNS, type DocumentTableColumn } from '@shared/workspaceLayout';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export const APPLICATION_LAUNCH_BEHAVIORS = ['home', 'reopen-last-workspace'] as const;
export const WORKSPACE_VIEWS = [
  'documents',
  'documentTypes',
  'projects',
  'classifications',
  'languages'
] as const;
export const DOCUMENT_TABLE_DENSITIES = ['comfortable', 'compact'] as const;
export const DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS: DocumentTableColumn[] = [
  'documentId',
  'title',
  'documentType',
  'version',
  'status',
  'project'
];

export type ThemeMode = (typeof THEME_MODES)[number];
export type ApplicationLaunchBehavior = (typeof APPLICATION_LAUNCH_BEHAVIORS)[number];
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];
export type DocumentTableDensity = (typeof DOCUMENT_TABLE_DENSITIES)[number];

export interface ApplicationSettings {
  themeMode: ThemeMode;
  launchBehavior: ApplicationLaunchBehavior;
  defaultWorkspaceView: WorkspaceView;
  documentTableDensity: DocumentTableDensity;
  documentTableVisibleColumns: DocumentTableColumn[];
  defaultIncludeExampleData: boolean;
  defaultDocumentAuthor: string;
  defaultDocumentVersionScheme: DocumentVersionScheme;
  confirmDestructiveActions: boolean;
  autoDismissSuccessNotifications: boolean;
}

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  themeMode: 'system',
  launchBehavior: 'home',
  defaultWorkspaceView: 'documents',
  documentTableDensity: 'comfortable',
  documentTableVisibleColumns: [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS],
  defaultIncludeExampleData: true,
  defaultDocumentAuthor: '',
  defaultDocumentVersionScheme: 'numeric-3',
  confirmDestructiveActions: true,
  autoDismissSuccessNotifications: true
};

export const THEME_MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: 'light',
    label: 'Light',
    description: 'Use the light interface regardless of system preference.'
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use the dark interface regardless of system preference.'
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow the operating system appearance automatically.'
  }
];

export const APPLICATION_LAUNCH_BEHAVIOR_OPTIONS: Array<{
  value: ApplicationLaunchBehavior;
  label: string;
  description: string;
}> = [
  {
    value: 'home',
    label: 'Open home screen',
    description: 'Start on the welcome screen and let the user choose what to open.'
  },
  {
    value: 'reopen-last-workspace',
    label: 'Reopen last workspace',
    description: 'Reopen the most recent workspace automatically when nothing is already open.'
  }
];

export const WORKSPACE_VIEW_OPTIONS: Array<{
  value: WorkspaceView;
  label: string;
  description: string;
}> = [
  {
    value: 'documents',
    label: 'Documents',
    description: 'Open workspaces on the documents view by default.'
  },
  {
    value: 'documentTypes',
    label: 'Document Types',
    description: 'Open workspaces on the document types view by default.'
  },
  {
    value: 'projects',
    label: 'Projects',
    description: 'Open workspaces on the projects view by default.'
  },
  {
    value: 'classifications',
    label: 'Classifications',
    description: 'Open workspaces on the classifications view by default.'
  },
  {
    value: 'languages',
    label: 'Languages',
    description: 'Open workspaces on the languages view by default.'
  }
];

export const DOCUMENT_TABLE_DENSITY_OPTIONS: Array<{
  value: DocumentTableDensity;
  label: string;
  description: string;
}> = [
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'Use the current table spacing with more breathing room.'
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Fit more rows on screen with tighter table spacing.'
  }
];

export const isThemeMode = (value: string): value is ThemeMode =>
  THEME_MODES.includes(value as ThemeMode);

export const isApplicationLaunchBehavior = (
  value: string
): value is ApplicationLaunchBehavior =>
  APPLICATION_LAUNCH_BEHAVIORS.includes(value as ApplicationLaunchBehavior);

export const isWorkspaceView = (value: string): value is WorkspaceView =>
  WORKSPACE_VIEWS.includes(value as WorkspaceView);

export const isDocumentTableDensity = (value: string): value is DocumentTableDensity =>
  DOCUMENT_TABLE_DENSITIES.includes(value as DocumentTableDensity);

export const normalizeDocumentTableVisibleColumns = (value: unknown): DocumentTableColumn[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS];
  }

  const selected = new Set(
    value.filter((item): item is DocumentTableColumn => typeof item === 'string' && DOCUMENT_TABLE_COLUMNS.includes(item as DocumentTableColumn))
  );
  const normalized = DOCUMENT_TABLE_COLUMNS.filter((column) => selected.has(column));
  return normalized.length > 0 ? normalized : [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS];
};
