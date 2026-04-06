import type { DocumentVersionScheme } from "@shared/documentModel";
import {
  DOCUMENT_TABLE_COLUMNS,
  type DocumentTableColumn,
} from "@shared/workspaceLayout";

export const THEME_MODES = ["light", "dark", "system"] as const;
export const APPLICATION_LAUNCH_BEHAVIORS = [
  "home",
  "reopen-last-workspace",
] as const;
export const DOCUMENT_DETAIL_VIEW_MODES = ["sidebar", "modal", "page"] as const;
export const DOCUMENTS_VISUALIZATION_MODES = [
  "table",
  "kanban",
  "timeline",
  "calendar",
] as const;
export const WORKSPACE_VIEWS = [
  "dashboard",
  "documents",
  "documentTypes",
  "projects",
  "templates",
  "classifications",
  "languages",
] as const;
export const DOCUMENT_TABLE_DENSITIES = ["comfortable", "compact"] as const;
export const WORKSPACE_TAB_DENSITIES = ["comfortable", "compact"] as const;
export const DOCUMENT_DETAIL_SIDEBAR_MIN_WIDTH_PERCENT = 50;
export const DOCUMENT_DETAIL_SIDEBAR_MAX_WIDTH_PERCENT = 90;
export const DOCUMENT_DETAIL_SIDEBAR_DEFAULT_WIDTH = 800;
export const KEYBOARD_SHORTCUT_ACTIONS = [
  "openCommandPalette",
  "openSettings",
  "newWorkspace",
  "openWorkspaceFolder",
  "newDocument",
  "focusSearch",
] as const;
export const DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS: DocumentTableColumn[] = [
  "documentId",
  "title",
  "documentType",
  "version",
  "status",
  "project",
];

export type ThemeMode = (typeof THEME_MODES)[number];
export type ApplicationLaunchBehavior =
  (typeof APPLICATION_LAUNCH_BEHAVIORS)[number];
export type DocumentDetailViewMode =
  (typeof DOCUMENT_DETAIL_VIEW_MODES)[number];
export type DocumentsVisualizationMode =
  (typeof DOCUMENTS_VISUALIZATION_MODES)[number];
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];
export type DocumentTableDensity = (typeof DOCUMENT_TABLE_DENSITIES)[number];
export type WorkspaceTabDensity = (typeof WORKSPACE_TAB_DENSITIES)[number];
export type KeyboardShortcutAction = (typeof KEYBOARD_SHORTCUT_ACTIONS)[number];
export type KeyboardShortcutValue = string | null;
export type KeyboardShortcutMap = Record<
  KeyboardShortcutAction,
  KeyboardShortcutValue
>;

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutMap = {
  openCommandPalette: "Mod+K",
  openSettings: "Mod+,",
  newWorkspace: "Mod+Shift+N",
  openWorkspaceFolder: "Mod+O",
  newDocument: "Mod+N",
  focusSearch: "Mod+F",
};

export interface ApplicationSettings {
  themeMode: ThemeMode;
  launchBehavior: ApplicationLaunchBehavior;
  defaultWorkspaceView: WorkspaceView;
  documentDetailViewMode: DocumentDetailViewMode;
  defaultDocumentsVisualization: DocumentsVisualizationMode;
  documentDetailSidebarWidth: number;
  documentTableDensity: DocumentTableDensity;
  workspaceTabDensity: WorkspaceTabDensity;
  documentTableVisibleColumns: DocumentTableColumn[];
  keyboardShortcuts: KeyboardShortcutMap;
  defaultIncludeExampleData: boolean;
  defaultDocumentAuthor: string;
  defaultDocumentVersionScheme: DocumentVersionScheme;
  confirmDestructiveActions: boolean;
  autoDismissSuccessNotifications: boolean;
  autoUpdateEnabled: boolean;
  checkForUpdatesOnLaunch: boolean;
}

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  themeMode: "system",
  launchBehavior: "home",
  defaultWorkspaceView: "documents",
  documentDetailViewMode: "sidebar",
  defaultDocumentsVisualization: "table",
  documentDetailSidebarWidth: DOCUMENT_DETAIL_SIDEBAR_DEFAULT_WIDTH,
  documentTableDensity: "comfortable",
  workspaceTabDensity: "comfortable",
  documentTableVisibleColumns: [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS],
  keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
  defaultIncludeExampleData: true,
  defaultDocumentAuthor: "",
  defaultDocumentVersionScheme: "numeric-3",
  confirmDestructiveActions: true,
  autoDismissSuccessNotifications: true,
  autoUpdateEnabled: true,
  checkForUpdatesOnLaunch: true,
};

export const THEME_MODE_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Use the light interface regardless of system preference.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the dark interface regardless of system preference.",
  },
  {
    value: "system",
    label: "System",
    description: "Follow the operating system appearance automatically.",
  },
];

export const APPLICATION_LAUNCH_BEHAVIOR_OPTIONS: Array<{
  value: ApplicationLaunchBehavior;
  label: string;
  description: string;
}> = [
  {
    value: "home",
    label: "Open home screen",
    description:
      "Start on the welcome screen and let the user choose what to open.",
  },
  {
    value: "reopen-last-workspace",
    label: "Reopen last workspace",
    description:
      "Reopen the most recent workspace automatically when nothing is already open.",
  },
];

export const WORKSPACE_VIEW_OPTIONS: Array<{
  value: WorkspaceView;
  label: string;
  description: string;
}> = [
  {
    value: "dashboard",
    label: "Dashboard",
    description:
      "Open workspaces on a dashboard with health, activity, and summary insights.",
  },
  {
    value: "documents",
    label: "Documents",
    description: "Open workspaces on the documents view by default.",
  },
  {
    value: "documentTypes",
    label: "Document Types",
    description: "Open workspaces on the document types view by default.",
  },
  {
    value: "projects",
    label: "Projects",
    description: "Open workspaces on the projects view by default.",
  },
  {
    value: "templates",
    label: "Templates",
    description: "Open workspaces on the templates view by default.",
  },
  {
    value: "classifications",
    label: "Classifications",
    description: "Open workspaces on the classifications view by default.",
  },
  {
    value: "languages",
    label: "Languages",
    description: "Open workspaces on the languages view by default.",
  },
];

export const DOCUMENT_DETAIL_VIEW_MODE_OPTIONS: Array<{
  value: DocumentDetailViewMode;
  label: string;
  description: string;
}> = [
  {
    value: "sidebar",
    label: "Sidebar",
    description:
      "Open document details in an overlay panel that keeps the table visible.",
  },
  {
    value: "modal",
    label: "Modal",
    description:
      "Open document details in a large dialog that nearly fills the workspace.",
  },
  {
    value: "page",
    label: "Full Page",
    description:
      "Replace the documents view with a dedicated document detail page.",
  },
];

export const DOCUMENTS_VISUALIZATION_MODE_OPTIONS: Array<{
  value: DocumentsVisualizationMode;
  label: string;
  description: string;
}> = [
  {
    value: "table",
    label: "Table",
    description: "Show the traditional sortable documents table.",
  },
  {
    value: "kanban",
    label: "Kanban",
    description: "Organize documents into status columns.",
  },
  {
    value: "timeline",
    label: "Timeline",
    description: "See documents in chronological order by effective date.",
  },
  {
    value: "calendar",
    label: "Calendar",
    description: "See review due dates in a monthly calendar.",
  },
];

export const DOCUMENT_TABLE_DENSITY_OPTIONS: Array<{
  value: DocumentTableDensity;
  label: string;
  description: string;
}> = [
  {
    value: "comfortable",
    label: "Comfortable",
    description: "Use the current table spacing with more breathing room.",
  },
  {
    value: "compact",
    label: "Compact",
    description: "Fit more rows on screen with tighter table spacing.",
  },
];

export const WORKSPACE_TAB_DENSITY_OPTIONS: Array<{
  value: WorkspaceTabDensity;
  label: string;
  description: string;
}> = [
  {
    value: "comfortable",
    label: "Comfortable",
    description:
      "Show the workspace name with document counts and roomier tab spacing.",
  },
  {
    value: "compact",
    label: "Compact",
    description:
      "Use shorter tabs and hide the document count to fit more workspaces.",
  },
];

export const KEYBOARD_SHORTCUT_ACTION_DETAILS: Record<
  KeyboardShortcutAction,
  {
    label: string;
    description: string;
  }
> = {
  openCommandPalette: {
    label: "Open Command Palette",
    description: "Open the Spotlight-style command launcher.",
  },
  openSettings: {
    label: "Open Settings",
    description: "Open the application settings dialog.",
  },
  newWorkspace: {
    label: "Create Workspace",
    description: "Open the new workspace dialog.",
  },
  openWorkspaceFolder: {
    label: "Open Workspace Folder",
    description: "Open the workspace folder picker.",
  },
  newDocument: {
    label: "Create Document",
    description: "Open the new document dialog in the active workspace.",
  },
  focusSearch: {
    label: "Focus Search",
    description: "Focus and select the documents search field.",
  },
};

export const isThemeMode = (value: string): value is ThemeMode =>
  THEME_MODES.includes(value as ThemeMode);

export const isApplicationLaunchBehavior = (
  value: string,
): value is ApplicationLaunchBehavior =>
  APPLICATION_LAUNCH_BEHAVIORS.includes(value as ApplicationLaunchBehavior);

export const isDocumentDetailViewMode = (
  value: string,
): value is DocumentDetailViewMode =>
  DOCUMENT_DETAIL_VIEW_MODES.includes(value as DocumentDetailViewMode);

export const isDocumentsVisualizationMode = (
  value: string,
): value is DocumentsVisualizationMode =>
  DOCUMENTS_VISUALIZATION_MODES.includes(value as DocumentsVisualizationMode);

export const isWorkspaceView = (value: string): value is WorkspaceView =>
  WORKSPACE_VIEWS.includes(value as WorkspaceView);

export const isDocumentTableDensity = (
  value: string,
): value is DocumentTableDensity =>
  DOCUMENT_TABLE_DENSITIES.includes(value as DocumentTableDensity);

export const isWorkspaceTabDensity = (
  value: string,
): value is WorkspaceTabDensity =>
  WORKSPACE_TAB_DENSITIES.includes(value as WorkspaceTabDensity);

export const normalizeDocumentTableVisibleColumns = (
  value: unknown,
): DocumentTableColumn[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS];
  }

  const selected = new Set(
    value.filter(
      (item): item is DocumentTableColumn =>
        typeof item === "string" &&
        DOCUMENT_TABLE_COLUMNS.includes(item as DocumentTableColumn),
    ),
  );
  const normalized = DOCUMENT_TABLE_COLUMNS.filter((column) =>
    selected.has(column),
  );
  return normalized.length > 0
    ? normalized
    : [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS];
};

const KEYBOARD_SHORTCUT_MODIFIER_ORDER = ["Mod", "Alt", "Shift"] as const;
const NORMALIZED_SHORTCUT_ALIASES: Record<string, string> = {
  cmd: "Mod",
  command: "Mod",
  ctrl: "Mod",
  control: "Mod",
  meta: "Mod",
  mod: "Mod",
  option: "Alt",
  alt: "Alt",
  shift: "Shift",
  comma: ",",
  period: ".",
  slash: "/",
  backslash: "\\",
  semicolon: ";",
  apostrophe: "'",
  quote: "'",
  minus: "-",
  dash: "-",
  equal: "=",
  equals: "=",
  bracketleft: "[",
  bracketright: "]",
  backquote: "`",
  grave: "`",
  escape: "Escape",
  esc: "Escape",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  space: "Space",
};

const normalizeShortcutKeyToken = (token: string): string | null => {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const mapped = NORMALIZED_SHORTCUT_ALIASES[trimmed.toLowerCase()];
  if (mapped) {
    return mapped;
  }

  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }

  if (/^f\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return /^[A-Za-z0-9]+$/.test(trimmed)
    ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
    : null;
};

export const normalizeKeyboardShortcut = (
  value: unknown,
): KeyboardShortcutValue => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const tokens = trimmed
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  const modifiers = new Set<
    (typeof KEYBOARD_SHORTCUT_MODIFIER_ORDER)[number]
  >();
  let keyToken: string | null = null;

  for (const token of tokens) {
    const normalized = normalizeShortcutKeyToken(token);
    if (!normalized) {
      return null;
    }

    if (
      normalized === "Mod" ||
      normalized === "Alt" ||
      normalized === "Shift"
    ) {
      modifiers.add(normalized);
      continue;
    }

    if (keyToken) {
      return null;
    }

    keyToken = normalized;
  }

  if (!keyToken) {
    return null;
  }

  const orderedModifiers = KEYBOARD_SHORTCUT_MODIFIER_ORDER.filter((modifier) =>
    modifiers.has(modifier),
  );

  return [...orderedModifiers, keyToken].join("+");
};

export const normalizeKeyboardShortcuts = (
  value: unknown,
): KeyboardShortcutMap => {
  const candidate =
    value && typeof value === "object"
      ? (value as Partial<KeyboardShortcutMap>)
      : {};
  return KEYBOARD_SHORTCUT_ACTIONS.reduce<KeyboardShortcutMap>(
    (result, action) => {
      if (Object.prototype.hasOwnProperty.call(candidate, action)) {
        const normalized = normalizeKeyboardShortcut(candidate[action]);
        result[action] = normalized;
        return result;
      }

      result[action] = DEFAULT_KEYBOARD_SHORTCUTS[action];
      return result;
    },
    {} as KeyboardShortcutMap,
  );
};
