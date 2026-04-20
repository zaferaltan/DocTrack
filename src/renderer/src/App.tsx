import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatDateFns,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Fragment,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Columns3,
  CalendarDays,
  Download,
  FilePlus2,
  FileStack,
  FolderOpen,
  GripVertical,
  History,
  Keyboard,
  LayoutPanelLeft,
  Loader2,
  Moon,
  Maximize2,
  Minimize2,
  Milestone,
  Pencil,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Settings2,
  Sparkles,
  Sun,
  SunMoon,
  Table2,
  Trash2,
  Upload,
  X,
  FileText,
  Grid3x3,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  CommandPaletteDialog,
  type CommandPaletteItem,
} from "@renderer/components/CommandPaletteDialog";
import { Badge } from "@renderer/components/ui/badge";
import { Button } from "@renderer/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Select } from "@renderer/components/ui/select";
import { Textarea } from "@renderer/components/ui/textarea";
import {
  cn,
  formatDateShort,
  formatDateTime,
  formatUserFacingError,
} from "@renderer/lib/utils";
import { useAppStore } from "@renderer/store/useAppStore";
import {
  APPLICATION_LAUNCH_BEHAVIOR_OPTIONS,
  DEFAULT_KEYBOARD_SHORTCUTS,
  DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS,
  DEFAULT_APPLICATION_SETTINGS,
  DOCUMENT_DETAIL_SIDEBAR_MAX_WIDTH_PERCENT,
  DOCUMENT_DETAIL_SIDEBAR_MIN_WIDTH_PERCENT,
  DOCUMENT_DETAIL_VIEW_MODE_OPTIONS,
  DOCUMENTS_VISUALIZATION_MODE_OPTIONS,
  DOCUMENT_TABLE_DENSITY_OPTIONS,
  KEYBOARD_SHORTCUT_ACTIONS,
  KEYBOARD_SHORTCUT_ACTION_DETAILS,
  THEME_MODE_OPTIONS,
  WORKSPACE_TAB_DENSITY_OPTIONS,
  WORKSPACE_VIEW_OPTIONS,
  type ApplicationSettings,
  type DocumentDetailViewMode,
  type DocumentsVisualizationMode,
  type DocumentTableDensity,
  type KeyboardShortcutAction,
  type KeyboardShortcutMap,
  type KeyboardShortcutValue,
  type ThemeMode,
  type WorkspaceView,
} from "@shared/applicationSettings";
import type { AppUpdateProgress, AppUpdateState } from "@shared/appUpdates";
import {
  DOCUMENT_VERSION_FILE_ROLE_LABELS,
  DOCUMENT_VERSION_FILE_ROLES,
  DOCUMENT_VERSION_SCHEME_LABELS,
  getAlphaUppercaseVersionLabel,
  type DocumentVersionFileRole,
  type DocumentVersionScheme,
  type VersionBumpType,
} from "@shared/documentModel";
import {
  createDefaultWorkspaceLifecycle,
  getAllowedLifecycleTransitionTargets,
  getLifecycleBadgeVariant,
  getMissingLifecycleMetadata,
  getWorkspaceLifecycleStatuses,
  getWorkspaceStatusByKey,
  getWorkspaceStatusByName,
  validateWorkspaceLifecycle,
  type WorkspaceLifecycle,
  type WorkspaceStatusDefinition,
} from "@shared/documentLifecycle";
import {
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  buildVersionFileRelativePath,
  DEFAULT_WORKSPACE_SETTINGS,
  DOCUMENT_ID_FORMAT_OPTIONS,
  DOCUMENT_ID_TEMPLATE_PLACEHOLDER_OPTIONS,
  DOCUMENT_TABLE_COLUMN_OPTIONS,
  DOCUMENT_TABLE_COLUMNS,
  WORKSPACE_FILE_ORGANIZATION_OPTIONS,
  WORKSPACE_ROOT_DIRECTORY_SETTING_KEYS,
  WORKSPACE_STORAGE_LAYOUT_OPTIONS,
  WORKSPACE_VERSION_MANAGEMENT_OPTIONS,
  getDefaultWorkspaceRootDirectoryName,
  getDocumentTableColumnLabel,
  getDocumentIdFormatTemplateForPreset,
  getWorkspaceTemplatesRelativePath,
  isValidWorkspaceRootDirectoryName,
  normalizeDocumentIdFormatTemplate,
  resolveDocumentIdFormatTemplate,
  type DocumentTableColumn,
  type WorkspaceRootDirectorySettingKey,
  type WorkspaceSettings,
} from "@shared/workspaceLayout";
import {
  BUILT_IN_WORKSPACE_ROLE_KEYS,
  cloneWorkspaceRoleSettings,
  createDefaultWorkspaceRoleSettings,
  isBuiltInWorkspaceRoleKey,
  WORKSPACE_ROLE_PERMISSION_KEYS,
} from "@shared/workspaceRoles";
import {
  filterDocumentsBySavedViewQuery,
  getDashboardWidgetTypeLabel,
  normalizeDashboardLayout,
  sortDocumentsBySavedView,
  type DashboardLayout,
  type DashboardWidget,
  type DashboardWidgetType,
  type DocumentViewState,
  type SavedView,
  type SavedViewHealthFlagValue,
  type SavedViewPresentation,
  type SavedViewQuery,
  type SavedViewRule,
  type SavedViewRuleField,
  type SavedViewRuleOperator,
  type SavedViewSort,
} from "@shared/savedViews";
import type {
  ConfidentialityClass,
  WorkspaceAccessRecoveryInput,
  CreateSavedViewInput,
  CreateDocumentInput,
  CreateVersionInput,
  DeleteSavedViewInput,
  DuplicateSavedViewInput,
  DocumentHealthFlag,
  DocumentDetail,
  DocumentExportGrouping,
  DocumentExportPdfColorMode,
  DocumentExportRequest,
  DocumentListItem,
  DocumentStatus,
  DocumentVersion,
  DocumentVersionFile,
  DocumentType,
  FilePreviewResult,
  Group,
  IntegrityCheckResult,
  Project,
  PromoteSavedViewToSharedInput,
  PromoteSavedViewToSharedResult,
  RecentActivityItem,
  RestoreBackupDiffChangeType,
  RestoreBackupDiffItem,
  RestoreBackupDiffResult,
  TemplateSummary,
  UpdateDashboardLayoutInput,
  UpdateDocumentInput,
  UpdateDocumentVersionInput,
  UpdateLatestVersionInput,
  UpdateSavedViewInput,
  VersionComparisonResult,
  VersionFilesystemChange,
  WorkspaceBackupSummary,
  WorkspaceLanguage,
  WorkspaceRole,
  WorkspaceRoleDefinition,
  WorkspaceRoleMode,
  WorkspaceRolePermissions,
  WorkspaceRoleSettings,
  WorkspaceRoleSettingsUpdateInput,
  WorkspaceSettingsUpdateInput,
  WorkspaceSummary,
  WorkspaceUser,
  WorkspaceUserCreateInput,
  WorkspaceUserUpdateInput,
} from "@shared/types";

type NotificationTone = "success" | "error";
type ValidationErrors = Partial<Record<string, string>>;

const ROOT_DIRECTORY_FIELD_LABELS: Record<
  WorkspaceRootDirectorySettingKey,
  string
> = {
  databaseDirectoryName: "Database",
  documentsDirectoryName: "Documents",
  templatesDirectoryName: "Templates",
  backupsDirectoryName: "Backups",
};

const DEFAULT_WORKSPACE_LIFECYCLE_STATE = createDefaultWorkspaceLifecycle();

const getStatusVariant = (
  status: DocumentStatus,
  lifecycle: WorkspaceLifecycle = DEFAULT_WORKSPACE_LIFECYCLE_STATE,
): "success" | "warning" | "muted" | "default" => {
  const lifecycleStatus =
    getWorkspaceStatusByName(lifecycle, status) ??
    getWorkspaceStatusByName(DEFAULT_WORKSPACE_LIFECYCLE_STATE, status);
  return lifecycleStatus
    ? getLifecycleBadgeVariant(lifecycleStatus.role)
    : "default";
};

const THEME_MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

const SUCCESS_NOTIFICATION_TIMEOUT_MS = 3500;
const ACTIVITY_LOG_DISABLED_MESSAGE =
  "This feature has been disabled in the workspace settings.";
const APP_UPDATE_MANUAL_ACTION_MESSAGE =
  "Save updater preference changes before checking for updates.";
const DASHBOARD_GRID_COLUMNS = 12;
const DASHBOARD_GRID_ROW_HEIGHT = 144;
const DASHBOARD_WIDGET_MIN_WIDTH = 3;
const DASHBOARD_WIDGET_MIN_HEIGHT = 1;
const SAVED_VIEW_WIDGET_PREVIEW_LIMIT = 5;

const DASHBOARD_RESIZE_HANDLE_CONFIGS = [
  {
    id: "top",
    direction: { top: true, right: false, bottom: false, left: false },
    className:
      "absolute left-3 right-3 top-0 h-2 -translate-y-1/2 cursor-n-resize",
  },
  {
    id: "right",
    direction: { top: false, right: true, bottom: false, left: false },
    className:
      "absolute right-0 top-3 bottom-3 w-2 translate-x-1/2 cursor-e-resize",
  },
  {
    id: "bottom",
    direction: { top: false, right: false, bottom: true, left: false },
    className:
      "absolute left-3 right-3 bottom-0 h-2 translate-y-1/2 cursor-s-resize",
  },
  {
    id: "left",
    direction: { top: false, right: false, bottom: false, left: true },
    className:
      "absolute left-0 top-3 bottom-3 w-2 -translate-x-1/2 cursor-w-resize",
  },
  {
    id: "top-left",
    direction: { top: true, right: false, bottom: false, left: true },
    className:
      "absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
  },
  {
    id: "top-right",
    direction: { top: true, right: true, bottom: false, left: false },
    className:
      "absolute right-0 top-0 h-3 w-3 translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
  },
  {
    id: "bottom-right",
    direction: { top: false, right: true, bottom: true, left: false },
    className:
      "absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 cursor-se-resize",
  },
  {
    id: "bottom-left",
    direction: { top: false, right: false, bottom: true, left: true },
    className:
      "absolute bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 cursor-sw-resize",
  },
] as const;

const SAVED_VIEW_RULE_FIELD_LABELS: Record<SavedViewRuleField, string> = {
  documentType: "Document Type",
  status: "Status",
  group: "Group",
  project: "Project",
  language: "Language",
  confidentialityClass: "Confidentiality Class",
  author: "Author",
  company: "Company",
  department: "Department",
  reviewedBy: "Reviewed By",
  approvedBy: "Approved By",
  latestVersion: "Latest Version",
  healthFlag: "Health Flag",
  createdDate: "Created Date",
  modifiedDate: "Modified Date",
  releasedDate: "Released Date",
  effectiveDate: "Effective Date",
  startDate: "Start Date",
  nextReviewDate: "Next Review Date",
};

const SAVED_VIEW_RULE_OPERATOR_LABELS: Record<SavedViewRuleOperator, string> = {
  is: "Is",
  isNot: "Is Not",
  contains: "Contains",
  isEmpty: "Is Empty",
  isNotEmpty: "Is Not Empty",
  before: "Before",
  after: "After",
  between: "Between",
  withinLastDays: "Within Last N Days",
  thisMonth: "This Month",
};

const buildAppUpdatePromptKey = (state: AppUpdateState): string | null => {
  if (!state.release) {
    return null;
  }

  return `${state.release.version}:${state.lastCheckSource ?? "unknown"}:${state.lastCheckedAt ?? ""}`;
};

const getSystemTheme = (): ThemeMode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (themeMode: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = themeMode === "system" ? getSystemTheme() : themeMode;
  root.classList.toggle("dark", effectiveTheme === "dark");
};

const cloneWorkspaceLifecycle = (
  lifecycle: WorkspaceLifecycle,
): WorkspaceLifecycle => ({
  ...lifecycle,
  statuses: lifecycle.statuses.map((status) => ({ ...status })),
  allowedTransitions: lifecycle.allowedTransitions.map((transition) => ({
    ...transition,
  })),
});

const resequenceLifecycleStatuses = (
  statuses: WorkspaceStatusDefinition[],
): WorkspaceStatusDefinition[] =>
  statuses.map((status, index) => ({
    ...status,
    sortOrder: index,
  }));

const buildLifecycleStatusKey = (): string =>
  `status-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeWorkspaceRoleKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const buildWorkspaceRoleKey = (
  name: string,
  existingKeys: Iterable<string>,
): string => {
  const usedKeys = new Set(existingKeys);
  const baseKey = normalizeWorkspaceRoleKey(name) || "role";
  let nextKey = baseKey;
  let suffix = 2;
  while (usedKeys.has(nextKey)) {
    nextKey = `${baseKey}-${suffix}`;
    suffix += 1;
  }
  return nextKey;
};

const resequenceWorkspaceRoles = (
  roles: WorkspaceRoleDefinition[],
): WorkspaceRoleDefinition[] =>
  roles.map((role, index) => ({
    ...role,
    sortOrder: index,
  }));

const createEmptyWorkspaceRolePermissions = (): WorkspaceRolePermissions => ({
  canViewWorkspace: true,
  canEditDocuments: false,
  canManageSharedViews: false,
  canManageUsers: false,
  canManageRoles: false,
  canManageWorkspaceSettings: false,
  canManageWorkspaceMaintenance: false,
});

const addWorkspaceRoleDefinition = (
  roleSettings: WorkspaceRoleSettings,
): WorkspaceRoleSettings => {
  const nextRoleNumber = roleSettings.roles.length + 1;
  const key = buildWorkspaceRoleKey(
    `role-${nextRoleNumber}`,
    roleSettings.roles.map((role) => role.key),
  );
  return {
    ...roleSettings,
    roles: resequenceWorkspaceRoles([
      ...roleSettings.roles,
      {
        key,
        name: `Role ${nextRoleNumber}`,
        sortOrder: roleSettings.roles.length,
        permissions: createEmptyWorkspaceRolePermissions(),
      },
    ]),
  };
};

const updateWorkspaceRoleDefinition = (
  roleSettings: WorkspaceRoleSettings,
  roleKey: string,
  updater: (role: WorkspaceRoleDefinition) => WorkspaceRoleDefinition,
): WorkspaceRoleSettings => ({
  ...roleSettings,
  roles: resequenceWorkspaceRoles(
    roleSettings.roles.map((role) =>
      role.key === roleKey ? updater(role) : role,
    ),
  ),
});

const removeWorkspaceRoleDefinition = (
  roleSettings: WorkspaceRoleSettings,
  roleKey: string,
): WorkspaceRoleSettings => ({
  ...roleSettings,
  roles: resequenceWorkspaceRoles(
    roleSettings.roles.filter((role) => role.key !== roleKey),
  ),
});

const moveWorkspaceRoleDefinition = (
  roleSettings: WorkspaceRoleSettings,
  roleKey: string,
  direction: -1 | 1,
): WorkspaceRoleSettings => {
  const roles = [...roleSettings.roles];
  const index = roles.findIndex((role) => role.key === roleKey);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= roles.length) {
    return roleSettings;
  }

  const [role] = roles.splice(index, 1);
  roles.splice(nextIndex, 0, role);
  return {
    ...roleSettings,
    roles: resequenceWorkspaceRoles(roles),
  };
};

const getAssignedCustomWorkspaceRoles = (
  users: WorkspaceUser[],
  roleSettings: WorkspaceRoleSettings,
): Array<[roleKey: string, roleName: string]> =>
  [
    ...new Map(
      users
        .filter((user) => !isBuiltInWorkspaceRoleKey(user.role))
        .map((user) => [
          user.role,
          roleSettings.roles.find((role) => role.key === user.role)?.name ??
            user.roleName ??
            user.role,
        ]),
    ).entries(),
  ];

const WORKSPACE_ROLE_PERMISSION_LABELS: Record<
  (typeof WORKSPACE_ROLE_PERMISSION_KEYS)[number],
  string
> = {
  canViewWorkspace: "View Workspace",
  canEditDocuments: "Edit Documents & Data",
  canManageSharedViews: "Manage Shared Views",
  canManageUsers: "Manage Users",
  canManageRoles: "Manage Roles",
  canManageWorkspaceSettings: "Manage Workspace Settings",
  canManageWorkspaceMaintenance: "Manage Backups / Restore / Integrity",
};

const setWorkspaceLifecycleMode = (
  lifecycle: WorkspaceLifecycle,
  mode: WorkspaceLifecycle["mode"],
): WorkspaceLifecycle => {
  if (mode === "default") {
    return createDefaultWorkspaceLifecycle();
  }

  return {
    ...cloneWorkspaceLifecycle(lifecycle),
    mode: "custom",
  };
};

const addWorkspaceLifecycleStatus = (
  lifecycle: WorkspaceLifecycle,
): WorkspaceLifecycle => {
  const nextStatuses = resequenceLifecycleStatuses([
    ...getWorkspaceLifecycleStatuses(lifecycle),
    {
      key: buildLifecycleStatusKey(),
      name: `Status ${lifecycle.statuses.length + 1}`,
      role: "draft",
      sortOrder: lifecycle.statuses.length,
      requiresReleasedDate: false,
      requiresReviewedBy: false,
      requiresApprovedBy: false,
    },
  ]);

  return {
    ...lifecycle,
    statuses: nextStatuses,
    initialStatusKey: lifecycle.initialStatusKey || nextStatuses[0]?.key || "",
    autoPreviousVersionStatusKey:
      lifecycle.autoPreviousVersionStatusKey ?? nextStatuses[0]?.key ?? null,
  };
};

const updateWorkspaceLifecycleStatus = (
  lifecycle: WorkspaceLifecycle,
  statusKey: string,
  updater: (status: WorkspaceStatusDefinition) => WorkspaceStatusDefinition,
): WorkspaceLifecycle => ({
  ...lifecycle,
  statuses: resequenceLifecycleStatuses(
    getWorkspaceLifecycleStatuses(lifecycle).map((status) =>
      status.key === statusKey ? updater(status) : status,
    ),
  ),
});

const removeWorkspaceLifecycleStatus = (
  lifecycle: WorkspaceLifecycle,
  statusKey: string,
): WorkspaceLifecycle => {
  const nextStatuses = resequenceLifecycleStatuses(
    getWorkspaceLifecycleStatuses(lifecycle).filter(
      (status) => status.key !== statusKey,
    ),
  );
  const fallbackKey = nextStatuses[0]?.key ?? "";

  return {
    ...lifecycle,
    statuses: nextStatuses,
    initialStatusKey:
      lifecycle.initialStatusKey === statusKey
        ? fallbackKey
        : lifecycle.initialStatusKey,
    autoPreviousVersionStatusKey:
      lifecycle.autoPreviousVersionStatusKey === statusKey
        ? fallbackKey || null
        : lifecycle.autoPreviousVersionStatusKey,
    allowedTransitions: lifecycle.allowedTransitions.filter(
      (transition) =>
        transition.fromStatusKey !== statusKey &&
        transition.toStatusKey !== statusKey,
    ),
  };
};

const moveWorkspaceLifecycleStatus = (
  lifecycle: WorkspaceLifecycle,
  statusKey: string,
  direction: -1 | 1,
): WorkspaceLifecycle => {
  const statuses = [...getWorkspaceLifecycleStatuses(lifecycle)];
  const index = statuses.findIndex((status) => status.key === statusKey);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= statuses.length) {
    return lifecycle;
  }

  const [status] = statuses.splice(index, 1);
  statuses.splice(nextIndex, 0, status);
  return {
    ...lifecycle,
    statuses: resequenceLifecycleStatuses(statuses),
  };
};

const toggleWorkspaceLifecycleTransition = (
  lifecycle: WorkspaceLifecycle,
  fromStatusKey: string,
  toStatusKey: string,
  enabled: boolean,
): WorkspaceLifecycle => {
  if (fromStatusKey === toStatusKey) {
    return lifecycle;
  }

  const transitions = lifecycle.allowedTransitions.filter(
    (transition) =>
      !(
        transition.fromStatusKey === fromStatusKey &&
        transition.toStatusKey === toStatusKey
      ),
  );

  return {
    ...lifecycle,
    allowedTransitions: enabled
      ? [...transitions, { fromStatusKey, toStatusKey }]
      : transitions,
  };
};

const getRemovedLifecycleStatuses = (
  previousLifecycle: WorkspaceLifecycle | null | undefined,
  nextLifecycle: WorkspaceLifecycle,
): WorkspaceStatusDefinition[] => {
  if (!previousLifecycle) {
    return [];
  }

  const nextKeys = new Set(nextLifecycle.statuses.map((status) => status.key));
  return previousLifecycle.statuses.filter(
    (status) => !nextKeys.has(status.key),
  );
};

const buildWorkspaceDialogState = (
  applicationSettings: ApplicationSettings,
): WorkspaceDialogState => ({
  ...defaultWorkspaceDialogState,
  open: true,
  initialAdminUsername: "admin",
  initialAdminDisplayName: "",
  initialAdminPassword: "",
  includeExampleData: applicationSettings.defaultIncludeExampleData,
});

const buildCreateDocumentDialogState = (
  applicationSettings: ApplicationSettings,
  workspaceSettings: WorkspaceSettings,
  activeUser?: { id: number; displayName: string } | null,
): DocumentDialogState => ({
  ...defaultDocumentDialogState,
  mode: "create",
  open: true,
  author: activeUser?.displayName ?? applicationSettings.defaultDocumentAuthor,
  authorUserId: activeUser ? String(activeUser.id) : "",
  versionScheme: applicationSettings.defaultDocumentVersionScheme,
  templateId: "",
  company: workspaceSettings.defaultCompany,
  department: workspaceSettings.defaultDepartment,
  startDate: new Date().toISOString().slice(0, 10),
});

const buildEditDocumentDialogState = (
  documentDetail: DocumentDetail,
): DocumentDialogState => ({
  ...defaultDocumentDialogState,
  mode: "edit",
  open: true,
  documentRecordId: documentDetail.id,
  title: documentDetail.title,
  documentTypeId: String(documentDetail.typeId),
  author: documentDetail.author,
  authorUserId: documentDetail.authorUserId
    ? String(documentDetail.authorUserId)
    : "",
  versionScheme: documentDetail.versionScheme,
  templateId: "",
  languageId: documentDetail.languageId
    ? String(documentDetail.languageId)
    : "",
  confidentialityClassId: documentDetail.confidentialityClassId
    ? String(documentDetail.confidentialityClassId)
    : "",
  groupId: documentDetail.groupId ? String(documentDetail.groupId) : "",
  projectId: documentDetail.projectId ? String(documentDetail.projectId) : "",
  company: documentDetail.company,
  department: documentDetail.department,
  startDate: toDateInputValue(documentDetail.startDate),
  revisionIntervalMonths:
    documentDetail.revisionIntervalMonths !== null
      ? String(documentDetail.revisionIntervalMonths)
      : "",
});

const buildApplicationSettingsDialogState = (
  applicationSettings: ApplicationSettings,
): ApplicationSettingsDialogState => ({
  open: true,
  settings: {
    ...applicationSettings,
    keyboardShortcuts: { ...applicationSettings.keyboardShortcuts },
  },
  isSubmitting: false,
});

interface WorkspaceDialogState {
  open: boolean;
  name: string;
  folderName: string;
  useCustomFolderName: boolean;
  parentPath: string;
  initialAdminUsername: string;
  initialAdminDisplayName: string;
  initialAdminPassword: string;
  settings: WorkspaceSettings;
  lifecycle: WorkspaceLifecycle;
  includeExampleData: boolean;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
  isAdvancedSettingsOpen: boolean;
}

interface WorkspaceSettingsDialogState {
  open: boolean;
  rootPath?: string;
  workspaceName: string;
  settings: WorkspaceSettings;
  originalSettings?: WorkspaceSettings;
  initialAdminUsername: string;
  initialAdminDisplayName: string;
  initialAdminPassword: string;
  lifecycle: WorkspaceLifecycle;
  originalLifecycle?: WorkspaceLifecycle;
  statusRemaps: Record<string, string>;
  companyLogoSourceFilePath: string | null;
  clearCompanyLogo: boolean;
  roleSettings: WorkspaceRoleSettings;
  roleSettingsDialog: WorkspaceRoleSettingsDialogState;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
  isAdvancedSettingsOpen: boolean;
}

interface WorkspaceRoleSettingsDialogState {
  open: boolean;
  draft: WorkspaceRoleSettings;
  remaps: Record<string, string>;
  isSubmitting: boolean;
  message: string;
  tone: "warning" | "error";
}

interface ApplicationSettingsDialogState {
  open: boolean;
  settings: ApplicationSettings;
  isSubmitting: boolean;
}

interface TableColumnsDialogState {
  open: boolean;
  visibleColumns: DocumentTableColumn[];
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface DocumentDialogState {
  mode: "create" | "edit";
  documentRecordId?: number;
  open: boolean;
  title: string;
  documentTypeId: string;
  author: string;
  authorUserId: string;
  versionScheme: DocumentVersionScheme;
  templateId: string;
  startDate: string;
  languageId: string;
  confidentialityClassId: string;
  groupId: string;
  projectId: string;
  company: string;
  department: string;
  revisionIntervalMonths: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface VersionDialogState {
  open: boolean;
  revisionDescription: string;
  bumpType: VersionBumpType;
  isSubmitting: boolean;
}

interface FilesDialogState {
  open: boolean;
  versionId?: number;
  reviewVersionIds: number[];
  addRole: DocumentVersionFileRole;
  pendingSourceFilePaths: string[];
  pendingDuplicateWarnings: string[];
  isSubmitting: boolean;
  submitLabel: string;
}

interface LatestVersionDialogState {
  open: boolean;
  mode: "latest" | "version";
  versionId?: number;
  versionLabel: string;
  status: DocumentStatus;
  releasedDate: string;
  reviewedBy: string;
  reviewedByUserId: string;
  approvedBy: string;
  approvedByUserId: string;
  revisionDescription: string;
  isSubmitting: boolean;
}

interface StatusChangeDialogState {
  open: boolean;
  document?: DocumentListItem;
  nextStatus: DocumentStatus;
  isSubmitting: boolean;
}

interface TypeDialogState {
  open: boolean;
  id?: number;
  name: string;
  numberPrefix: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface ProjectDialogState {
  open: boolean;
  entity: "group" | "project";
  id?: number;
  name: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface TemplateDialogState {
  open: boolean;
  name: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface TemplateFilesDialogState {
  open: boolean;
  templateId?: string;
  templateName: string;
  pendingSourceFilePaths: string[];
  isDragActive: boolean;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface ClassificationDialogState {
  open: boolean;
  id?: number;
  name: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

interface LanguageDialogState {
  open: boolean;
  id?: number;
  code: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

type DocumentExportScope = "current-table" | "whole-workspace";
type ExportGroupingOption = {
  value: DocumentExportGrouping;
  label: string;
};

interface DocumentExportDialogState {
  open: boolean;
  format: "csv" | "pdf";
  scope: DocumentExportScope;
  groupBy: DocumentExportGrouping;
  pdfColorMode: DocumentExportPdfColorMode;
  isSubmitting: boolean;
}

interface BackupDialogState {
  open: boolean;
  backups: WorkspaceBackupSummary[];
  integrityCheck: IntegrityCheckResult | null;
  selectedBackupId: string;
  restoreDiff: RestoreBackupDiffResult | null;
  isLoading: boolean;
  isSubmitting: boolean;
}

interface WorkspaceUsersDialogState {
  open: boolean;
  users: WorkspaceUser[];
  roleSettings: WorkspaceRoleSettings;
  showArchivedUsers: boolean;
  selectedUserId?: number;
  username: string;
  displayName: string;
  role: WorkspaceRole;
  password: string;
  isLoading: boolean;
  isSubmitting: boolean;
  formMessage: string;
  formTone: "warning" | "error";
  validationErrors: ValidationErrors;
}

interface AccessRecoveryState {
  username: string;
  displayName: string;
  password: string;
  isSubmitting: boolean;
  error: string;
  validationErrors: ValidationErrors;
}

interface FilePreviewDialogState {
  open: boolean;
  preview: FilePreviewResult | null;
  isLoading: boolean;
}

interface ActivityLogDialogState {
  open: boolean;
  workspaceRootPath?: string;
  workspaceName: string;
  items: RecentActivityItem[];
  isLoading: boolean;
}

interface VersionComparisonDialogState {
  open: boolean;
  result: VersionComparisonResult | null;
  isLoading: boolean;
}

interface RenameFileDialogState {
  open: boolean;
  file?: DocumentVersionFile;
  nextFileName: string;
  isSubmitting: boolean;
  validationErrors: ValidationErrors;
}

type CommandPaletteMode =
  | "root"
  | "pickDocumentForVersion"
  | "pickDocumentForImport";

interface CommandPaletteState {
  open: boolean;
  mode: CommandPaletteMode;
  query: string;
}

interface DocumentExportDialogRequestState {
  workspacePath: string;
  format: DocumentExportDialogState["format"];
  scope: DocumentExportScope;
  token: number;
}

interface CommandPaletteCommand extends CommandPaletteItem {
  keywords: string[];
  searchSortDate?: string;
  onSelect: () => void;
}

interface DeleteRecordsDialogState {
  open: boolean;
  mode: "document" | "version";
  documentRecordId?: number;
  documentVersionId?: number;
  documentTitle: string;
  versionLabel: string;
  filePaths: string[];
  unmanagedPaths: string[];
  isSubmitting: boolean;
}

interface ConfirmationDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: "default" | "destructive";
  detailLines: string[];
  isSubmitting: boolean;
  kind?: "app-update-download" | "app-update-install";
  onConfirm?: () => Promise<void>;
}

interface RevisionDescriptionDialogState {
  open: boolean;
  title: string;
  content: string;
}

const defaultWorkspaceDialogState: WorkspaceDialogState = {
  open: false,
  name: "",
  folderName: "",
  useCustomFolderName: false,
  parentPath: "",
  initialAdminUsername: "admin",
  initialAdminDisplayName: "",
  initialAdminPassword: "",
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  lifecycle: createDefaultWorkspaceLifecycle(),
  includeExampleData: true,
  isSubmitting: false,
  validationErrors: {},
  isAdvancedSettingsOpen: false,
};

const defaultWorkspaceSettingsDialogState: WorkspaceSettingsDialogState = {
  open: false,
  rootPath: undefined,
  workspaceName: "",
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  originalSettings: undefined,
  initialAdminUsername: "admin",
  initialAdminDisplayName: "",
  initialAdminPassword: "",
  lifecycle: createDefaultWorkspaceLifecycle(),
  originalLifecycle: undefined,
  statusRemaps: {},
  companyLogoSourceFilePath: null,
  clearCompanyLogo: false,
  roleSettings: createDefaultWorkspaceRoleSettings(),
  roleSettingsDialog: {
    open: false,
    draft: createDefaultWorkspaceRoleSettings(),
    remaps: {},
    isSubmitting: false,
    message: "",
    tone: "warning",
  },
  isSubmitting: false,
  validationErrors: {},
  isAdvancedSettingsOpen: false,
};

const defaultApplicationSettingsDialogState: ApplicationSettingsDialogState = {
  open: false,
  settings: {
    ...DEFAULT_APPLICATION_SETTINGS,
    keyboardShortcuts: { ...DEFAULT_APPLICATION_SETTINGS.keyboardShortcuts },
  },
  isSubmitting: false,
};

const defaultTableColumnsDialogState: TableColumnsDialogState = {
  open: false,
  visibleColumns: [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS],
  isSubmitting: false,
  validationErrors: {},
};

const defaultDocumentDialogState: DocumentDialogState = {
  mode: "create",
  documentRecordId: undefined,
  open: false,
  title: "",
  documentTypeId: "",
  author: "",
  authorUserId: "",
  versionScheme: "numeric-3",
  templateId: "",
  startDate: "",
  languageId: "",
  confidentialityClassId: "",
  groupId: "",
  projectId: "",
  company: "",
  department: "",
  revisionIntervalMonths: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultVersionDialogState: VersionDialogState = {
  open: false,
  revisionDescription: "",
  bumpType: "minor",
  isSubmitting: false,
};

const defaultFilesDialogState: FilesDialogState = {
  open: false,
  versionId: undefined,
  reviewVersionIds: [],
  addRole: "working",
  pendingSourceFilePaths: [],
  pendingDuplicateWarnings: [],
  isSubmitting: false,
  submitLabel: "",
};

const defaultLatestVersionDialogState: LatestVersionDialogState = {
  open: false,
  mode: "latest",
  versionId: undefined,
  versionLabel: "",
  status: "Draft",
  releasedDate: "",
  reviewedBy: "",
  reviewedByUserId: "",
  approvedBy: "",
  approvedByUserId: "",
  revisionDescription: "",
  isSubmitting: false,
};

const defaultStatusChangeDialogState: StatusChangeDialogState = {
  open: false,
  document: undefined,
  nextStatus: "Draft",
  isSubmitting: false,
};

const defaultTypeDialogState: TypeDialogState = {
  open: false,
  name: "",
  numberPrefix: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultProjectDialogState: ProjectDialogState = {
  open: false,
  entity: "group",
  id: undefined,
  name: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultTemplateDialogState: TemplateDialogState = {
  open: false,
  name: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultTemplateFilesDialogState: TemplateFilesDialogState = {
  open: false,
  templateId: undefined,
  templateName: "",
  pendingSourceFilePaths: [],
  isDragActive: false,
  isSubmitting: false,
  validationErrors: {},
};

const defaultClassificationDialogState: ClassificationDialogState = {
  open: false,
  id: undefined,
  name: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultLanguageDialogState: LanguageDialogState = {
  open: false,
  id: undefined,
  code: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultDocumentExportDialogState: DocumentExportDialogState = {
  open: false,
  format: "csv",
  scope: "current-table",
  groupBy: "documentType",
  pdfColorMode: "color",
  isSubmitting: false,
};

const defaultBackupDialogState: BackupDialogState = {
  open: false,
  backups: [],
  integrityCheck: null,
  selectedBackupId: "",
  restoreDiff: null,
  isLoading: false,
  isSubmitting: false,
};

const defaultWorkspaceUsersDialogState: WorkspaceUsersDialogState = {
  open: false,
  users: [],
  roleSettings: createDefaultWorkspaceRoleSettings(),
  showArchivedUsers: false,
  selectedUserId: undefined,
  username: "",
  displayName: "",
  role: "viewer",
  password: "",
  isLoading: false,
  isSubmitting: false,
  formMessage: "",
  formTone: "warning",
  validationErrors: {},
};

const defaultAccessRecoveryState: AccessRecoveryState = {
  username: "admin",
  displayName: "",
  password: "",
  isSubmitting: false,
  error: "",
  validationErrors: {},
};

const defaultFilePreviewDialogState: FilePreviewDialogState = {
  open: false,
  preview: null,
  isLoading: false,
};

const defaultActivityLogDialogState: ActivityLogDialogState = {
  open: false,
  workspaceRootPath: undefined,
  workspaceName: "",
  items: [],
  isLoading: false,
};

const defaultVersionComparisonDialogState: VersionComparisonDialogState = {
  open: false,
  result: null,
  isLoading: false,
};

const defaultRenameFileDialogState: RenameFileDialogState = {
  open: false,
  file: undefined,
  nextFileName: "",
  isSubmitting: false,
  validationErrors: {},
};

const defaultDeleteRecordsDialogState: DeleteRecordsDialogState = {
  open: false,
  mode: "document",
  documentRecordId: undefined,
  documentVersionId: undefined,
  documentTitle: "",
  versionLabel: "",
  filePaths: [],
  unmanagedPaths: [],
  isSubmitting: false,
};

const defaultConfirmationDialogState: ConfirmationDialogState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "",
  tone: "destructive",
  detailLines: [],
  isSubmitting: false,
  kind: undefined,
  onConfirm: undefined,
};

const defaultRevisionDescriptionDialogState: RevisionDescriptionDialogState = {
  open: false,
  title: "",
  content: "",
};

const defaultCommandPaletteState: CommandPaletteState = {
  open: false,
  mode: "root",
  query: "",
};

const parseOptionalSelectNumber = (value: string): number | null =>
  value.trim() ? Number(value) : null;

const parseOptionalPositiveInteger = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
};

const clearValidationError = (
  errors: ValidationErrors,
  field: string,
): ValidationErrors => {
  if (!(field in errors)) {
    return errors;
  }

  const nextErrors = { ...errors };
  delete nextErrors[field];
  return nextErrors;
};

const applyInputChange = <
  TState extends {
    validationErrors: ValidationErrors;
  },
>(
  state: TState,
  field: string,
  patch: Partial<TState>,
): TState => ({
  ...state,
  ...(("formMessage" in state ? { formMessage: "" } : {}) as Partial<TState>),
  ...patch,
  validationErrors: clearValidationError(state.validationErrors, field),
});

const normalizeDocumentIdPreviewSegment = (
  value: string,
  fallback: string,
): string => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  return normalized || fallback;
};

const buildDocumentIdPreview = (
  settings: WorkspaceSettings,
  sequenceNumber: number,
): string => {
  const createdDate = new Date("2026-03-31T09:00:00.000Z");
  const year = String(createdDate.getUTCFullYear());
  const replacements: Record<string, string> = {
    doctypeprefix: "02",
    documenttypeprefix: "02",
    prefix: "02",
    doctype: "PROCEDURE",
    documenttype: "PROCEDURE",
    year,
    year2: year.slice(-2),
    month: String(createdDate.getUTCMonth() + 1).padStart(2, "0"),
    day: String(createdDate.getUTCDate()).padStart(2, "0"),
    author: normalizeDocumentIdPreviewSegment("Jordan Singh", "UNKNOWN"),
    language: "EN",
    languagecode: "EN",
    company: normalizeDocumentIdPreviewSegment("Acme Manufacturing", "NA"),
    department: normalizeDocumentIdPreviewSegment("Quality Assurance", "NA"),
    group: normalizeDocumentIdPreviewSegment("QMS Rollout", "NA"),
    groupname: normalizeDocumentIdPreviewSegment("QMS Rollout", "NA"),
    project: normalizeDocumentIdPreviewSegment("ERP Modernization", "NA"),
    projectname: normalizeDocumentIdPreviewSegment("ERP Modernization", "NA"),
    title: normalizeDocumentIdPreviewSegment("Operating Procedure", "UNTITLED"),
  };

  return resolveDocumentIdFormatTemplate(settings).replace(
    /<([^>]+)>/gi,
    (_match, tokenContent) => {
      const [rawName, rawArgument] = String(tokenContent).split(":", 2);
      const tokenName = rawName.trim().toLowerCase();

      if (tokenName === "sequence") {
        const width = Number(rawArgument?.trim() || "5");
        const safeWidth = Number.isInteger(width) && width > 0 ? width : 5;
        return String(sequenceNumber).padStart(safeWidth, "0");
      }

      return replacements[tokenName] ?? `<${tokenContent}>`;
    },
  );
};

const toDateInputValue = (value: string | null | undefined): string =>
  value ? value.slice(0, 10) : "";

const toDocumentUpdateInput = (
  document: Pick<
    DocumentListItem,
    | "id"
    | "title"
    | "author"
    | "languageId"
    | "confidentialityClassId"
    | "groupId"
    | "projectId"
    | "company"
    | "department"
    | "startDate"
    | "revisionIntervalMonths"
  >,
): UpdateDocumentInput => ({
  documentRecordId: document.id,
  title: document.title,
  author: document.author,
  startDate: document.startDate,
  languageId: document.languageId,
  confidentialityClassId: document.confidentialityClassId,
  groupId: document.groupId,
  projectId: document.projectId,
  company: document.company,
  department: document.department,
  revisionIntervalMonths: document.revisionIntervalMonths,
});

const getEffectiveDocumentTableVisibleColumns = (
  appVisibleColumns: DocumentTableColumn[],
  workspaceAvailableColumns: DocumentTableColumn[],
): DocumentTableColumn[] => {
  const filtered = appVisibleColumns.filter((column) =>
    workspaceAvailableColumns.includes(column),
  );
  if (filtered.length > 0) {
    return filtered;
  }

  const defaultFiltered = DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS.filter(
    (column) => workspaceAvailableColumns.includes(column),
  );
  return defaultFiltered.length > 0
    ? defaultFiltered
    : [...workspaceAvailableColumns];
};

const getDocumentExportGroupingOptions = (
  availableColumns: DocumentTableColumn[],
): ExportGroupingOption[] => {
  const options: ExportGroupingOption[] = [
    { value: "none", label: "No Grouping" },
    { value: "documentType", label: "Document Type" },
    { value: "status", label: "Status" },
  ];

  if (availableColumns.includes("group")) {
    options.push({ value: "group", label: "Group" });
  }

  if (availableColumns.includes("project")) {
    options.push({ value: "project", label: "Project" });
  }

  if (availableColumns.includes("language")) {
    options.push({ value: "language", label: "Language" });
  }

  if (availableColumns.includes("confidentialityClass")) {
    options.push({
      value: "confidentialityClass",
      label: "Confidentiality Class",
    });
  }

  if (availableColumns.includes("company")) {
    options.push({ value: "company", label: "Company" });
  }

  if (availableColumns.includes("department")) {
    options.push({ value: "department", label: "Department" });
  }

  if (availableColumns.includes("author")) {
    options.push({ value: "author", label: "Author" });
  }

  return options;
};

const getDocumentExportScopeLabel = (scope: DocumentExportScope): string =>
  scope === "current-table" ? "Current Table" : "Whole Workspace";

const getPathFileName = (value: string): string =>
  value.split(/[/\\]/).pop() ?? value;

const mergeUniqueFilePaths = (
  current: string[],
  incoming: string[],
): string[] => {
  const seen = new Set(current.map((value) => value.toLowerCase()));
  const next = [...current];

  for (const filePath of incoming) {
    const trimmed = filePath.trim();
    if (!trimmed) {
      continue;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    next.push(trimmed);
  }

  return next;
};

const getFilePathsFromFileList = (files: FileList | File[]): string[] =>
  Array.from(files)
    .map((file) => file.path ?? "")
    .filter((value): value is string => value.trim().length > 0);

const resolveDroppedFilePaths = async (
  files: FileList | File[],
): Promise<string[]> => {
  const directPaths = getFilePathsFromFileList(files);
  if (directPaths.length > 0) {
    return directPaths;
  }

  return window.docTrack.dialogs.resolveDroppedFilePaths(Array.from(files));
};

const cloneApplicationSettings = (
  settings: ApplicationSettings,
): ApplicationSettings => ({
  ...settings,
  keyboardShortcuts: { ...settings.keyboardShortcuts },
});

const normalizeShortcutKey = (value: string): string | null => {
  const key = value.trim();
  if (!key) {
    return null;
  }

  const aliases: Record<string, string> = {
    ",": ",",
    ".": ".",
    "/": "/",
    "\\": "\\",
    ";": ";",
    "'": "'",
    "-": "-",
    "=": "=",
    "[": "[",
    "]": "]",
    "`": "`",
    escape: "Escape",
    esc: "Escape",
    enter: "Enter",
    return: "Enter",
    tab: "Tab",
    space: "Space",
  };
  const lower = key.toLowerCase();

  if (aliases[lower]) {
    return aliases[lower];
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  if (/^f\d{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }

  return /^[A-Za-z0-9]+$/.test(key)
    ? key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    : null;
};

const getShortcutFromKeyboardEvent = (
  event: KeyboardEvent,
): KeyboardShortcutValue => {
  const key = normalizeShortcutKey(event.key);
  if (!key) {
    return null;
  }

  const parts = [
    ...(event.metaKey || event.ctrlKey ? ["Mod"] : []),
    ...(event.altKey ? ["Alt"] : []),
    ...(event.shiftKey ? ["Shift"] : []),
    key,
  ];

  return parts.join("+");
};

const doesEventMatchShortcut = (
  event: KeyboardEvent,
  shortcut: KeyboardShortcutValue,
): boolean =>
  shortcut !== null && getShortcutFromKeyboardEvent(event) === shortcut;

const formatShortcutForDisplay = (
  shortcut: KeyboardShortcutValue,
  options: { isMacOs: boolean },
): string => {
  if (!shortcut) {
    return "Disabled";
  }

  return shortcut
    .split("+")
    .map((token) => {
      if (token === "Mod") {
        return options.isMacOs ? "Cmd" : "Ctrl";
      }

      if (token === "Alt") {
        return options.isMacOs ? "Option" : "Alt";
      }

      if (token === "Space") {
        return "Space";
      }

      return token;
    })
    .join(" + ");
};

const getShortcutConflictActions = (
  shortcuts: KeyboardShortcutMap,
): KeyboardShortcutAction[] => {
  const owners = new Map<string, KeyboardShortcutAction[]>();

  for (const action of KEYBOARD_SHORTCUT_ACTIONS) {
    const shortcut = shortcuts[action];
    if (!shortcut) {
      continue;
    }

    owners.set(shortcut, [...(owners.get(shortcut) ?? []), action]);
  }

  return [...owners.values()].filter((actions) => actions.length > 1).flat();
};

const normalizeCommandPaletteSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getCommandPaletteSearchRank = (
  command: CommandPaletteCommand,
  query: string,
): number | null => {
  const normalizedQuery = normalizeCommandPaletteSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const fields = [command.label, command.subtitle ?? "", ...command.keywords];
  let bestRank: number | null = null;

  for (const field of fields) {
    const normalizedField = normalizeCommandPaletteSearchText(field);
    if (!normalizedField) {
      continue;
    }

    let rank: number | null = null;

    if (normalizedField === normalizedQuery) {
      rank = 0;
    } else if (normalizedField.startsWith(normalizedQuery)) {
      rank = 1;
    } else if (
      normalizedField
        .split(" ")
        .some((word) => word.startsWith(normalizedQuery))
    ) {
      rank = 2;
    } else if (normalizedField.includes(normalizedQuery)) {
      rank = 3;
    }

    if (rank === null) {
      continue;
    }

    if (bestRank === null || rank < bestRank) {
      bestRank = rank;
    }
  }

  return bestRank;
};

const filterCommandPaletteCommands = (
  commands: CommandPaletteCommand[],
  query: string,
  options?: { preferNewestSortDate?: boolean },
): CommandPaletteCommand[] =>
  commands
    .map((command, index) => ({
      command,
      index,
      rank: getCommandPaletteSearchRank(command, query),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        command: CommandPaletteCommand;
        index: number;
        rank: number;
      } => candidate.rank !== null,
    )
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      if (options?.preferNewestSortDate) {
        const leftTime = left.command.searchSortDate
          ? Date.parse(left.command.searchSortDate)
          : Number.NaN;
        const rightTime = right.command.searchSortDate
          ? Date.parse(right.command.searchSortDate)
          : Number.NaN;

        if (!Number.isNaN(leftTime) || !Number.isNaN(rightTime)) {
          return (
            (Number.isNaN(rightTime) ? 0 : rightTime) -
            (Number.isNaN(leftTime) ? 0 : leftTime)
          );
        }
      }

      return left.index - right.index;
    })
    .map((candidate) => candidate.command);

const stopRowAction = (event: React.MouseEvent) => event.stopPropagation();
const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  formatUserFacingError(error, fallbackMessage);

const validateWorkspaceRootDirectorySettings = (
  settings: WorkspaceSettings,
): ValidationErrors => {
  const errors: ValidationErrors = {};
  const seenNames = new Map<string, WorkspaceRootDirectorySettingKey>();

  for (const key of WORKSPACE_ROOT_DIRECTORY_SETTING_KEYS) {
    const value = settings[key].trim();
    const fieldKey = `rootDirectory.${key}`;

    if (!value) {
      errors[fieldKey] =
        `${ROOT_DIRECTORY_FIELD_LABELS[key]} folder name is required.`;
      continue;
    }

    if (!isValidWorkspaceRootDirectoryName(value)) {
      errors[fieldKey] =
        `${ROOT_DIRECTORY_FIELD_LABELS[key]} folder name contains invalid filesystem characters.`;
      continue;
    }

    const duplicateKey = seenNames.get(value.toLowerCase());
    if (duplicateKey) {
      errors[fieldKey] = "Folder names must be unique.";
      errors[`rootDirectory.${duplicateKey}`] = "Folder names must be unique.";
      continue;
    }

    seenNames.set(value.toLowerCase(), key);
  }

  return errors;
};

const validateWorkspaceSettings = (
  settings: WorkspaceSettings,
  lifecycle?: WorkspaceLifecycle,
): ValidationErrors => {
  const errors = validateWorkspaceRootDirectorySettings(settings);

  if (
    settings.documentIdFormatPreset === "custom" &&
    !settings.documentIdFormatTemplate.trim()
  ) {
    errors.documentIdFormatTemplate =
      "Document ID template is required for the custom format.";
  }

  if (settings.visibleDocumentColumns.length === 0) {
    errors.visibleDocumentColumns =
      "Enable at least one workspace field before saving.";
  }

  if (
    !Number.isInteger(settings.activityLogMaxRows) ||
    settings.activityLogMaxRows <= 0
  ) {
    errors.activityLogMaxRows =
      "Activity log max rows must be a whole number greater than zero.";
  }

  if (lifecycle) {
    const lifecycleErrors = validateWorkspaceLifecycle(lifecycle, {
      requireAutoPreviousVersionStatus:
        settings.autoMarkPreviousVersionObsolete,
    });
    const initialStatus = getWorkspaceStatusByKey(
      lifecycle,
      lifecycle.initialStatusKey,
    );
    const autoPreviousStatus = lifecycle.autoPreviousVersionStatusKey
      ? getWorkspaceStatusByKey(
          lifecycle,
          lifecycle.autoPreviousVersionStatusKey,
        )
      : null;

    if (lifecycleErrors.length > 0) {
      errors.lifecycle = lifecycleErrors[0];
    } else if (
      initialStatus &&
      (initialStatus.requiresReleasedDate ||
        initialStatus.requiresReviewedBy ||
        initialStatus.requiresApprovedBy)
    ) {
      errors.lifecycle =
        "The initial lifecycle status cannot require release metadata.";
    } else if (
      settings.autoMarkPreviousVersionObsolete &&
      autoPreviousStatus &&
      (autoPreviousStatus.requiresReleasedDate ||
        autoPreviousStatus.requiresReviewedBy ||
        autoPreviousStatus.requiresApprovedBy)
    ) {
      errors.lifecycle =
        "The previous-version lifecycle status cannot require release metadata.";
    }
  }

  return errors;
};

const validateWorkspaceDialogState = (
  state: WorkspaceDialogState,
): ValidationErrors => {
  const errors = validateWorkspaceSettings(state.settings, state.lifecycle);

  if (!state.name.trim()) {
    errors.name = "Workspace name is required.";
  }

  if (state.useCustomFolderName && !state.folderName.trim()) {
    errors.folderName = "Folder name is required when using a custom folder.";
  }

  if (!state.parentPath.trim()) {
    errors.parentPath = "Workspace location is required.";
  }

  if (
    state.settings.userSystemEnabled &&
    !state.initialAdminDisplayName.trim()
  ) {
    errors.initialAdminDisplayName = "Admin display name is required.";
  }

  if (state.settings.userSystemEnabled && !state.initialAdminPassword.trim()) {
    errors.initialAdminPassword = "Admin password or PIN is required.";
  }

  return errors;
};

const validateWorkspaceSettingsDialogState = (
  state: WorkspaceSettingsDialogState,
): ValidationErrors =>
  validateWorkspaceSettings(state.settings, state.lifecycle);

const validateTableColumnsDialogState = (
  state: TableColumnsDialogState,
): ValidationErrors =>
  state.visibleColumns.length === 0
    ? { visibleColumns: "Select at least one table column." }
    : {};

const validateDocumentDialogState = (
  state: DocumentDialogState,
  availableColumns: DocumentTableColumn[],
): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!state.title.trim()) {
    errors.title = "Document title is required.";
  }

  if (
    availableColumns.includes("author") &&
    !state.authorUserId.trim() &&
    !state.author.trim()
  ) {
    errors.author = "Author is required.";
  }

  if (state.mode === "create" && !state.documentTypeId.trim()) {
    errors.documentTypeId = "Document type is required.";
  }

  if (
    state.revisionIntervalMonths.trim() &&
    Number.isNaN(parseOptionalPositiveInteger(state.revisionIntervalMonths))
  ) {
    errors.revisionIntervalMonths =
      "Revision interval must be a whole number greater than zero.";
  }

  return errors;
};

const validateTypeDialogState = (state: TypeDialogState): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!state.name.trim()) {
    errors.name = "Type name is required.";
  }

  if (!state.numberPrefix.trim()) {
    errors.numberPrefix = "Number prefix is required.";
  } else if (state.numberPrefix.trim().length !== 2) {
    errors.numberPrefix = "Number prefix must be exactly 2 digits.";
  }

  return errors;
};

const validateNameDialogState = (
  name: string,
  label: string,
): ValidationErrors =>
  name.trim()
    ? {}
    : {
        name: `${label} is required.`,
      };

const validateLanguageDialogState = (
  state: LanguageDialogState,
): ValidationErrors =>
  state.code.trim()
    ? {}
    : {
        code: "Language code is required.",
      };

const validateTemplateFilesDialogState = (
  state: TemplateFilesDialogState,
): ValidationErrors =>
  state.pendingSourceFilePaths.length > 0
    ? {}
    : {
        pendingSourceFilePaths: "Add at least one file before importing.",
      };

const validateRenameFileDialogState = (
  state: RenameFileDialogState,
): ValidationErrors =>
  state.nextFileName.trim()
    ? {}
    : {
        nextFileName: "File name is required.",
      };

function App() {
  const {
    openWorkspaces,
    activeWorkspacePath,
    recentWorkspaces,
    applicationSettings,
    isBootstrapped,
    notification,
    bootstrap,
    createWorkspace,
    openWorkspace,
    refreshWorkspace,
    closeWorkspace,
    dismissRecentWorkspace,
    updateWorkspaceSettings,
    updateDashboardLayout,
    signInWorkspace,
    recoverWorkspaceAccess,
    signOutWorkspace,
    createSavedView,
    updateSavedView,
    deleteSavedView,
    duplicateSavedView,
    promoteSavedViewToShared,
    setActiveWorkspace,
    setWorkspaceView,
    setDocumentsVisualization,
    setDocumentViewState,
    applySavedView,
    applyDashboardDrilldown,
    setSelectedDocument,
    updateApplicationSettings,
    setNotification,
  } = useAppStore();

  const [workspaceDialog, setWorkspaceDialog] = useState(
    defaultWorkspaceDialogState,
  );
  const [workspaceSettingsDialog, setWorkspaceSettingsDialog] = useState(
    defaultWorkspaceSettingsDialogState,
  );
  const [applicationSettingsDialog, setApplicationSettingsDialog] = useState(
    defaultApplicationSettingsDialogState,
  );
  const [tableColumnsDialog, setTableColumnsDialog] = useState(
    defaultTableColumnsDialogState,
  );
  const [documentDialog, setDocumentDialog] = useState(
    defaultDocumentDialogState,
  );
  const [versionDialog, setVersionDialog] = useState(defaultVersionDialogState);
  const [filesDialog, setFilesDialog] = useState(defaultFilesDialogState);
  const [filesDialogVersion, setFilesDialogVersion] =
    useState<DocumentVersion | null>(null);
  const [latestVersionDialog, setLatestVersionDialog] = useState(
    defaultLatestVersionDialogState,
  );
  const [statusChangeDialog, setStatusChangeDialog] = useState(
    defaultStatusChangeDialogState,
  );
  const [typeDialog, setTypeDialog] = useState(defaultTypeDialogState);
  const [projectDialog, setProjectDialog] = useState(defaultProjectDialogState);
  const [templateDialog, setTemplateDialog] = useState(
    defaultTemplateDialogState,
  );
  const [templateFilesDialog, setTemplateFilesDialog] = useState(
    defaultTemplateFilesDialogState,
  );
  const [classificationDialog, setClassificationDialog] = useState(
    defaultClassificationDialogState,
  );
  const [languageDialog, setLanguageDialog] = useState(
    defaultLanguageDialogState,
  );
  const [backupDialog, setBackupDialog] = useState(defaultBackupDialogState);
  const [workspaceUsersDialog, setWorkspaceUsersDialog] = useState(
    defaultWorkspaceUsersDialogState,
  );
  const [accessRecoveryState, setAccessRecoveryState] = useState(
    defaultAccessRecoveryState,
  );
  const [filePreviewDialog, setFilePreviewDialog] = useState(
    defaultFilePreviewDialogState,
  );
  const [activityLogDialog, setActivityLogDialog] = useState(
    defaultActivityLogDialogState,
  );
  const [versionComparisonDialog, setVersionComparisonDialog] = useState(
    defaultVersionComparisonDialogState,
  );
  const [renameFileDialog, setRenameFileDialog] = useState(
    defaultRenameFileDialogState,
  );
  const [deleteRecordsDialog, setDeleteRecordsDialog] = useState(
    defaultDeleteRecordsDialogState,
  );
  const [confirmationDialog, setConfirmationDialog] = useState(
    defaultConfirmationDialogState,
  );
  const [revisionDescriptionDialog, setRevisionDescriptionDialog] = useState(
    defaultRevisionDescriptionDialogState,
  );
  const [commandPalette, setCommandPalette] = useState(
    defaultCommandPaletteState,
  );
  const [documentExportDialogRequest, setDocumentExportDialogRequest] =
    useState<DocumentExportDialogRequestState | null>(null);
  const [selectedDocumentDetail, setSelectedDocumentDetail] =
    useState<DocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [signInState, setSignInState] = useState({
    username: "",
    password: "",
    isSubmitting: false,
    error: "",
  });
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateState | null>(
    null,
  );
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const launchUpdatePromptKeyRef = useRef<string | null>(null);
  const downloadedLaunchUpdatePromptKeyRef = useRef<string | null>(null);

  const workspaceTabs = Object.values(openWorkspaces);
  const activeWorkspace = activeWorkspacePath
    ? openWorkspaces[activeWorkspacePath]
    : undefined;
  const activeWorkspaceSession = activeWorkspace?.session ?? null;
  const activeWorkspacePermissions = activeWorkspaceSession?.permissions ?? null;
  const isActiveWorkspaceAuthenticated =
    activeWorkspace?.authKind === "authenticated";
  const hasActiveWorkspaceAccess = Boolean(
    activeWorkspace && isActiveWorkspaceAuthenticated,
  );
  const isActiveWorkspaceUserSystemEnabled = Boolean(
    activeWorkspace?.settings.userSystemEnabled,
  );
  const canManageWorkspaceUsers = Boolean(
    activeWorkspacePermissions?.canManageUsers,
  );
  const canManageWorkspaceRoles = Boolean(
    activeWorkspacePermissions?.canManageRoles,
  );
  const canOpenWorkspaceUsers = canManageWorkspaceUsers;
  const activeWorkspaceFilesystemAttention = activeWorkspace
    ? getWorkspaceFilesystemAttentionCounts(activeWorkspace)
    : null;
  const activeWorkspaceAvailableColumns =
    activeWorkspace?.settings.visibleDocumentColumns ??
    DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns;
  const workspaceSupportsGroups = Boolean(activeWorkspace);
  const workspaceSupportsConfidentialityClasses =
    activeWorkspaceAvailableColumns.includes("confidentialityClass");
  const workspaceSupportsLanguages =
    activeWorkspaceAvailableColumns.includes("language");
  const selectedDocumentSummary =
    activeWorkspace?.documents.find(
      (document) => document.id === activeWorkspace.selectedDocumentRecordId,
    ) ?? null;
  const activeFilesVersion =
    selectedDocumentDetail?.versions.find(
      (version) => version.id === filesDialog.versionId,
    ) ?? filesDialogVersion;
  const activeFilesAffectedVersions =
    selectedDocumentDetail?.versions.filter((version) =>
      versionNeedsFilesystemReview(version),
    ) ??
    (filesDialogVersion && versionNeedsFilesystemReview(filesDialogVersion)
      ? [filesDialogVersion]
      : []);
  const previewThemeMode = applicationSettingsDialog.open
    ? applicationSettingsDialog.settings.themeMode
    : applicationSettings.themeMode;
  const detailViewMode = applicationSettings.documentDetailViewMode;
  const isMacOs = useMemo(
    () =>
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
      /Mac OS X/.test(navigator.userAgent),
    [],
  );
  const isNonPaletteModalOpen =
    workspaceDialog.open ||
    workspaceSettingsDialog.open ||
    applicationSettingsDialog.open ||
    tableColumnsDialog.open ||
    documentDialog.open ||
    versionDialog.open ||
    filesDialog.open ||
    latestVersionDialog.open ||
    statusChangeDialog.open ||
    typeDialog.open ||
    projectDialog.open ||
    templateDialog.open ||
    templateFilesDialog.open ||
    classificationDialog.open ||
    languageDialog.open ||
    backupDialog.open ||
    workspaceUsersDialog.open ||
    filePreviewDialog.open ||
    activityLogDialog.open ||
    versionComparisonDialog.open ||
    renameFileDialog.open ||
    deleteRecordsDialog.open ||
    confirmationDialog.open ||
    revisionDescriptionDialog.open;
  const notifyError = useEffectEvent(
    (error: unknown, fallbackMessage: string): void => {
      setNotification({
        tone: "error",
        message: getErrorMessage(error, fallbackMessage),
      });
    },
  );

  useEffect(() => {
    setAccessRecoveryState(defaultAccessRecoveryState);
  }, [activeWorkspace?.workspace.rootPath, activeWorkspace?.canRecoverAccess]);
  const openConfirmationDialog = useEffectEvent(
    (input: Omit<ConfirmationDialogState, "open" | "isSubmitting">): void => {
      setConfirmationDialog({
        ...input,
        open: true,
        isSubmitting: false,
      });
    },
  );
  const openRevisionDescriptionDialog = useEffectEvent(
    (title: string, content: string): void => {
      setRevisionDescriptionDialog({
        open: true,
        title,
        content,
      });
    },
  );
  const openVersionMetadataDialog = useEffectEvent(
    (
      version: DocumentVersion,
      mode: "latest" | "version" = "version",
      overrides?: Partial<Pick<LatestVersionDialogState, "status">>,
    ): void => {
      setLatestVersionDialog({
        open: true,
        mode,
        versionId: version.id,
        versionLabel: version.versionLabel,
        status: overrides?.status ?? version.status,
        releasedDate: toDateInputValue(version.releasedDate),
        reviewedBy: version.reviewedBy,
        reviewedByUserId: version.reviewedByUserId
          ? String(version.reviewedByUserId)
          : "",
        approvedBy: version.approvedBy,
        approvedByUserId: version.approvedByUserId
          ? String(version.approvedByUserId)
          : "",
        revisionDescription: version.revisionDescription,
        isSubmitting: false,
      });
    },
  );
  const closeCommandPalette = useEffectEvent((): void => {
    setCommandPalette(defaultCommandPaletteState);
  });
  const openCommandPalette = useEffectEvent((): void => {
    if (isNonPaletteModalOpen) {
      return;
    }

    setIsWorkspaceMenuOpen(false);
    setCommandPalette({
      open: true,
      mode: "root",
      query: "",
    });
  });
  const openCommandPaletteDocumentPicker = useEffectEvent(
    (mode: Exclude<CommandPaletteMode, "root">): void => {
      setCommandPalette((state) =>
        state.open
          ? {
              ...state,
              mode,
              query: "",
            }
          : state,
      );
    },
  );
  const runCommandPaletteAction = useEffectEvent(
    (action: () => void | Promise<void>, fallbackMessage: string): void => {
      closeCommandPalette();
      window.requestAnimationFrame(() => {
        void Promise.resolve(action()).catch((error) => {
          notifyError(error, fallbackMessage);
        });
      });
    },
  );
  const openCreateVersionForDocument = useEffectEvent(
    async (documentRecordId: number): Promise<void> => {
      if (!activeWorkspacePath) {
        return;
      }

      const detail =
        selectedDocumentDetail?.id === documentRecordId
          ? selectedDocumentDetail
          : await loadDocumentDetail(activeWorkspacePath, documentRecordId);

      if (!detail) {
        return;
      }

      startTransition(() => {
        setWorkspaceView(activeWorkspacePath, "documents");
        setSelectedDocument(activeWorkspacePath, documentRecordId);
      });
      setSelectedDocumentDetail(detail);
      setVersionDialog({
        ...defaultVersionDialogState,
        open: true,
      });
    },
  );
  const openImportFilesForDocument = useEffectEvent(
    async (documentRecordId: number): Promise<void> => {
      if (!activeWorkspacePath) {
        return;
      }

      const detail =
        selectedDocumentDetail?.id === documentRecordId
          ? selectedDocumentDetail
          : await loadDocumentDetail(activeWorkspacePath, documentRecordId);

      if (!detail) {
        return;
      }

      startTransition(() => {
        setWorkspaceView(activeWorkspacePath, "documents");
        setSelectedDocument(activeWorkspacePath, documentRecordId);
      });
      setSelectedDocumentDetail(detail);

      const latestVersion = detail.versions[0];
      if (!latestVersion) {
        setNotification({
          tone: "error",
          message: "Create a version before showing version files.",
        });
        return;
      }

      const sourceFilePaths = await window.docTrack.dialogs.pickDocumentFiles();
      if (sourceFilePaths.length === 0) {
        return;
      }

      openFilesDialogForDetail(detail, {
        preferredVersionId: latestVersion.id,
      });
      await stageFilesForVersion(latestVersion.id, sourceFilePaths);
    },
  );
  const handleWorkspaceFilesystemDrift = useEffectEvent(
    async (rootPath: string): Promise<void> => {
      if (!openWorkspaces[rootPath]) {
        return;
      }

      try {
        await refreshWorkspace(rootPath);
        if (
          rootPath === activeWorkspacePath &&
          activeWorkspace?.selectedDocumentRecordId
        ) {
          await loadDocumentDetail(
            rootPath,
            activeWorkspace.selectedDocumentRecordId,
          );
        }

        setNotification({
          tone: "success",
          message: `Filesystem changes were detected in "${openWorkspaces[rootPath]?.workspace.name ?? "workspace"}". Review pending file drift before reconciling.`,
        });
      } catch (error) {
        notifyError(
          error,
          "Unable to refresh workspace state after filesystem changes.",
        );
      }
    },
  );

  useEffect(() => {
    let isMounted = true;

    const initializeShell = async () => {
      try {
        setBootError(null);
        await bootstrap();
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = getErrorMessage(
          error,
          "DocTrack failed to initialize the desktop shell.",
        );
        setBootError(message);
        notifyError(error, "DocTrack failed to initialize the desktop shell.");
      }
    };

    void initializeShell();

    return () => {
      isMounted = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    const unsubscribe = window.docTrack.workspace.onFilesystemDrift((event) => {
      void handleWorkspaceFilesystemDrift(event.rootPath);
    });

    return unsubscribe;
  }, [handleWorkspaceFilesystemDrift]);

  useEffect(() => {
    let isMounted = true;

    void window.docTrack.appUpdates
      .getState()
      .then((state) => {
        if (isMounted) {
          setAppUpdateState(state);
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setNotification({
          tone: "error",
          message: getErrorMessage(
            error,
            "Unable to load the application update status.",
          ),
        });
      });

    const unsubscribe = window.docTrack.appUpdates.onStateChange((state) => {
      setAppUpdateState(state);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyTheme(previewThemeMode);
  }, [previewThemeMode]);

  useEffect(() => {
    if (previewThemeMode !== "system") {
      return undefined;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    query.addEventListener("change", listener);

    return () => {
      query.removeEventListener("change", listener);
    };
  }, [previewThemeMode]);

  useEffect(() => {
    if (
      !notification ||
      notification.tone !== "success" ||
      !applicationSettings.autoDismissSuccessNotifications
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotification(undefined);
    }, SUCCESS_NOTIFICATION_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    applicationSettings.autoDismissSuccessNotifications,
    notification,
    setNotification,
  ]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        workspaceMenuRef.current &&
        event.target instanceof Node &&
        !workspaceMenuRef.current.contains(event.target)
      ) {
        setIsWorkspaceMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    if (commandPalette.open && isNonPaletteModalOpen) {
      setCommandPalette(defaultCommandPaletteState);
    }
  }, [commandPalette.open, isNonPaletteModalOpen]);

  useEffect(() => {
    if (commandPalette.mode === "root" || activeWorkspace) {
      return;
    }

    setCommandPalette((state) => ({
      ...state,
      mode: "root",
      query: "",
    }));
  }, [activeWorkspace, commandPalette.mode]);

  useEffect(() => {
    if (
      detailViewMode !== "sidebar" ||
      !activeWorkspace?.selectedDocumentRecordId
    ) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!activeWorkspacePath) {
          return;
        }

        setSelectedDocument(activeWorkspacePath, undefined);
        setSelectedDocumentDetail(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    activeWorkspace?.selectedDocumentRecordId,
    activeWorkspacePath,
    detailViewMode,
    setSelectedDocument,
  ]);

  useEffect(() => {
    const loadSelectedDocumentDetail = async () => {
      if (!activeWorkspacePath || !activeWorkspace?.selectedDocumentRecordId) {
        setSelectedDocumentDetail(null);
        return;
      }

      setIsDetailLoading(true);
      try {
        const detail = await window.docTrack.documents.detail(
          activeWorkspacePath,
          activeWorkspace.selectedDocumentRecordId,
        );
        setSelectedDocumentDetail(detail);
      } catch (error) {
        notifyError(error, "Unable to load the selected document.");
      } finally {
        setIsDetailLoading(false);
      }
    };

    void loadSelectedDocumentDetail();
  }, [activeWorkspace?.selectedDocumentRecordId, activeWorkspacePath]);

  const fetchDocumentDetail = async (
    rootPath: string,
    documentRecordId: number,
  ): Promise<DocumentDetail> =>
    window.docTrack.documents.detail(rootPath, documentRecordId);

  const loadDocumentDetail = async (
    rootPath: string,
    documentRecordId: number,
  ): Promise<DocumentDetail> => {
    const detail = await fetchDocumentDetail(rootPath, documentRecordId);
    setSelectedDocument(rootPath, documentRecordId);
    setSelectedDocumentDetail(detail);
    return detail;
  };

  const refreshSelectedDocument = async (
    rootPath: string,
    documentRecordId: number,
  ): Promise<DocumentDetail> => {
    const [detail] = await Promise.all([
      loadDocumentDetail(rootPath, documentRecordId),
      refreshWorkspace(rootPath),
    ]);
    return detail;
  };

  useEffect(() => {
    if (!activeWorkspacePath || !activeWorkspace?.selectedDocumentRecordId) {
      setSelectedDocumentDetail(null);
      return;
    }

    if (
      filesDialog.versionId &&
      selectedDocumentDetail &&
      !selectedDocumentDetail.versions.some(
        (version) => version.id === filesDialog.versionId,
      )
    ) {
      setFilesDialogVersion(null);
      setFilesDialog(defaultFilesDialogState);
    }
  }, [
    activeWorkspace?.selectedDocumentRecordId,
    activeWorkspacePath,
    filesDialog.versionId,
    selectedDocumentDetail,
  ]);

  useEffect(() => {
    if (!filesDialog.versionId || !selectedDocumentDetail) {
      return;
    }

    const matchingVersion = selectedDocumentDetail.versions.find(
      (version) => version.id === filesDialog.versionId,
    );
    if (matchingVersion) {
      setFilesDialogVersion(matchingVersion);
    }
  }, [filesDialog.versionId, selectedDocumentDetail]);

  const openWorkspacePicker = async () => {
    setIsWorkspaceMenuOpen(false);
    const rootPath = await window.docTrack.dialogs.pickWorkspaceOpenPath();
    if (!rootPath) {
      return;
    }

    try {
      await openWorkspace(rootPath);
    } catch (error) {
      notifyError(error, "Unable to open workspace.");
    }
  };

  const openCreateWorkspaceDialog = () => {
    setIsWorkspaceMenuOpen(false);
    setWorkspaceDialog(buildWorkspaceDialogState(applicationSettings));
  };

  const openCreateDocumentDialog = () => {
    if (!activeWorkspace) {
      return;
    }

    setDocumentDialog(
      buildCreateDocumentDialogState(
        applicationSettings,
        activeWorkspace.settings,
        activeWorkspace.settings.userSystemEnabled
          ? activeWorkspace.session?.user
          : null,
      ),
    );
  };

  const openEditDocumentDialog = async (documentRecordId?: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    const detail =
      documentRecordId && selectedDocumentDetail?.id !== documentRecordId
        ? await fetchDocumentDetail(activeWorkspacePath, documentRecordId)
        : selectedDocumentDetail;

    if (!detail) {
      return;
    }

    setDocumentDialog(buildEditDocumentDialogState(detail));
  };

  const openApplicationSettingsDialog = () => {
    setApplicationSettingsDialog(
      buildApplicationSettingsDialogState(applicationSettings),
    );
  };

  const handleCheckForUpdates = useEffectEvent(async (): Promise<void> => {
    if (
      applicationSettingsDialog.settings.autoUpdateEnabled !==
        applicationSettings.autoUpdateEnabled ||
      applicationSettingsDialog.settings.checkForUpdatesOnLaunch !==
        applicationSettings.checkForUpdatesOnLaunch
    ) {
      setNotification({
        tone: "error",
        message: APP_UPDATE_MANUAL_ACTION_MESSAGE,
      });
      return;
    }

    try {
      await window.docTrack.appUpdates.checkForUpdates();
    } catch (error) {
      notifyError(error, "Unable to check for application updates.");
    }
  });

  const handleDownloadUpdate = useEffectEvent(async (): Promise<void> => {
    try {
      await window.docTrack.appUpdates.downloadUpdate();
    } catch (error) {
      notifyError(error, "Unable to download the available update.");
    }
  });

  const handleInstallUpdate = useEffectEvent(async (): Promise<void> => {
    try {
      await window.docTrack.appUpdates.quitAndInstall();
    } catch (error) {
      notifyError(error, "Unable to install the downloaded update.");
    }
  });

  useEffect(() => {
    if (
      !appUpdateState ||
      appUpdateState.status !== "available" ||
      appUpdateState.lastCheckSource !== "launch"
    ) {
      return;
    }

    const promptKey = buildAppUpdatePromptKey(appUpdateState);
    if (!promptKey || launchUpdatePromptKeyRef.current === promptKey) {
      return;
    }

    launchUpdatePromptKeyRef.current = promptKey;
    openConfirmationDialog({
      kind: "app-update-download",
      title: "Update Available",
      description: `DocTrack ${appUpdateState.release?.version ?? ""} is available. Download it now?`,
      confirmLabel: "Download Update",
      tone: "default",
      detailLines: [
        `Current version: ${appUpdateState.currentVersion}`,
        `Available version: ${appUpdateState.release?.version ?? "Unknown"}`,
      ],
      onConfirm: async () => {
        await window.docTrack.appUpdates.downloadUpdate();
      },
    });
  }, [appUpdateState, openConfirmationDialog]);

  useEffect(() => {
    if (
      !appUpdateState ||
      appUpdateState.status !== "downloaded" ||
      appUpdateState.lastCheckSource !== "launch"
    ) {
      return;
    }

    const promptKey = buildAppUpdatePromptKey(appUpdateState);
    if (
      !promptKey ||
      downloadedLaunchUpdatePromptKeyRef.current === promptKey
    ) {
      return;
    }

    downloadedLaunchUpdatePromptKeyRef.current = promptKey;
    openConfirmationDialog({
      kind: "app-update-install",
      title: "Install Update",
      description: `DocTrack ${appUpdateState.release?.version ?? ""} has finished downloading. Restart and install it now?`,
      confirmLabel: "Install and Restart",
      tone: "default",
      detailLines: [
        `Current version: ${appUpdateState.currentVersion}`,
        `Downloaded version: ${appUpdateState.release?.version ?? "Unknown"}`,
      ],
      onConfirm: async () => {
        await window.docTrack.appUpdates.quitAndInstall();
      },
    });
  }, [appUpdateState, openConfirmationDialog]);

  const saveApplicationSettingsPartial = async (
    nextPartial: Partial<ApplicationSettings>,
  ): Promise<void> => {
    await updateApplicationSettings(
      cloneApplicationSettings({
        ...applicationSettings,
        ...nextPartial,
        keyboardShortcuts: nextPartial.keyboardShortcuts
          ? { ...nextPartial.keyboardShortcuts }
          : { ...applicationSettings.keyboardShortcuts },
      }),
    );
  };

  const clearSelectedDocument = useEffectEvent((): void => {
    if (!activeWorkspacePath) {
      return;
    }

    setSelectedDocument(activeWorkspacePath, undefined);
    setSelectedDocumentDetail(null);
  });

  const activateWorkspaceTab = useEffectEvent((rootPath: string): void => {
    const workspace = openWorkspaces[rootPath];
    if (!workspace) {
      return;
    }

    const shouldOpenDashboard =
      getWorkspaceFilesystemAttentionCounts(workspace).totalAttentionCount > 0;
    const nextView = shouldOpenDashboard
      ? "dashboard"
      : applicationSettings.defaultWorkspaceView;

    startTransition(() => {
      setWorkspaceView(rootPath, nextView);
      setActiveWorkspace(rootPath);
    });
  });

  const openWorkspaceSettingsDialog = () => {
    if (!activeWorkspace) {
      return;
    }

    const roleSettings =
      activeWorkspace.roleSettings ?? createDefaultWorkspaceRoleSettings();

    setWorkspaceSettingsDialog({
      open: true,
      rootPath: activeWorkspace.workspace.rootPath,
      workspaceName: activeWorkspace.workspace.name,
      settings: { ...activeWorkspace.settings },
      originalSettings: { ...activeWorkspace.settings },
      initialAdminUsername: "admin",
      initialAdminDisplayName: "",
      initialAdminPassword: "",
      lifecycle: structuredClone(activeWorkspace.lifecycle),
      originalLifecycle: structuredClone(activeWorkspace.lifecycle),
      statusRemaps: {},
      companyLogoSourceFilePath: null,
      clearCompanyLogo: false,
      roleSettings: cloneWorkspaceRoleSettings(roleSettings),
      roleSettingsDialog: {
        open: false,
        draft: cloneWorkspaceRoleSettings(roleSettings),
        remaps: {},
        isSubmitting: false,
        message: "",
        tone: "warning",
      },
      isSubmitting: false,
      validationErrors: {},
      isAdvancedSettingsOpen: false,
    });
  };

  const openActivityLogDialog = async (): Promise<void> => {
    if (!activeWorkspace) {
      return;
    }

    const workspaceRootPath = activeWorkspace.workspace.rootPath;
    const workspaceName = activeWorkspace.workspace.name;
    setActivityLogDialog({
      open: true,
      workspaceRootPath,
      workspaceName,
      items: activeWorkspace.dashboard.recentActivity,
      isLoading: true,
    });

    try {
      const items =
        await window.docTrack.workspace.listActivity(workspaceRootPath);
      setActivityLogDialog({
        open: true,
        workspaceRootPath,
        workspaceName,
        items,
        isLoading: false,
      });
    } catch (error) {
      notifyError(error, "Unable to load the workspace activity log.");
      setActivityLogDialog(defaultActivityLogDialogState);
    }
  };

  const commandPaletteCommands = useMemo(() => {
    const rootCommands: CommandPaletteCommand[] = [
      {
        id: "global:settings",
        label: "Open Settings",
        subtitle: "Application preferences and keyboard shortcuts",
        group: "Global",
        icon: Settings,
        keywords: ["preferences keyboard shortcuts theme updates"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openApplicationSettingsDialog(),
            "Unable to open the application settings.",
          ),
      },
      {
        id: "global:new-workspace",
        label: "Create Workspace",
        subtitle: "Open the new workspace dialog",
        group: "Global",
        icon: Plus,
        keywords: ["new workspace create folder"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openCreateWorkspaceDialog(),
            "Unable to open the new workspace dialog.",
          ),
      },
      {
        id: "global:open-workspace",
        label: "Open Workspace Folder",
        subtitle: "Choose an existing workspace folder",
        group: "Global",
        icon: FolderOpen,
        keywords: ["open workspace folder picker recent"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openWorkspacePicker(),
            "Unable to open a workspace.",
          ),
      },
    ];

    recentWorkspaces
      .filter((workspace) => !openWorkspaces[workspace.rootPath])
      .forEach((workspace) => {
        rootCommands.push({
          id: `recent:${workspace.rootPath}`,
          label: `Open Recent Workspace: ${workspace.name}`,
          subtitle: workspace.rootPath,
          group: "Recent Workspaces",
          icon: History,
          keywords: [
            workspace.name,
            workspace.rootPath,
            "recent reopen workspace",
          ],
          onSelect: () =>
            runCommandPaletteAction(
              () => openWorkspace(workspace.rootPath),
              "Unable to open workspace.",
            ),
        });
      });

    if (!activeWorkspace || !activeWorkspacePath) {
      return {
        rootCommands,
        documentPickerCommands: [] as CommandPaletteCommand[],
      };
    }

    workspaceTabs
      .filter(
        (workspaceTab) =>
          workspaceTab.workspace.rootPath !==
          activeWorkspace.workspace.rootPath,
      )
      .forEach((workspaceTab) => {
        rootCommands.push({
          id: `workspace:${workspaceTab.workspace.rootPath}`,
          label: `Switch to Workspace: ${workspaceTab.workspace.name}`,
          subtitle: workspaceTab.workspace.rootPath,
          group: "Open Workspaces",
          icon: FolderOpen,
          keywords: [
            workspaceTab.workspace.name,
            workspaceTab.workspace.rootPath,
            "switch workspace tab open",
          ],
          onSelect: () =>
            runCommandPaletteAction(
              () => activateWorkspaceTab(workspaceTab.workspace.rootPath),
              "Unable to switch workspaces.",
            ),
        });
      });

    const workspaceCommands: CommandPaletteCommand[] = [
      {
        id: "workspace:settings",
        label: "Open Workspace Settings",
        subtitle: activeWorkspace.workspace.name,
        group: "Workspace",
        icon: Settings2,
        keywords: ["workspace settings preferences storage logo"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openWorkspaceSettingsDialog(),
            "Unable to open the workspace settings.",
          ),
      },
      {
        id: "workspace:backups",
        label: "Open Backups & Recovery",
        subtitle: activeWorkspace.workspace.name,
        group: "Workspace",
        icon: History,
        keywords: ["backup recovery restore snapshot integrity"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openBackupDialog(),
            "Unable to open backups and recovery.",
          ),
      },
      {
        id: "workspace:activity",
        label: "Show Activity Log",
        subtitle: activeWorkspace.workspace.name,
        group: "Workspace",
        icon: History,
        keywords: ["activity log recent changes history"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openActivityLogDialog(),
            "Unable to open the workspace activity log.",
          ),
      },
      {
        id: "workspace:new-document",
        label: "Create Document",
        subtitle: activeWorkspace.workspace.name,
        group: "Documents",
        icon: FilePlus2,
        keywords: ["new document create record shell"],
        onSelect: () =>
          runCommandPaletteAction(
            () => openCreateDocumentDialog(),
            "Unable to open the new document dialog.",
          ),
      },
      {
        id: "workspace:export-report",
        label: "Export Report",
        subtitle: "Open the export dialog with PDF workspace defaults",
        group: "Documents",
        icon: Download,
        keywords: ["export report pdf csv documents workspace"],
        onSelect: () =>
          runCommandPaletteAction(() => {
            setWorkspaceView(activeWorkspacePath, "documents");
            setDocumentExportDialogRequest({
              workspacePath: activeWorkspacePath,
              format: "pdf",
              scope: "whole-workspace",
              token: Date.now(),
            });
          }, "Unable to open the export dialog."),
      },
    ];
    rootCommands.push(...workspaceCommands);

    if (selectedDocumentSummary) {
      rootCommands.push(
        {
          id: `document:create-version:${selectedDocumentSummary.id}`,
          label: `Create Version for ${selectedDocumentSummary.documentId}`,
          subtitle: selectedDocumentSummary.title,
          group: "Documents",
          icon: FileStack,
          keywords: [
            selectedDocumentSummary.documentId,
            selectedDocumentSummary.title,
            "create version revision bump selected document",
          ],
          onSelect: () =>
            runCommandPaletteAction(
              () => openCreateVersionForDocument(selectedDocumentSummary.id),
              "Unable to open the create version dialog.",
            ),
        },
        {
          id: `document:import-file:${selectedDocumentSummary.id}`,
          label: `Import File into ${selectedDocumentSummary.documentId}`,
          subtitle: selectedDocumentSummary.title,
          group: "Documents",
          icon: Upload,
          keywords: [
            selectedDocumentSummary.documentId,
            selectedDocumentSummary.title,
            "import file upload selected document",
          ],
          onSelect: () =>
            runCommandPaletteAction(
              () => openImportFilesForDocument(selectedDocumentSummary.id),
              "Unable to import files into the selected document.",
            ),
        },
      );
    } else {
      rootCommands.push(
        {
          id: "document:create-version:picker",
          label: "Create Version...",
          subtitle: "Choose a document in the active workspace",
          group: "Documents",
          icon: FileStack,
          keywords: ["create version revision bump choose document"],
          onSelect: () =>
            openCommandPaletteDocumentPicker("pickDocumentForVersion"),
        },
        {
          id: "document:import-file:picker",
          label: "Import File...",
          subtitle: "Choose a document in the active workspace",
          group: "Documents",
          icon: Upload,
          keywords: ["import file upload choose document"],
          onSelect: () =>
            openCommandPaletteDocumentPicker("pickDocumentForImport"),
        },
      );
    }

    const viewCommands: Array<{
      id: string;
      label: string;
      view: WorkspaceView;
      icon: typeof Sparkles;
      enabled: boolean;
      keywords: string[];
    }> = [
      {
        id: "view:dashboard",
        label: "Go to Dashboard",
        view: "dashboard",
        icon: Sparkles,
        enabled: true,
        keywords: ["dashboard overview health activity"],
      },
      {
        id: "view:documents",
        label: "Go to Documents",
        view: "documents",
        icon: FileText,
        enabled: true,
        keywords: ["documents table search"],
      },
      {
        id: "view:groups",
        label: "Go to Groups",
        view: "groups",
        icon: FolderOpen,
        enabled: workspaceSupportsGroups,
        keywords: ["groups"],
      },
      {
        id: "view:templates",
        label: "Go to Templates",
        view: "templates",
        icon: FileStack,
        enabled: true,
        keywords: ["templates"],
      },
      {
        id: "view:document-types",
        label: "Go to Document Types",
        view: "documentTypes",
        icon: LayoutPanelLeft,
        enabled: true,
        keywords: ["document types"],
      },
      {
        id: "view:classifications",
        label: "Go to Classifications",
        view: "classifications",
        icon: Settings2,
        enabled: workspaceSupportsConfidentialityClasses,
        keywords: ["classifications confidentiality classes"],
      },
      {
        id: "view:languages",
        label: "Go to Languages",
        view: "languages",
        icon: Pencil,
        enabled: workspaceSupportsLanguages,
        keywords: ["languages"],
      },
    ];

    viewCommands
      .filter((command) => command.enabled)
      .forEach((command) => {
        rootCommands.push({
          id: command.id,
          label: command.label,
          subtitle: activeWorkspace.workspace.name,
          group: "Views",
          icon: command.icon,
          keywords: command.keywords,
          onSelect: () =>
            runCommandPaletteAction(
              () => setWorkspaceView(activeWorkspacePath, command.view),
              "Unable to change the workspace view.",
            ),
        });
      });

    const documentPickerCommands = activeWorkspace.documents.map(
      (document) => ({
        id: `pick-document:${document.id}`,
        label: document.title,
        subtitle: `${document.documentId} • ${document.typeName} • ${
          document.latestVersionLabel
            ? `Latest version ${document.latestVersionLabel}`
            : "No versions yet"
        }`,
        group: "Documents",
        icon:
          commandPalette.mode === "pickDocumentForImport" ? Upload : FileStack,
        keywords: [
          document.documentId,
          document.title,
          document.typeName,
          document.author,
          document.projectName ?? "",
          document.languageCode ?? "",
          document.status ?? "",
        ],
        searchSortDate: document.modifiedDate,
        onSelect: () =>
          runCommandPaletteAction(
            () =>
              commandPalette.mode === "pickDocumentForImport"
                ? openImportFilesForDocument(document.id)
                : openCreateVersionForDocument(document.id),
            commandPalette.mode === "pickDocumentForImport"
              ? "Unable to import files into the selected document."
              : "Unable to open the create version dialog.",
          ),
      }),
    );

    return {
      rootCommands,
      documentPickerCommands,
    };
  }, [
    activateWorkspaceTab,
    activeWorkspace,
    activeWorkspacePath,
    commandPalette.mode,
    openActivityLogDialog,
    openApplicationSettingsDialog,
    openCommandPaletteDocumentPicker,
    openCreateDocumentDialog,
    openCreateWorkspaceDialog,
    openCreateVersionForDocument,
    openImportFilesForDocument,
    openWorkspace,
    openWorkspacePicker,
    openWorkspaceSettingsDialog,
    openWorkspaces,
    recentWorkspaces,
    runCommandPaletteAction,
    selectedDocumentSummary,
    setWorkspaceView,
    workspaceSupportsConfidentialityClasses,
    workspaceSupportsLanguages,
    workspaceSupportsGroups,
    workspaceTabs,
  ]);

  const commandPaletteMeta = useMemo(() => {
    if (commandPalette.mode === "pickDocumentForVersion") {
      return {
        title: "Choose Document for Create Version",
        description: "Search the active workspace documents and pick one.",
        emptyMessage: activeWorkspace
          ? "No matching documents found in this workspace."
          : "Open a workspace to create a document version.",
      };
    }

    if (commandPalette.mode === "pickDocumentForImport") {
      return {
        title: "Choose Document for Import File",
        description: "Search the active workspace documents and pick one.",
        emptyMessage: activeWorkspace
          ? "No matching documents found in this workspace."
          : "Open a workspace to import files.",
      };
    }

    return {
      title: "Command Palette",
      description: "Search commands, workspaces, and document actions.",
      emptyMessage: "No commands match your search.",
    };
  }, [activeWorkspace, commandPalette.mode]);

  const currentCommandPaletteCommands = useMemo(
    () =>
      commandPalette.mode === "root"
        ? filterCommandPaletteCommands(
            commandPaletteCommands.rootCommands,
            commandPalette.query,
          )
        : filterCommandPaletteCommands(
            commandPaletteCommands.documentPickerCommands,
            commandPalette.query,
            { preferNewestSortDate: true },
          ),
    [commandPalette.mode, commandPalette.query, commandPaletteCommands],
  );
  const handleCommandPaletteSelect = (itemId: string) => {
    const command = currentCommandPaletteCommands.find(
      (candidate) => candidate.id === itemId,
    );
    command?.onSelect();
  };
  const handleCommandPaletteBack = () => {
    setCommandPalette((state) => ({
      ...state,
      mode: "root",
      query: "",
    }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.openCommandPalette,
        )
      ) {
        event.preventDefault();
        if (commandPalette.open) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
        return;
      }

      if (commandPalette.open) {
        return;
      }

      if (
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.openSettings,
        )
      ) {
        event.preventDefault();
        openApplicationSettingsDialog();
        return;
      }

      if (
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.newWorkspace,
        )
      ) {
        event.preventDefault();
        openCreateWorkspaceDialog();
        return;
      }

      if (
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.openWorkspaceFolder,
        )
      ) {
        event.preventDefault();
        void openWorkspacePicker();
        return;
      }

      if (
        activeWorkspace &&
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.newDocument,
        )
      ) {
        event.preventDefault();
        openCreateDocumentDialog();
        return;
      }

      if (
        doesEventMatchShortcut(
          event,
          applicationSettings.keyboardShortcuts.focusSearch,
        )
      ) {
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-doc-search="true"]',
        );
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeWorkspace,
    applicationSettings.keyboardShortcuts,
    closeCommandPalette,
    commandPalette.open,
    openCommandPalette,
  ]);

  const handleCreateWorkspace = async () => {
    const validationErrors = validateWorkspaceDialogState(workspaceDialog);
    if (Object.keys(validationErrors).length > 0) {
      setWorkspaceDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setWorkspaceDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      await createWorkspace({
        name: workspaceDialog.name,
        ...(workspaceDialog.useCustomFolderName
          ? {
              folderName: workspaceDialog.folderName,
            }
          : {}),
        parentPath: workspaceDialog.parentPath,
        settings: workspaceDialog.settings,
        lifecycle: workspaceDialog.lifecycle,
        includeExampleData: workspaceDialog.includeExampleData,
        ...(workspaceDialog.settings.userSystemEnabled
          ? {
              initialAdmin: {
                username: workspaceDialog.initialAdminUsername,
                displayName: workspaceDialog.initialAdminDisplayName,
                password: workspaceDialog.initialAdminPassword,
              },
            }
          : {}),
      });
      setWorkspaceDialog(defaultWorkspaceDialogState);
    } catch (error) {
      notifyError(error, "Unable to create workspace.");
      setWorkspaceDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveWorkspaceSettings = async () => {
    if (!workspaceSettingsDialog.rootPath) {
      return;
    }

    const validationErrors = validateWorkspaceSettingsDialogState(
      workspaceSettingsDialog,
    );
    if (Object.keys(validationErrors).length > 0) {
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      await updateWorkspaceSettings(workspaceSettingsDialog.rootPath, {
        settings: workspaceSettingsDialog.settings,
        lifecycle: workspaceSettingsDialog.lifecycle,
        initialAdmin:
          workspaceSettingsDialog.initialAdminDisplayName.trim() &&
          workspaceSettingsDialog.initialAdminPassword.trim()
            ? {
                username: workspaceSettingsDialog.initialAdminUsername,
                displayName: workspaceSettingsDialog.initialAdminDisplayName,
                password: workspaceSettingsDialog.initialAdminPassword,
              }
            : undefined,
        statusRemaps: Object.entries(workspaceSettingsDialog.statusRemaps)
          .filter(([, toStatusKey]) => toStatusKey.trim().length > 0)
          .map(([fromStatusKey, toStatusKey]) => ({
            fromStatusKey,
            toStatusKey,
          })),
        companyLogoSourceFilePath:
          workspaceSettingsDialog.companyLogoSourceFilePath,
        clearCompanyLogo: workspaceSettingsDialog.clearCompanyLogo,
      } satisfies WorkspaceSettingsUpdateInput);
      setWorkspaceSettingsDialog(defaultWorkspaceSettingsDialogState);
    } catch (error) {
      notifyError(error, "Unable to save workspace settings.");
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        isSubmitting: false,
      }));
    }
  };

  const handleSaveApplicationSettings = async () => {
    try {
      setApplicationSettingsDialog((state) => ({
        ...state,
        isSubmitting: true,
      }));
      await updateApplicationSettings(
        cloneApplicationSettings(applicationSettingsDialog.settings),
      );
      setApplicationSettingsDialog(defaultApplicationSettingsDialogState);
      setNotification({
        tone: "success",
        message: "Application settings saved.",
      });
    } catch (error) {
      notifyError(error, "Unable to save application settings.");
      setApplicationSettingsDialog((state) => ({
        ...state,
        isSubmitting: false,
      }));
    }
  };

  const handleSaveTableColumns = async () => {
    const workspaceAvailableColumns =
      activeWorkspace?.settings.visibleDocumentColumns ??
      DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns;
    const nextVisibleColumns = tableColumnsDialog.visibleColumns.filter(
      (column) => workspaceAvailableColumns.includes(column),
    );
    const validationErrors = validateTableColumnsDialogState({
      ...tableColumnsDialog,
      visibleColumns: nextVisibleColumns,
    });

    if (Object.keys(validationErrors).length > 0) {
      setTableColumnsDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setTableColumnsDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));

      await saveApplicationSettingsPartial({
        documentTableVisibleColumns: nextVisibleColumns,
      });
      setTableColumnsDialog(defaultTableColumnsDialogState);
      setNotification({
        tone: "success",
        message: "Table view settings saved.",
      });
    } catch (error) {
      notifyError(error, "Unable to save table view settings.");
      setTableColumnsDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleExportDocuments = async (request: DocumentExportRequest) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const result = await window.docTrack.documents.export(
        activeWorkspacePath,
        request,
      );
      if (!result.canceled && result.filePath) {
        setNotification({
          tone: "success",
          message: `Export saved to ${result.filePath}`,
        });
      }
    } catch (error) {
      notifyError(error, "Unable to export the documents report.");
      throw error;
    }
  };

  const pinSavedViewToDashboard = async (
    rootPath: string,
    savedView: SavedView,
  ) => {
    const workspace = openWorkspaces[rootPath];
    if (!workspace) {
      return;
    }

    try {
      const promoted =
        savedView.scope === "shared"
          ? { savedView }
          : await promoteSavedViewToShared(rootPath, {
              savedViewId: savedView.id,
            });
      const sharedView = promoted.savedView;
      const currentLayout = normalizeDashboardLayout(workspace.dashboardLayout);
      const alreadyPinned = currentLayout.widgets.some(
        (widget) =>
          widget.type === "savedView" && widget.savedViewId === sharedView.id,
      );
      if (alreadyPinned) {
        setNotification({
          tone: "success",
          message: `"${sharedView.name}" is already pinned to the dashboard.`,
        });
        return;
      }

      const nextY = currentLayout.widgets.reduce(
        (max, widget) => Math.max(max, widget.y + widget.h),
        0,
      );
      await updateDashboardLayout(rootPath, {
        layout: {
          widgets: [
            ...currentLayout.widgets,
            {
              id: createClientId("dashboard-widget"),
              type: "savedView",
              title: sharedView.name,
              x: 0,
              y: nextY,
              w: 6,
              h: 2,
              config: {},
              savedViewId: sharedView.id,
            },
          ],
        },
      });

      setNotification({
        tone: "success",
        message: `"${sharedView.name}" was pinned to the dashboard.`,
      });
    } catch (error) {
      notifyError(error, "Unable to pin the saved view to the dashboard.");
      throw error;
    }
  };

  const handleSaveDocument = async () => {
    if (!activeWorkspacePath || !activeWorkspace) {
      return;
    }

    const validationErrors = validateDocumentDialogState(
      documentDialog,
      activeWorkspace.settings.visibleDocumentColumns,
    );
    if (Object.keys(validationErrors).length > 0) {
      setDocumentDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setDocumentDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      const revisionIntervalMonths = parseOptionalPositiveInteger(
        documentDialog.revisionIntervalMonths,
      );
      const availableColumns = activeWorkspace.settings.visibleDocumentColumns;
      const documentInput = {
        title: documentDialog.title,
        author: documentDialog.author,
        authorUserId: parseOptionalSelectNumber(documentDialog.authorUserId),
        startDate: availableColumns.includes("startDate")
          ? documentDialog.startDate || null
          : null,
        languageId: availableColumns.includes("language")
          ? parseOptionalSelectNumber(documentDialog.languageId)
          : null,
        confidentialityClassId: availableColumns.includes(
          "confidentialityClass",
        )
          ? parseOptionalSelectNumber(documentDialog.confidentialityClassId)
          : null,
        groupId: availableColumns.includes("group")
          ? parseOptionalSelectNumber(documentDialog.groupId)
          : null,
        projectId: availableColumns.includes("project")
          ? parseOptionalSelectNumber(documentDialog.projectId)
          : null,
        company: availableColumns.includes("company")
          ? documentDialog.company
          : "",
        department: availableColumns.includes("department")
          ? documentDialog.department
          : "",
        revisionIntervalMonths: availableColumns.includes(
          "revisionIntervalMonths",
        )
          ? revisionIntervalMonths
          : null,
      };

      const detail =
        documentDialog.mode === "create"
          ? await window.docTrack.documents.create(activeWorkspacePath, {
              ...documentInput,
              documentTypeId: Number(documentDialog.documentTypeId),
              versionScheme: documentDialog.versionScheme,
              templateId: documentDialog.templateId || null,
            } satisfies CreateDocumentInput)
          : await window.docTrack.documents.update(activeWorkspacePath, {
              documentRecordId: documentDialog.documentRecordId!,
              ...documentInput,
            } satisfies UpdateDocumentInput);
      await refreshWorkspace(activeWorkspacePath);
      if (documentDialog.mode === "create") {
        setWorkspaceView(activeWorkspacePath, "documents");
      }
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setDocumentDialog(defaultDocumentDialogState);
      setNotification({
        tone: "success",
        message:
          documentDialog.mode === "create"
            ? `Created ${detail.documentId}.`
            : `Updated ${detail.documentId}.`,
      });
    } catch (error) {
      notifyError(
        error,
        documentDialog.mode === "create"
          ? "Unable to create document."
          : "Unable to update document.",
      );
      setDocumentDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleCreateVersion = async () => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setVersionDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.createVersion(
        activeWorkspacePath,
        {
          documentRecordId: selectedDocumentDetail.id,
          revisionDescription: versionDialog.revisionDescription,
          bumpType: versionDialog.bumpType,
        } satisfies CreateVersionInput,
      );
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setVersionDialog(defaultVersionDialogState);
      setNotification({
        tone: "success",
        message: `Version ${detail.versions[0]?.versionLabel ?? ""} created for ${detail.documentId}.`,
      });
    } catch (error) {
      notifyError(error, "Unable to create document version.");
      setVersionDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveLatestVersion = async () => {
    if (
      !activeWorkspacePath ||
      !selectedDocumentDetail ||
      !latestVersionDialog.versionId
    ) {
      return;
    }

    try {
      setLatestVersionDialog((state) => ({ ...state, isSubmitting: true }));
      const detail =
        latestVersionDialog.mode === "latest"
          ? await window.docTrack.documents.updateLatestVersion(
              activeWorkspacePath,
              {
                documentRecordId: selectedDocumentDetail.id,
                status: latestVersionDialog.status,
                releasedDate: latestVersionDialog.releasedDate || null,
                reviewedBy: latestVersionDialog.reviewedBy,
                reviewedByUserId: parseOptionalSelectNumber(
                  latestVersionDialog.reviewedByUserId,
                ),
                approvedBy: latestVersionDialog.approvedBy,
                approvedByUserId: parseOptionalSelectNumber(
                  latestVersionDialog.approvedByUserId,
                ),
                revisionDescription: latestVersionDialog.revisionDescription,
              } satisfies UpdateLatestVersionInput,
            )
          : await window.docTrack.documents.updateVersion(activeWorkspacePath, {
              documentVersionId: latestVersionDialog.versionId,
              status: latestVersionDialog.status,
              releasedDate: latestVersionDialog.releasedDate || null,
              reviewedBy: latestVersionDialog.reviewedBy,
              reviewedByUserId: parseOptionalSelectNumber(
                latestVersionDialog.reviewedByUserId,
              ),
              approvedBy: latestVersionDialog.approvedBy,
              approvedByUserId: parseOptionalSelectNumber(
                latestVersionDialog.approvedByUserId,
              ),
              revisionDescription: latestVersionDialog.revisionDescription,
            } satisfies UpdateDocumentVersionInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setLatestVersionDialog(defaultLatestVersionDialogState);
      setNotification({
        tone: "success",
        message:
          latestVersionDialog.mode === "latest"
            ? `Updated latest version for ${detail.documentId}.`
            : `Updated version ${latestVersionDialog.versionLabel} for ${detail.documentId}.`,
      });
    } catch (error) {
      notifyError(
        error,
        latestVersionDialog.mode === "latest"
          ? "Unable to update the latest version."
          : "Unable to update the selected version.",
      );
      setLatestVersionDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleRequestStatusChange = (
    document: DocumentListItem,
    nextStatus: DocumentStatus,
  ) => {
    if (
      !activeWorkspace ||
      !activeWorkspacePath ||
      !document.latestVersionLabel ||
      !document.status ||
      document.status === nextStatus
    ) {
      return;
    }

    const nextLifecycleStatus = getWorkspaceStatusByName(
      activeWorkspace.lifecycle,
      nextStatus,
    );
    if (!nextLifecycleStatus) {
      return;
    }
    const allowedTargets = getAllowedLifecycleTransitionTargets(
      activeWorkspace.lifecycle,
      document.status,
    );
    if (
      activeWorkspace.lifecycle.mode === "custom" &&
      !allowedTargets.some((status) => status.name === nextStatus)
    ) {
      return;
    }

    const missingMetadata = getMissingLifecycleMetadata(nextLifecycleStatus, {
      releasedDate: document.releasedDate,
      reviewedBy: document.reviewedBy,
      approvedBy: document.approvedBy,
    });

    if (missingMetadata.length > 0) {
      void (async () => {
        const detail =
          selectedDocumentDetail?.id === document.id
            ? selectedDocumentDetail
            : await loadDocumentDetail(activeWorkspacePath, document.id);
        const latestVersion = detail?.versions[0];
        if (!latestVersion) {
          return;
        }

        openVersionMetadataDialog(latestVersion, "latest", {
          status: nextStatus,
        });
      })().catch((error: Error) => {
        notifyError(error, "Unable to load the latest version details.");
      });
      return;
    }

    setStatusChangeDialog({
      open: true,
      document,
      nextStatus,
      isSubmitting: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!activeWorkspacePath || !statusChangeDialog.document) {
      return;
    }

    const document = statusChangeDialog.document;

    try {
      setStatusChangeDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.updateLatestVersion(
        activeWorkspacePath,
        {
          documentRecordId: document.id,
          status: statusChangeDialog.nextStatus,
          releasedDate: document.releasedDate,
          reviewedBy: document.reviewedBy,
          reviewedByUserId: document.reviewedByUserId,
          approvedBy: document.approvedBy,
          approvedByUserId: document.approvedByUserId,
          revisionDescription: document.revisionDescription,
        } satisfies UpdateLatestVersionInput,
      );
      await refreshWorkspace(activeWorkspacePath);

      if (selectedDocumentDetail?.id === detail.id) {
        setSelectedDocumentDetail(detail);
      }

      setStatusChangeDialog(defaultStatusChangeDialogState);
      setNotification({
        tone: "success",
        message: `Status changed to ${statusChangeDialog.nextStatus} for ${detail.documentId}.`,
      });
    } catch (error) {
      notifyError(error, "Unable to update the document status.");
      setStatusChangeDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveDocumentType = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors = validateTypeDialogState(typeDialog);
    if (Object.keys(validationErrors).length > 0) {
      setTypeDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setTypeDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));

      if (typeDialog.id) {
        await window.docTrack.documentTypes.update(
          activeWorkspacePath,
          typeDialog.id,
          {
            name: typeDialog.name,
            numberPrefix: typeDialog.numberPrefix,
          },
        );
      } else {
        await window.docTrack.documentTypes.create(activeWorkspacePath, {
          name: typeDialog.name,
          numberPrefix: typeDialog.numberPrefix,
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setTypeDialog(defaultTypeDialogState);
    } catch (error) {
      notifyError(error, "Unable to save document type.");
      setTypeDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteDocumentType = async (type: DocumentType) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.documentTypes.delete(activeWorkspacePath, type.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${type.name}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Document Type",
        description: `Delete "${type.name}" from this workspace. Documents already using this type block deletion automatically.`,
        confirmLabel: "Delete Document Type",
        tone: "destructive",
        detailLines: [`Prefix: ${type.numberPrefix}`],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete document type.");
    }
  };

  const handleSaveProject = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const entityLabel =
      projectDialog.entity === "group" ? "Group" : "Project";
    const validationErrors = validateNameDialogState(
      projectDialog.name,
      `${entityLabel} name`,
    );
    if (Object.keys(validationErrors).length > 0) {
      setProjectDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setProjectDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));

      if (projectDialog.entity === "group") {
        if (projectDialog.id) {
          await window.docTrack.groups.update(
            activeWorkspacePath,
            projectDialog.id,
            {
              name: projectDialog.name,
            },
          );
        } else {
          await window.docTrack.groups.create(activeWorkspacePath, {
            name: projectDialog.name,
          });
        }
      } else if (projectDialog.id) {
        await window.docTrack.projects.update(
          activeWorkspacePath,
          projectDialog.id,
          {
            name: projectDialog.name,
          },
        );
      } else {
        await window.docTrack.projects.create(activeWorkspacePath, {
          name: projectDialog.name,
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setProjectDialog(defaultProjectDialogState);
    } catch (error) {
      notifyError(error, `Unable to save ${entityLabel.toLowerCase()}.`);
      setProjectDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.groups.delete(activeWorkspacePath, group.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${group.name}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Group",
        description: `Delete "${group.name}" from this workspace. Documents already linked to it must be reassigned first.`,
        confirmLabel: "Delete Group",
        tone: "destructive",
        detailLines: [],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete group.");
    }
  };

  const handleDeleteProjectDefinition = async (project: Project) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.projects.delete(activeWorkspacePath, project.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${project.name}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Project",
        description: `Delete "${project.name}" from this workspace. Documents already linked to it must be reassigned first.`,
        confirmLabel: "Delete Project",
        tone: "destructive",
        detailLines: [],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete project.");
    }
  };

  const handleSaveTemplate = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors = validateNameDialogState(
      templateDialog.name,
      "Template name",
    );
    if (Object.keys(validationErrors).length > 0) {
      setTemplateDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setTemplateDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      await window.docTrack.templates.create(activeWorkspacePath, {
        name: templateDialog.name,
      });
      await refreshWorkspace(activeWorkspacePath);
      setTemplateDialog(defaultTemplateDialogState);
      setNotification({
        tone: "success",
        message: `Template "${templateDialog.name.trim()}" added to this workspace.`,
      });
    } catch (error) {
      notifyError(error, "Unable to create template.");
      setTemplateDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleAddFilesToTemplate = async () => {
    if (!activeWorkspacePath || !templateFilesDialog.templateId) {
      return;
    }

    const validationErrors =
      validateTemplateFilesDialogState(templateFilesDialog);
    if (Object.keys(validationErrors).length > 0) {
      setTemplateFilesDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setTemplateFilesDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      const sourceFilePaths = [...templateFilesDialog.pendingSourceFilePaths];
      await window.docTrack.templates.addFiles(activeWorkspacePath, {
        templateId: templateFilesDialog.templateId,
        sourceFilePaths,
      });
      await refreshWorkspace(activeWorkspacePath);
      setTemplateFilesDialog(defaultTemplateFilesDialogState);
      setNotification({
        tone: "success",
        message: `Added ${sourceFilePaths.length} file${sourceFilePaths.length === 1 ? "" : "s"} to "${templateFilesDialog.templateName}".`,
      });
    } catch (error) {
      notifyError(error, "Unable to add files to the selected template.");
      setTemplateFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handlePickTemplateFiles = async () => {
    try {
      const pickedPaths = await window.docTrack.dialogs.pickDocumentFiles();
      if (pickedPaths.length === 0) {
        return;
      }

      setTemplateFilesDialog((state) =>
        applyInputChange(state, "pendingSourceFilePaths", {
          pendingSourceFilePaths: mergeUniqueFilePaths(
            state.pendingSourceFilePaths,
            pickedPaths,
          ),
        }),
      );
    } catch (error) {
      notifyError(error, "Unable to choose template files.");
    }
  };

  const stageDroppedTemplateFiles = async (files: FileList | File[]) => {
    try {
      const droppedPaths = await resolveDroppedFilePaths(files);
      if (droppedPaths.length === 0) {
        return;
      }

      setTemplateFilesDialog((state) =>
        applyInputChange(state, "pendingSourceFilePaths", {
          pendingSourceFilePaths: mergeUniqueFilePaths(
            state.pendingSourceFilePaths,
            droppedPaths,
          ),
          isDragActive: false,
        }),
      );
    } catch (error) {
      setTemplateFilesDialog((state) => ({ ...state, isDragActive: false }));
      notifyError(error, "Unable to add dropped template files.");
    }
  };

  const handleRemoveTemplateStagedFile = (filePath: string) => {
    setTemplateFilesDialog((state) =>
      applyInputChange(state, "pendingSourceFilePaths", {
        pendingSourceFilePaths: state.pendingSourceFilePaths.filter(
          (entry) => entry !== filePath,
        ),
      }),
    );
  };

  const handleClearTemplateStagedFiles = () => {
    setTemplateFilesDialog((state) =>
      applyInputChange(state, "pendingSourceFilePaths", {
        pendingSourceFilePaths: [],
      }),
    );
  };

  const handleDeleteTemplate = async (template: TemplateSummary) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.templates.delete(activeWorkspacePath, template.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${template.name}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Template",
        description: `Delete "${template.name}" from this workspace. This removes its template files from the Templates folder.`,
        confirmLabel: "Delete Template",
        tone: "destructive",
        detailLines: [
          `${template.fileCount} file${template.fileCount === 1 ? "" : "s"}`,
        ],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete template.");
    }
  };

  const handleSaveConfidentialityClass = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors = validateNameDialogState(
      classificationDialog.name,
      "Class name",
    );
    if (Object.keys(validationErrors).length > 0) {
      setClassificationDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setClassificationDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));

      if (classificationDialog.id) {
        await window.docTrack.confidentialityClasses.update(
          activeWorkspacePath,
          classificationDialog.id,
          {
            name: classificationDialog.name,
          },
        );
      } else {
        await window.docTrack.confidentialityClasses.create(
          activeWorkspacePath,
          {
            name: classificationDialog.name,
          },
        );
      }

      await refreshWorkspace(activeWorkspacePath);
      setClassificationDialog(defaultClassificationDialogState);
    } catch (error) {
      notifyError(error, "Unable to save confidentiality class.");
      setClassificationDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteConfidentialityClass = async (
    item: ConfidentialityClass,
  ) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.confidentialityClasses.delete(
        activeWorkspacePath,
        item.id,
      );
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${item.name}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Confidentiality Class",
        description: `Delete "${item.name}" from this workspace. Existing document references prevent accidental removal.`,
        confirmLabel: "Delete Class",
        tone: "destructive",
        detailLines: [],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete confidentiality class.");
    }
  };

  const handleSaveLanguage = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors = validateLanguageDialogState(languageDialog);
    if (Object.keys(validationErrors).length > 0) {
      setLanguageDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    try {
      setLanguageDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));

      if (languageDialog.id) {
        await window.docTrack.languages.update(
          activeWorkspacePath,
          languageDialog.id,
          {
            code: languageDialog.code,
          },
        );
      } else {
        await window.docTrack.languages.create(activeWorkspacePath, {
          code: languageDialog.code,
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setLanguageDialog(defaultLanguageDialogState);
    } catch (error) {
      notifyError(error, "Unable to save language.");
      setLanguageDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteLanguage = async (item: WorkspaceLanguage) => {
    if (!activeWorkspacePath) {
      return;
    }

    const performDelete = async () => {
      await window.docTrack.languages.delete(activeWorkspacePath, item.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: `"${item.code}" removed from this workspace.`,
      });
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Language",
        description: `Delete "${item.code}" from this workspace. Linked documents must be updated first.`,
        confirmLabel: "Delete Language",
        tone: "destructive",
        detailLines: [],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete language.");
    }
  };

  const handleAssignGroupToDocument = async (
    document: DocumentListItem,
    nextGroupId: string,
  ) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail = await window.docTrack.documents.update(
        activeWorkspacePath,
        {
          ...toDocumentUpdateInput(document),
          groupId: parseOptionalSelectNumber(nextGroupId),
        },
      );
      await refreshWorkspace(activeWorkspacePath);
      if (selectedDocumentDetail?.id === detail.id) {
        setSelectedDocumentDetail(detail);
      }
    } catch (error) {
      notifyError(error, "Unable to assign the document to a group.");
    }
  };

  const openFilesDialogForDetail = (
    detail: DocumentDetail,
    options?: {
      preferredVersionId?: number;
      preferAffectedVersion?: boolean;
    },
  ) => {
    const affectedVersions = detail.versions.filter((version) =>
      versionNeedsFilesystemReview(version),
    );
    const selectedVersion =
      detail.versions.find(
        (version) => version.id === options?.preferredVersionId,
      ) ??
      (options?.preferAffectedVersion ? affectedVersions[0] : undefined) ??
      detail.versions[0];

    if (!selectedVersion) {
      setNotification({
        tone: "error",
        message: "Create a version before showing version files.",
      });
      return;
    }

    setSelectedDocument(activeWorkspacePath!, detail.id);
    setSelectedDocumentDetail(detail);
    setFilesDialogVersion(selectedVersion);
    setFilesDialog({
      open: true,
      versionId: selectedVersion.id,
      reviewVersionIds: affectedVersions.map((version) => version.id),
      addRole: "working",
      pendingSourceFilePaths: [],
      pendingDuplicateWarnings: [],
      isSubmitting: false,
      submitLabel: "",
    });
  };

  const handleShowFilesForDocument = async (
    documentRecordId: number,
    options?: { preferAffectedVersion?: boolean },
  ) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail =
        selectedDocumentDetail?.id === documentRecordId
          ? selectedDocumentDetail
          : await fetchDocumentDetail(activeWorkspacePath, documentRecordId);
      if (!detail) {
        return;
      }

      openFilesDialogForDetail(detail, {
        preferAffectedVersion: options?.preferAffectedVersion,
      });
    } catch (error) {
      notifyError(error, "Unable to load version files.");
    }
  };

  const handleRefreshVersionFiles = async (documentVersionId: number) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: true,
        submitLabel: "Refreshing disk preview...",
      }));
      await window.docTrack.documents.getVersionFilesystemPreview(
        activeWorkspacePath,
        documentVersionId,
      );
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
    } catch (error) {
      notifyError(error, "Unable to refresh version files.");
    } finally {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: false,
        submitLabel: "",
      }));
    }
  };

  const stageFilesForVersion = async (
    documentVersionId: number,
    sourceFilePaths: string[],
  ) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (sourceFilePaths.length === 0) {
      return;
    }

    try {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: true,
        submitLabel: "Checking selected files...",
      }));
      const importPlan = await window.docTrack.documents.planVersionFileImport(
        activeWorkspacePath,
        documentVersionId,
        sourceFilePaths,
      );

      setFilesDialog((state) => ({
        ...state,
        versionId: documentVersionId,
        addRole:
          importPlan.candidates.length > 0
            ? importPlan.suggestedRole
            : state.addRole,
        pendingSourceFilePaths: sourceFilePaths,
        pendingDuplicateWarnings: importPlan.warnings,
        submitLabel: "",
      }));
    } catch (error) {
      notifyError(error, "Unable to stage files for upload.");
    } finally {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: false,
        submitLabel: "",
      }));
    }
  };

  const handleAddFilesToVersion = async (documentVersionId: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    const sourceFilePaths = await window.docTrack.dialogs.pickDocumentFiles();
    if (sourceFilePaths.length === 0) {
      return;
    }

    await stageFilesForVersion(documentVersionId, sourceFilePaths);
  };

  const handleUploadStagedFiles = async (documentVersionId: number) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    if (filesDialog.pendingSourceFilePaths.length === 0) {
      return;
    }

    if (filesDialog.pendingDuplicateWarnings.length > 0) {
      setNotification({
        tone: "error",
        message:
          filesDialog.pendingDuplicateWarnings[0] ??
          "Resolve the staged file warnings before uploading.",
      });
      return;
    }

    try {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: true,
        submitLabel: "Uploading files...",
      }));
      await window.docTrack.documents.addVersionFiles(activeWorkspacePath, {
        documentVersionId,
        role: filesDialog.addRole,
        sourceFilePaths: filesDialog.pendingSourceFilePaths,
      });
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
      setFilesDialog((state) => ({
        ...state,
        versionId: documentVersionId,
        pendingSourceFilePaths: [],
        pendingDuplicateWarnings: [],
        submitLabel: "",
      }));
      setNotification({
        tone: "success",
        message: "Files uploaded successfully.",
      });
    } catch (error) {
      notifyError(error, "Unable to upload the selected files.");
    } finally {
      setFilesDialog((state) => ({
        ...state,
        isSubmitting: false,
        submitLabel: "",
      }));
    }
  };

  const handleRenameVersionFile = async (file: DocumentVersionFile) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    setRenameFileDialog({
      open: true,
      file,
      nextFileName: file.fileName,
      isSubmitting: false,
      validationErrors: {},
    });
  };

  const handleConfirmRenameVersionFile = async () => {
    if (
      !activeWorkspacePath ||
      !selectedDocumentDetail ||
      !renameFileDialog.file
    ) {
      return;
    }

    const nextFileName = renameFileDialog.nextFileName.trim();
    const validationErrors = validateRenameFileDialogState(renameFileDialog);
    if (Object.keys(validationErrors).length > 0) {
      setRenameFileDialog((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors,
      }));
      return;
    }

    if (nextFileName === renameFileDialog.file.fileName) {
      setRenameFileDialog(defaultRenameFileDialogState);
      return;
    }

    try {
      setRenameFileDialog((state) => ({
        ...state,
        isSubmitting: true,
        validationErrors: {},
      }));
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.renameVersionFile(activeWorkspacePath, {
        fileId: renameFileDialog.file.id,
        nextFileName,
      });
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
      setRenameFileDialog(defaultRenameFileDialogState);
    } catch (error) {
      notifyError(error, "Unable to rename the selected file.");
      setRenameFileDialog((state) => ({ ...state, isSubmitting: false }));
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteVersionFile = async (file: DocumentVersionFile) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    const performDelete = async () => {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      try {
        await window.docTrack.documents.deleteVersionFile(activeWorkspacePath, {
          fileId: file.id,
        });
        await refreshSelectedDocument(
          activeWorkspacePath,
          selectedDocumentDetail.id,
        );
      } finally {
        setFilesDialog((state) => ({ ...state, isSubmitting: false }));
      }
    };

    if (applicationSettings.confirmDestructiveActions) {
      openConfirmationDialog({
        title: "Delete Managed File",
        description: `Delete "${file.fileName}" from this version. The managed file on disk will be removed too.`,
        confirmLabel: "Delete File",
        tone: "destructive",
        detailLines: [file.filePath],
        onConfirm: performDelete,
      });
      return;
    }

    try {
      await performDelete();
    } catch (error) {
      notifyError(error, "Unable to delete the selected file.");
    }
  };

  const handleChangeVersionFileRole = async (
    file: DocumentVersionFile,
    role: DocumentVersionFileRole,
  ) => {
    if (!activeWorkspacePath || !selectedDocumentDetail || role === file.role) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.changeVersionFileRole(
        activeWorkspacePath,
        {
          fileId: file.id,
          role,
        },
      );
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
    } catch (error) {
      notifyError(error, "Unable to change the selected file role.");
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handlePreviewVersionFile = async (fileId: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setFilePreviewDialog({
        open: true,
        preview: null,
        isLoading: true,
      });
      const preview = await window.docTrack.documents.previewVersionFile(
        activeWorkspacePath,
        fileId,
      );
      setFilePreviewDialog({
        open: true,
        preview,
        isLoading: false,
      });
    } catch (error) {
      setFilePreviewDialog(defaultFilePreviewDialogState);
      notifyError(error, "Unable to load the file preview.");
    }
  };

  const handleCompareVersion = async (documentVersionId: number) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    const currentIndex = selectedDocumentDetail.versions.findIndex(
      (version) => version.id === documentVersionId,
    );
    const previousVersion =
      currentIndex >= 0
        ? selectedDocumentDetail.versions[currentIndex + 1]
        : undefined;

    if (!previousVersion) {
      setNotification({
        tone: "error",
        message:
          "This version does not have an adjacent older version to compare.",
      });
      return;
    }

    try {
      setVersionComparisonDialog({
        open: true,
        result: null,
        isLoading: true,
      });
      const result = await window.docTrack.documents.compareVersions(
        activeWorkspacePath,
        documentVersionId,
        previousVersion.id,
      );
      setVersionComparisonDialog({
        open: true,
        result,
        isLoading: false,
      });
    } catch (error) {
      setVersionComparisonDialog(defaultVersionComparisonDialogState);
      notifyError(error, "Unable to compare the selected versions.");
    }
  };

  const refreshBackupDialog = async (rootPath: string) => {
    setBackupDialog((state) => ({ ...state, isLoading: true }));
    try {
      const [backups, integrityCheck] = await Promise.all([
        window.docTrack.workspace.listBackups(rootPath),
        window.docTrack.workspace.integrityCheck(rootPath),
      ]);
      setBackupDialog((state) => ({
        ...state,
        open: true,
        backups,
        integrityCheck,
        selectedBackupId: state.selectedBackupId || backups[0]?.id || "",
        restoreDiff: null,
        isLoading: false,
        isSubmitting: false,
      }));
    } catch (error) {
      setBackupDialog(defaultBackupDialogState);
      notifyError(error, "Unable to load backup and integrity information.");
    }
  };

  const openBackupDialog = () => {
    if (!activeWorkspacePath) {
      return;
    }

    void refreshBackupDialog(activeWorkspacePath);
  };

  const openWorkspaceUsersDialog = (options?: {
    selectedUserId?: number;
    showArchivedUsers?: boolean;
  }) => {
    if (!activeWorkspacePath) {
      return;
    }

    setWorkspaceUsersDialog((state) => ({
      ...state,
      open: true,
      isLoading: true,
      isSubmitting: false,
      showArchivedUsers: options?.showArchivedUsers ?? state.showArchivedUsers,
      validationErrors: {},
    }));
    void Promise.all([
      window.docTrack.workspace.listUsers(activeWorkspacePath),
      window.docTrack.workspace.listRoles(activeWorkspacePath),
    ])
      .then(([users, roleSettings]) => {
        const normalizedUsers = users.map((user) => ({
          ...user,
          roleName:
            roleSettings.roles.find((role) => role.key === user.role)?.name ??
            user.roleName ??
            user.role,
        }));
        const initialSelectedUser =
          normalizedUsers.find((user) => user.id === options?.selectedUserId) ??
          normalizedUsers.find((user) => user.id === activeWorkspaceSession?.user.id) ??
          normalizedUsers.find((user) => !user.archived) ??
          normalizedUsers[0];
        const defaultRoleKey =
          roleSettings.roles[0]?.key ?? BUILT_IN_WORKSPACE_ROLE_KEYS[2];

        setWorkspaceUsersDialog((state) => ({
          ...state,
          open: true,
          users: normalizedUsers,
          roleSettings,
          showArchivedUsers:
            options?.showArchivedUsers ?? state.showArchivedUsers,
          isLoading: false,
          isSubmitting: false,
          selectedUserId: initialSelectedUser?.id,
          username: initialSelectedUser?.username ?? "",
          displayName: initialSelectedUser?.displayName ?? "",
          role: initialSelectedUser?.role ?? defaultRoleKey,
          password: "",
          formMessage: "",
          formTone: "warning",
          validationErrors: {},
        }));
      })
      .catch((error: Error) => {
        notifyError(error, "Unable to load workspace users.");
        setWorkspaceUsersDialog(defaultWorkspaceUsersDialogState);
      });
  };

  const handleSelectWorkspaceUser = (userId: number) => {
    const selectedUser =
      workspaceUsersDialog.users.find((user) => user.id === userId) ?? null;
    setWorkspaceUsersDialog((state) => ({
      ...state,
      selectedUserId: selectedUser?.id,
      username: selectedUser?.username ?? "",
      displayName: selectedUser?.displayName ?? "",
      role:
        selectedUser?.role ??
        state.roleSettings.roles[0]?.key ??
        BUILT_IN_WORKSPACE_ROLE_KEYS[2],
      password: "",
      formMessage: "",
      formTone: "warning",
      validationErrors: {},
    }));
  };

  const handleSaveWorkspaceUser = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors: ValidationErrors = {};
    if (!workspaceUsersDialog.username.trim()) {
      validationErrors.username = "Username is required.";
    }
    if (!workspaceUsersDialog.displayName.trim()) {
      validationErrors.displayName = "Display name is required.";
    }
    if (
      !workspaceUsersDialog.selectedUserId &&
      !workspaceUsersDialog.password.trim()
    ) {
      validationErrors.password = "Password or PIN is required.";
    }
    if (Object.keys(validationErrors).length > 0) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        formMessage: "Fix the highlighted fields before saving.",
        formTone: "warning",
        validationErrors,
      }));
      return;
    }

    try {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: true,
        formMessage: "",
        validationErrors: {},
      }));

      if (workspaceUsersDialog.selectedUserId) {
        await window.docTrack.workspace.updateUser(
          activeWorkspacePath,
          workspaceUsersDialog.selectedUserId,
          {
            username: workspaceUsersDialog.username,
            displayName: workspaceUsersDialog.displayName,
            role: workspaceUsersDialog.role,
          } satisfies WorkspaceUserUpdateInput,
        );
      } else {
        await window.docTrack.workspace.createUser(activeWorkspacePath, {
          username: workspaceUsersDialog.username,
          displayName: workspaceUsersDialog.displayName,
          password: workspaceUsersDialog.password,
          role: workspaceUsersDialog.role,
        } satisfies WorkspaceUserCreateInput);
      }

      await refreshWorkspace(activeWorkspacePath);
      openWorkspaceUsersDialog();
    } catch (error) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: false,
        formMessage: getErrorMessage(
          error,
          "Unable to save the workspace user.",
        ),
        formTone: "error",
      }));
    }
  };

  const handleToggleWorkspaceUserAccess = async (user: WorkspaceUser) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (activeWorkspaceSession?.user.id === user.id && user.signInEnabled) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        formMessage:
          "You cannot deactivate the account that is currently signed in.",
        formTone: "warning",
      }));
      return;
    }

    try {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: true,
        formMessage: "",
      }));
      if (user.signInEnabled) {
        await window.docTrack.workspace.deactivateUser(
          activeWorkspacePath,
          user.id,
        );
      } else {
        await window.docTrack.workspace.activateUser(
          activeWorkspacePath,
          user.id,
        );
      }
      await refreshWorkspace(activeWorkspacePath);
      openWorkspaceUsersDialog();
    } catch (error) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: false,
        formMessage: getErrorMessage(
          error,
          "Unable to update the selected user.",
        ),
        formTone: "error",
      }));
    }
  };

  const handleDeleteWorkspaceUser = (user: WorkspaceUser) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (activeWorkspaceSession?.user.id === user.id) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        formMessage:
          "You cannot delete the account that is currently signed in.",
        formTone: "warning",
      }));
      return;
    }

    const willDeletePermanently = user.linkedRecordCount === 0;
    openConfirmationDialog({
      title: willDeletePermanently
        ? "Delete Workspace User"
        : "Archive Workspace User",
      description: willDeletePermanently
        ? `Permanently remove ${user.displayName} from this workspace?`
        : `${user.displayName} is linked to existing records, so this action will archive the account instead of deleting it.`,
      confirmLabel: willDeletePermanently ? "Delete User" : "Archive User",
      tone: "destructive",
      detailLines: willDeletePermanently
        ? [
            `Display Name: ${user.displayName}`,
            `Username: @${user.username}`,
            "Linked records: none",
          ]
        : [
            `Display Name: ${user.displayName}`,
            `Username: @${user.username}`,
            `Linked records: ${user.linkedRecordCount}`,
          ],
      onConfirm: async () => {
        const result = await window.docTrack.workspace.deleteUser(
          activeWorkspacePath,
          user.id,
        );
        await refreshWorkspace(activeWorkspacePath);
        openWorkspaceUsersDialog({
          selectedUserId: result.user?.id,
          showArchivedUsers:
            result.action === "archived"
              ? true
              : workspaceUsersDialog.showArchivedUsers,
        });
        setNotification({
          tone: "success",
          message:
            result.action === "deleted"
              ? `${user.displayName} was deleted.`
              : `${user.displayName} was archived.`,
        });
      },
    });
  };

  const handleUnarchiveWorkspaceUser = async (user: WorkspaceUser) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: true,
        formMessage: "",
      }));
      const restoredUser = await window.docTrack.workspace.unarchiveUser(
        activeWorkspacePath,
        user.id,
      );
      await refreshWorkspace(activeWorkspacePath);
      openWorkspaceUsersDialog({
        selectedUserId: restoredUser.id,
        showArchivedUsers: workspaceUsersDialog.showArchivedUsers,
      });
      setNotification({
        tone: "success",
        message: `${user.displayName} was restored from the archive.`,
      });
    } catch (error) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: false,
        formMessage: getErrorMessage(
          error,
          "Unable to restore the selected user.",
        ),
        formTone: "error",
      }));
    }
  };

  const handleResetWorkspaceUserPassword = async () => {
    if (!activeWorkspacePath || !workspaceUsersDialog.selectedUserId) {
      return;
    }

    if (!workspaceUsersDialog.password.trim()) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        formMessage:
          "Enter a new password or PIN before resetting this account.",
        formTone: "warning",
        validationErrors: {
          ...state.validationErrors,
          password: "Enter a password or PIN to reset.",
        },
      }));
      return;
    }

    try {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: true,
        formMessage: "",
        validationErrors: {},
      }));
      await window.docTrack.workspace.resetUserPassword(activeWorkspacePath, {
        userId: workspaceUsersDialog.selectedUserId,
        password: workspaceUsersDialog.password,
      });
      await refreshWorkspace(activeWorkspacePath);
      openWorkspaceUsersDialog();
    } catch (error) {
      setWorkspaceUsersDialog((state) => ({
        ...state,
        isSubmitting: false,
        formMessage: getErrorMessage(
          error,
          "Unable to reset the selected user's password.",
        ),
        formTone: "error",
      }));
    }
  };

  const openWorkspaceRoleSettingsDialog = (
    mode?: WorkspaceRoleMode,
  ): void => {
    setWorkspaceSettingsDialog((state) => {
      const draft =
        mode === "default"
          ? createDefaultWorkspaceRoleSettings("default")
          : mode === "custom"
            ? state.roleSettings.mode === "custom"
              ? cloneWorkspaceRoleSettings(state.roleSettings)
              : createDefaultWorkspaceRoleSettings("custom")
            : cloneWorkspaceRoleSettings(state.roleSettings);

      return {
        ...state,
        roleSettingsDialog: {
          open: true,
          draft,
          remaps: {},
          isSubmitting: false,
          message: "",
          tone: "warning",
        },
      };
    });
  };

  const handleSaveWorkspaceRoleSettings = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const draft = workspaceSettingsDialog.roleSettingsDialog.draft;
    const assignedCustomRoles = getAssignedCustomWorkspaceRoles(
      activeWorkspace?.users ?? [],
      workspaceSettingsDialog.roleSettings,
    );
    let input: WorkspaceRoleSettingsUpdateInput;

    if (draft.mode === "custom") {
      const trimmedNames = draft.roles.map((role) => role.name.trim());
      const normalizedNames = trimmedNames.map((name) =>
        name.toLocaleLowerCase(),
      );
      if (draft.roles.length === 0) {
        setWorkspaceSettingsDialog((state) => ({
          ...state,
          roleSettingsDialog: {
            ...state.roleSettingsDialog,
            message: "At least one custom role must remain.",
            tone: "warning",
          },
        }));
        return;
      }
      if (trimmedNames.some((name) => name.length === 0)) {
        setWorkspaceSettingsDialog((state) => ({
          ...state,
          roleSettingsDialog: {
            ...state.roleSettingsDialog,
            message: "Every role needs a name before saving.",
            tone: "warning",
          },
        }));
        return;
      }
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        setWorkspaceSettingsDialog((state) => ({
          ...state,
          roleSettingsDialog: {
            ...state.roleSettingsDialog,
            message: "Role names must be unique.",
            tone: "warning",
          },
        }));
        return;
      }
      if (
        !draft.roles.some(
          (role) =>
            role.permissions.canManageUsers &&
            role.permissions.canManageRoles,
        )
      ) {
        setWorkspaceSettingsDialog((state) => ({
          ...state,
          roleSettingsDialog: {
            ...state.roleSettingsDialog,
            message:
              "At least one custom role must be able to manage users and roles.",
            tone: "warning",
          },
        }));
        return;
      }

      input = {
        mode: "custom",
        roles: resequenceWorkspaceRoles(
          draft.roles.map((role) => ({
            ...role,
            name: role.name.trim(),
          })),
        ),
      };
    } else {
      const assignedCustomRoleKeys = assignedCustomRoles.map(([roleKey]) => roleKey);
      const missingRemap = assignedCustomRoleKeys.find(
        (roleKey) => !workspaceSettingsDialog.roleSettingsDialog.remaps[roleKey],
      );
      if (missingRemap) {
        setWorkspaceSettingsDialog((state) => ({
          ...state,
          roleSettingsDialog: {
            ...state.roleSettingsDialog,
            message:
              "Choose a built-in replacement for every assigned custom role before saving.",
            tone: "warning",
          },
        }));
        return;
      }

      input = {
        mode: "default",
        roleRemaps: assignedCustomRoleKeys.map((roleKey) => ({
          fromRoleKey: roleKey,
          toRoleKey: workspaceSettingsDialog.roleSettingsDialog.remaps[roleKey],
        })),
      };
    }

    try {
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        roleSettingsDialog: {
          ...state.roleSettingsDialog,
          isSubmitting: true,
          message: "",
        },
      }));
      const nextRoleSettings = await window.docTrack.workspace.saveRoleSettings(
        activeWorkspacePath,
        input,
      );
      await refreshWorkspace(activeWorkspacePath);
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        roleSettings: nextRoleSettings,
        roleSettingsDialog: {
          open: false,
          draft: cloneWorkspaceRoleSettings(nextRoleSettings),
          remaps: {},
          isSubmitting: false,
          message: "",
          tone: "warning",
        },
      }));
      setNotification({
        tone: "success",
        message: "Workspace role settings were updated.",
      });
    } catch (error) {
      setWorkspaceSettingsDialog((state) => ({
        ...state,
        roleSettingsDialog: {
          ...state.roleSettingsDialog,
          isSubmitting: false,
          message: getErrorMessage(
            error,
            "Unable to save the workspace role settings.",
          ),
          tone: "error",
        },
      }));
    }
  };

  const handleRecoverWorkspaceAccess = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    const validationErrors: ValidationErrors = {};
    if (!accessRecoveryState.username.trim()) {
      validationErrors.username = "Username is required.";
    }
    if (!accessRecoveryState.displayName.trim()) {
      validationErrors.displayName = "Display name is required.";
    }
    if (!accessRecoveryState.password.trim()) {
      validationErrors.password = "Password or PIN is required.";
    }
    if (Object.keys(validationErrors).length > 0) {
      setAccessRecoveryState((current) => ({
        ...current,
        error: "Complete all required recovery fields before continuing.",
        validationErrors,
      }));
      return;
    }

    try {
      setAccessRecoveryState((current) => ({
        ...current,
        isSubmitting: true,
        error: "",
        validationErrors: {},
      }));
      await recoverWorkspaceAccess(activeWorkspacePath, {
        username: accessRecoveryState.username,
        displayName: accessRecoveryState.displayName,
        password: accessRecoveryState.password,
      } satisfies WorkspaceAccessRecoveryInput);
      setAccessRecoveryState(defaultAccessRecoveryState);
    } catch (error) {
      setAccessRecoveryState((current) => ({
        ...current,
        isSubmitting: false,
        error: getErrorMessage(error, "Unable to recover workspace access."),
      }));
    }
  };

  const handleCreateBackup = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.workspace.createBackup(activeWorkspacePath);
      await refreshBackupDialog(activeWorkspacePath);
      setNotification({
        tone: "success",
        message: "Workspace snapshot created.",
      });
    } catch (error) {
      notifyError(error, "Unable to create a workspace snapshot.");
      setBackupDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handlePreviewRestore = async (backupId: string) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      const restoreDiff = await window.docTrack.workspace.getRestoreDiff(
        activeWorkspacePath,
        backupId,
      );
      setBackupDialog((state) => ({
        ...state,
        selectedBackupId: backupId,
        restoreDiff,
        isSubmitting: false,
      }));
    } catch (error) {
      setBackupDialog((state) => ({ ...state, isSubmitting: false }));
      notifyError(error, "Unable to build the restore diff preview.");
    }
  };

  const handleOverwriteBackup = async () => {
    if (!activeWorkspacePath || !backupDialog.selectedBackupId) {
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.workspace.restoreBackup(activeWorkspacePath, {
        backupId: backupDialog.selectedBackupId,
        mode: "overwrite-current-database",
      });
      await refreshWorkspace(activeWorkspacePath);
      setBackupDialog(defaultBackupDialogState);
      setNotification({
        tone: "success",
        message:
          "Live workspace database overwritten from the selected snapshot.",
      });
    } catch (error) {
      setBackupDialog((state) => ({ ...state, isSubmitting: false }));
      notifyError(error, "Unable to overwrite the live workspace database.");
    }
  };

  const handleExportBackup = async () => {
    if (!activeWorkspacePath || !backupDialog.selectedBackupId) {
      return;
    }

    const suggestedWorkspaceName = `${
      backupDialog.restoreDiff?.backup.workspaceName ??
      activeWorkspace?.workspace.name ??
      "Workspace"
    } Restored`;
    const destinationParentPath =
      await window.docTrack.dialogs.pickWorkspaceCreatePath(
        suggestedWorkspaceName,
      );
    if (!destinationParentPath) {
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      const restored = await window.docTrack.workspace.restoreBackup(
        activeWorkspacePath,
        {
          backupId: backupDialog.selectedBackupId,
          mode: "export-to-new-workspace",
          destinationParentPath,
          destinationFolderName: suggestedWorkspaceName,
        },
      );
      setBackupDialog(defaultBackupDialogState);
      await openWorkspace(restored.workspace.rootPath);
      setNotification({
        tone: "success",
        message: `Snapshot restored to "${restored.workspace.name}".`,
      });
    } catch (error) {
      setBackupDialog((state) => ({ ...state, isSubmitting: false }));
      notifyError(error, "Unable to restore the selected backup.");
    }
  };

  const handleIgnoreUnmanagedPath = async (
    documentVersionId: number,
    relativePath: string,
  ) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.ignoreUnmanagedPath(
        activeWorkspacePath,
        documentVersionId,
        relativePath,
      );
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
    } catch (error) {
      notifyError(error, "Unable to ignore this unmanaged path.");
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleReconcileUnmanagedPath = async (
    documentVersionId: number,
    relativePath: string,
  ) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.reconcileUnmanagedPath(
        activeWorkspacePath,
        documentVersionId,
        relativePath,
      );
      await refreshSelectedDocument(
        activeWorkspacePath,
        selectedDocumentDetail.id,
      );
    } catch (error) {
      notifyError(error, "Unable to reconcile this unmanaged path.");
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleApplyFilesystemChange = async (
    documentVersionId: number,
    changeIndex: number,
    change: VersionFilesystemChange,
  ) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    const performApply = async () => {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      try {
        await window.docTrack.documents.applyVersionFilesystemReconciliation(
          activeWorkspacePath,
          documentVersionId,
          {
            changeIndexes: [changeIndex],
          },
        );
        await refreshSelectedDocument(
          activeWorkspacePath,
          selectedDocumentDetail.id,
        );
      } finally {
        setFilesDialog((state) => ({ ...state, isSubmitting: false }));
      }
    };

    if (
      change.kind === "missingTracked" &&
      applicationSettings.confirmDestructiveActions
    ) {
      openConfirmationDialog({
        title: "Remove Missing File Record",
        description:
          "This removes the tracked file record after confirming the file is gone on disk. A safety snapshot is created first.",
        confirmLabel: "Remove Record",
        tone: "destructive",
        detailLines: [change.trackedPath ?? "Unknown tracked path"],
        onConfirm: performApply,
      });
      return;
    }

    try {
      await performApply();
    } catch (error) {
      notifyError(error, "Unable to apply the selected filesystem change.");
    }
  };

  const openDeleteDocumentDialog = async (documentRecordId?: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail =
        documentRecordId && selectedDocumentDetail?.id !== documentRecordId
          ? await loadDocumentDetail(activeWorkspacePath, documentRecordId)
          : selectedDocumentDetail;

      if (!detail) {
        return;
      }

      setDeleteRecordsDialog({
        open: true,
        mode: "document",
        documentRecordId: detail.id,
        documentVersionId: undefined,
        documentTitle: detail.title,
        versionLabel: "",
        filePaths: detail.versions.flatMap((version) =>
          version.files.map((file) => file.filePath),
        ),
        unmanagedPaths: detail.versions.flatMap(
          (version) => version.unmanagedPaths,
        ),
        isSubmitting: false,
      });
    } catch (error) {
      notifyError(error, "Unable to prepare the document deletion preview.");
    }
  };

  const openDeleteVersionDialog = async (documentVersionId: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail = selectedDocumentDetail
        ? selectedDocumentDetail
        : await loadDocumentDetail(
            activeWorkspacePath,
            activeWorkspace?.selectedDocumentRecordId ?? 0,
          );
      const version = detail?.versions.find(
        (item) => item.id === documentVersionId,
      );

      if (!detail || !version) {
        return;
      }

      setDeleteRecordsDialog({
        open: true,
        mode: "version",
        documentRecordId: detail.id,
        documentVersionId: version.id,
        documentTitle: detail.title,
        versionLabel: version.versionLabel,
        filePaths: version.files.map((file) => file.filePath),
        unmanagedPaths: version.unmanagedPaths,
        isSubmitting: false,
      });
    } catch (error) {
      notifyError(error, "Unable to prepare the version deletion preview.");
    }
  };

  const handleConfirmDeleteRecords = async () => {
    if (!activeWorkspacePath || !deleteRecordsDialog.documentRecordId) {
      return;
    }

    try {
      setDeleteRecordsDialog((state) => ({ ...state, isSubmitting: true }));
      const deletedDocumentId = deleteRecordsDialog.documentRecordId;
      const deletedVersionId = deleteRecordsDialog.documentVersionId;
      const deletedVersionLabel = deleteRecordsDialog.versionLabel;
      const deletedMode = deleteRecordsDialog.mode;

      if (deletedMode === "document") {
        await window.docTrack.documents.delete(activeWorkspacePath, {
          documentRecordId: deletedDocumentId,
        });
        if (selectedDocumentDetail?.id === deletedDocumentId) {
          setSelectedDocumentDetail(null);
          clearSelectedDocument();
        }
        setFilesDialogVersion(null);
        setFilesDialog(defaultFilesDialogState);
        await refreshWorkspace(activeWorkspacePath);
      } else {
        if (!deletedVersionId) {
          throw new Error("Missing version id for deletion.");
        }

        await window.docTrack.documents.deleteVersion(activeWorkspacePath, {
          documentVersionId: deletedVersionId,
        });
        const refreshedDetail = await refreshSelectedDocument(
          activeWorkspacePath,
          deletedDocumentId,
        );
        if (filesDialog.versionId === deletedVersionId) {
          setFilesDialogVersion(null);
          setFilesDialog(defaultFilesDialogState);
        } else if (filesDialog.open && filesDialog.versionId) {
          const nextFilesVersion =
            refreshedDetail?.versions.find(
              (version) => version.id === filesDialog.versionId,
            ) ?? null;
          setFilesDialogVersion(nextFilesVersion);
        }
        await refreshWorkspace(activeWorkspacePath);
      }

      setDeleteRecordsDialog(defaultDeleteRecordsDialogState);
      setNotification({
        tone: "success",
        message:
          deletedMode === "document"
            ? "Document deleted."
            : `Version ${deletedVersionLabel} deleted.`,
      });
    } catch (error) {
      notifyError(error, "Unable to delete the selected record.");
      setDeleteRecordsDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleConfirmActionDialog = async () => {
    const currentOnConfirm = confirmationDialog.onConfirm;

    if (!currentOnConfirm) {
      return;
    }

    try {
      setConfirmationDialog((state) => ({ ...state, isSubmitting: true }));
      await currentOnConfirm();
      setConfirmationDialog((state) =>
        state.onConfirm === currentOnConfirm
          ? defaultConfirmationDialogState
          : state,
      );
    } catch (error) {
      notifyError(error, "Unable to complete the requested action.");
      setConfirmationDialog((state) =>
        state.onConfirm === currentOnConfirm
          ? { ...state, isSubmitting: false }
          : state,
      );
    }
  };

  let activeWorkspaceContent: React.ReactNode = null;

  if (!activeWorkspace) {
    activeWorkspaceContent = (
      <WelcomeView
        recentWorkspaces={recentWorkspaces}
        onCreateWorkspace={openCreateWorkspaceDialog}
        onOpenWorkspace={() => void openWorkspacePicker()}
        onOpenRecent={(rootPath) => {
          void openWorkspace(rootPath).catch((error: Error) => {
            notifyError(error, "Unable to open workspace.");
          });
        }}
        onDismissRecent={(rootPath) => {
          void dismissRecentWorkspace(rootPath).catch((error: Error) => {
            notifyError(error, "Unable to remove the recent workspace.");
          });
        }}
      />
    );
  } else if (activeWorkspace.authKind === "unauthenticated") {
    const enteredUsername = signInState.username.trim();
    const canRecoverAccess = activeWorkspace.canRecoverAccess;
    activeWorkspaceContent = (
      <div className="mx-auto flex max-w-xl flex-col gap-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace Locked
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            {canRecoverAccess
              ? `Recover access to ${activeWorkspace.workspace.name}`
              : `Sign in to ${activeWorkspace.workspace.name}`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {canRecoverAccess
              ? "No active workspace users remain. Create a new admin account to unlock this workspace."
              : "This workspace uses local accounts stored in its SQLite database."}
          </p>
        </div>

        {canRecoverAccess ? (
          <>
            {accessRecoveryState.error ? (
              <InlineAlert tone="error" message={accessRecoveryState.error} />
            ) : (
              <InlineAlert
                tone="warning"
                message="Recovery access is available because there are currently zero active users in this workspace."
              />
            )}

            <div className="grid gap-4">
              <Field
                label="Recovery Admin Display Name"
                error={accessRecoveryState.validationErrors.displayName}
              >
                <Input
                  value={accessRecoveryState.displayName}
                  onChange={(event) =>
                    setAccessRecoveryState((current) => ({
                      ...current,
                      displayName: event.target.value,
                      error: "",
                      validationErrors: clearValidationError(
                        current.validationErrors,
                        "displayName",
                      ),
                    }))
                  }
                />
              </Field>

              <Field
                label="Recovery Admin Username"
                error={accessRecoveryState.validationErrors.username}
              >
                <Input
                  value={accessRecoveryState.username}
                  onChange={(event) =>
                    setAccessRecoveryState((current) => ({
                      ...current,
                      username: event.target.value,
                      error: "",
                      validationErrors: clearValidationError(
                        current.validationErrors,
                        "username",
                      ),
                    }))
                  }
                />
              </Field>

              <Field
                label="Recovery Password or PIN"
                error={accessRecoveryState.validationErrors.password}
              >
                <Input
                  type="password"
                  value={accessRecoveryState.password}
                  onChange={(event) =>
                    setAccessRecoveryState((current) => ({
                      ...current,
                      password: event.target.value,
                      error: "",
                      validationErrors: clearValidationError(
                        current.validationErrors,
                        "password",
                      ),
                    }))
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      accessRecoveryState.username.trim() &&
                      accessRecoveryState.displayName.trim() &&
                      accessRecoveryState.password
                    ) {
                      event.preventDefault();
                      void handleRecoverWorkspaceAccess();
                    }
                  }}
                />
              </Field>
            </div>

            <div className="flex gap-3">
              <Button
                disabled={
                  !accessRecoveryState.username.trim() ||
                  !accessRecoveryState.displayName.trim() ||
                  !accessRecoveryState.password ||
                  accessRecoveryState.isSubmitting
                }
                onClick={() => void handleRecoverWorkspaceAccess()}
              >
                {accessRecoveryState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Recover Access
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void closeWorkspace(activeWorkspace.workspace.rootPath)
                }
              >
                Close Workspace
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4">
              <Field label="User">
                <Input
                  value={signInState.username}
                  placeholder="Username"
                  onChange={(event) =>
                    setSignInState((current) => ({
                      ...current,
                      username: event.target.value,
                      error: "",
                    }))
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      enteredUsername &&
                      signInState.password
                    ) {
                      event.preventDefault();
                      void signInWorkspace(
                        activeWorkspace.workspace.rootPath,
                        enteredUsername,
                        signInState.password,
                      ).catch((error: Error) => {
                        setSignInState((current) => ({
                          ...current,
                          error: getErrorMessage(error, "Unable to sign in."),
                        }));
                      });
                    }
                  }}
                />
              </Field>

              <Field
                label="Password or PIN"
                error={signInState.error || undefined}
              >
                <Input
                  type="password"
                  value={signInState.password}
                  onChange={(event) =>
                    setSignInState((current) => ({
                      ...current,
                      password: event.target.value,
                      error: "",
                    }))
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      enteredUsername &&
                      signInState.password
                    ) {
                      event.preventDefault();
                      void signInWorkspace(
                        activeWorkspace.workspace.rootPath,
                        enteredUsername,
                        signInState.password,
                      ).catch((error: Error) => {
                        setSignInState((current) => ({
                          ...current,
                          error: getErrorMessage(error, "Unable to sign in."),
                        }));
                      });
                    }
                  }}
                />
              </Field>
            </div>

            <div className="flex gap-3">
              <Button
                disabled={
                  !enteredUsername ||
                  !signInState.password ||
                  signInState.isSubmitting
                }
                onClick={() => {
                  setSignInState((current) => ({
                    ...current,
                    isSubmitting: true,
                    error: "",
                  }));
                  void signInWorkspace(
                    activeWorkspace.workspace.rootPath,
                    enteredUsername,
                    signInState.password,
                  )
                    .then(() =>
                      setSignInState({
                        username: enteredUsername,
                        password: "",
                        isSubmitting: false,
                        error: "",
                      }),
                    )
                    .catch((error: Error) => {
                      setSignInState((current) => ({
                        ...current,
                        isSubmitting: false,
                        error: getErrorMessage(error, "Unable to sign in."),
                      }));
                    });
                }}
              >
                {signInState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void closeWorkspace(activeWorkspace.workspace.rootPath)
                }
              >
                Close Workspace
              </Button>
            </div>
          </>
        )}
      </div>
    );
  } else if (activeWorkspace.selectedView === "dashboard") {
    activeWorkspaceContent = (
      <DashboardView
        workspace={activeWorkspace}
        onOpenDocuments={(drilldown) => {
          applyDashboardDrilldown(
            activeWorkspace.workspace.rootPath,
            drilldown,
          );
        }}
        onOpenDocument={(documentRecordId) => {
          setWorkspaceView(activeWorkspace.workspace.rootPath, "documents");
          setSelectedDocument(
            activeWorkspace.workspace.rootPath,
            documentRecordId,
          );
        }}
        onApplySavedView={(savedView) =>
          applySavedView(activeWorkspace.workspace.rootPath, savedView)
        }
        onUpdateDashboardLayout={(input) =>
          updateDashboardLayout(
            activeWorkspace.workspace.rootPath,
            input,
          ).catch((error: Error) => {
            notifyError(error, "Unable to save the dashboard layout.");
            throw error;
          })
        }
        onPromoteSavedViewToShared={(input) =>
          promoteSavedViewToShared(
            activeWorkspace.workspace.rootPath,
            input,
          ).catch((error: Error) => {
            notifyError(error, "Unable to promote the saved view.");
            throw error;
          })
        }
        onShowAllActivity={() => {
          void openActivityLogDialog();
        }}
      />
    );
  } else if (
    activeWorkspace.selectedView === "documents" ||
    (activeWorkspace.selectedView === "groups" &&
      !workspaceSupportsGroups) ||
    (activeWorkspace.selectedView === "classifications" &&
      !workspaceSupportsConfidentialityClasses) ||
    (activeWorkspace.selectedView === "languages" &&
      !workspaceSupportsLanguages)
  ) {
    activeWorkspaceContent = (
      <DocumentsView
        workspace={activeWorkspace}
        applicationSettings={applicationSettings}
        isMacOs={isMacOs}
        documentTableDensity={applicationSettings.documentTableDensity}
        documentViewState={activeWorkspace.documentViewState}
        documentsVisualizationMode={
          activeWorkspace.selectedDocumentsVisualization
        }
        visibleTableColumns={getEffectiveDocumentTableVisibleColumns(
          applicationSettings.documentTableVisibleColumns,
          activeWorkspace.settings.visibleDocumentColumns,
        )}
        savedViews={activeWorkspace.savedViews}
        selectedDocumentDetail={selectedDocumentDetail}
        isDetailLoading={isDetailLoading}
        onSelectDocument={(documentRecordId) =>
          setSelectedDocument(
            activeWorkspace.workspace.rootPath,
            documentRecordId,
          )
        }
        onCloseDocumentDetail={clearSelectedDocument}
        onShowFiles={handleShowFilesForDocument}
        onRequestStatusChange={handleRequestStatusChange}
        onRequestNewDocument={openCreateDocumentDialog}
        onExportDocuments={handleExportDocuments}
        onDocumentsVisualizationModeChange={(mode) =>
          setDocumentsVisualization(activeWorkspace.workspace.rootPath, mode)
        }
        onOpenTableSettings={() =>
          setTableColumnsDialog({
            open: true,
            visibleColumns: getEffectiveDocumentTableVisibleColumns(
              applicationSettings.documentTableVisibleColumns,
              activeWorkspace.settings.visibleDocumentColumns,
            ),
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onRequestEditDocument={(documentRecordId) => {
          void openEditDocumentDialog(documentRecordId).catch(
            (error: Error) => {
              notifyError(error, "Unable to load the selected document.");
            },
          );
        }}
        onRequestNewVersion={() => {
          if (selectedDocumentDetail) {
            setVersionDialog((state) => ({
              ...state,
              open: true,
            }));
          }
        }}
        onRequestLatestVersionEdit={(documentRecordId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void (async () => {
            const detail =
              documentRecordId &&
              selectedDocumentDetail?.id !== documentRecordId
                ? await loadDocumentDetail(
                    activeWorkspacePath,
                    documentRecordId,
                  )
                : selectedDocumentDetail;

            const latestVersion = detail?.versions[0];
            if (!latestVersion) {
              return;
            }

            openVersionMetadataDialog(latestVersion, "latest");
          })().catch((error: Error) => {
            notifyError(error, "Unable to load the latest version details.");
          });
        }}
        onRequestVersionEdit={(documentVersionId) => {
          const version =
            selectedDocumentDetail?.versions.find(
              (item) => item.id === documentVersionId,
            ) ?? null;
          if (!version) {
            return;
          }

          openVersionMetadataDialog(version, "version");
        }}
        onOpenRevisionDescription={openRevisionDescriptionDialog}
        onShowDocumentFolder={() => {
          if (!activeWorkspacePath || !selectedDocumentDetail) {
            return;
          }

          void window.docTrack.documents
            .openDocumentFolder(activeWorkspacePath, selectedDocumentDetail.id)
            .catch((error: Error) => {
              notifyError(error, "Unable to open the document folder.");
            });
        }}
        onShowVersionFiles={(documentVersionId) => {
          if (!selectedDocumentDetail) {
            return;
          }

          openFilesDialogForDetail(selectedDocumentDetail, {
            preferredVersionId: documentVersionId,
          });
        }}
        onRequestDeleteDocument={(documentRecordId) => {
          void openDeleteDocumentDialog(documentRecordId);
        }}
        onRequestDeleteVersion={(documentVersionId) => {
          void openDeleteVersionDialog(documentVersionId);
        }}
        onUpdateSidebarWidth={(nextWidth) =>
          saveApplicationSettingsPartial({
            documentDetailSidebarWidth: nextWidth,
          })
        }
        onDocumentViewStateChange={(updater) =>
          setDocumentViewState(activeWorkspace.workspace.rootPath, updater)
        }
        onApplySavedView={(savedView) =>
          applySavedView(activeWorkspace.workspace.rootPath, savedView)
        }
        onCreateSavedView={(input) =>
          createSavedView(activeWorkspace.workspace.rootPath, input).catch(
            (error: Error) => {
              notifyError(error, "Unable to save the current view.");
              throw error;
            },
          )
        }
        onUpdateSavedView={(savedViewId, scope, input) =>
          updateSavedView(
            activeWorkspace.workspace.rootPath,
            savedViewId,
            scope,
            input,
          ).catch((error: Error) => {
            notifyError(error, "Unable to update the saved view.");
            throw error;
          })
        }
        onDeleteSavedView={(input) =>
          deleteSavedView(activeWorkspace.workspace.rootPath, input).catch(
            (error: Error) => {
              notifyError(error, "Unable to delete the saved view.");
              throw error;
            },
          )
        }
        onDuplicateSavedView={(input) =>
          duplicateSavedView(activeWorkspace.workspace.rootPath, input).catch(
            (error: Error) => {
              notifyError(error, "Unable to duplicate the saved view.");
              throw error;
            },
          )
        }
        onPromoteSavedViewToShared={(input) =>
          promoteSavedViewToShared(
            activeWorkspace.workspace.rootPath,
            input,
          ).catch((error: Error) => {
            notifyError(error, "Unable to promote the saved view.");
            throw error;
          })
        }
        onPinSavedViewToDashboard={(savedView) =>
          pinSavedViewToDashboard(activeWorkspace.workspace.rootPath, savedView)
        }
        documentExportDialogRequest={documentExportDialogRequest}
        onDocumentExportDialogRequestConsumed={() =>
          setDocumentExportDialogRequest((current) =>
            current?.workspacePath === activeWorkspace.workspace.rootPath
              ? null
              : current,
          )
        }
      />
    );
  } else if (activeWorkspace.selectedView === "documentTypes") {
    activeWorkspaceContent = (
      <DocumentTypesView
        workspace={activeWorkspace}
        onCreateType={() =>
          setTypeDialog({
            ...defaultTypeDialogState,
            open: true,
          })
        }
        onEditType={(type) =>
          setTypeDialog({
            open: true,
            id: type.id,
            name: type.name,
            numberPrefix: type.numberPrefix,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onDeleteType={handleDeleteDocumentType}
      />
    );
  } else if (activeWorkspace.selectedView === "groups") {
    activeWorkspaceContent = (
      <GroupsView
        workspace={activeWorkspace}
        onCreateProject={() =>
          setProjectDialog({
            ...defaultProjectDialogState,
            open: true,
            entity: "group",
          })
        }
        onEditProject={(project) =>
          setProjectDialog({
            open: true,
            entity: "group",
            id: project.id,
            name: project.name,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onDeleteProject={handleDeleteGroup}
        onAssignProject={handleAssignGroupToDocument}
      />
    );
  } else if (activeWorkspace.selectedView === "templates") {
    activeWorkspaceContent = (
      <TemplatesView
        workspace={activeWorkspace}
        onCreateTemplate={() =>
          setTemplateDialog({ ...defaultTemplateDialogState, open: true })
        }
        onAddFiles={(template) =>
          setTemplateFilesDialog({
            open: true,
            templateId: template.id,
            templateName: template.name,
            pendingSourceFilePaths: [],
            isDragActive: false,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onOpenTemplatesFolder={() => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openStoredPath(
              activeWorkspacePath,
              getWorkspaceTemplatesRelativePath(activeWorkspace.settings),
            )
            .catch((error: Error) => {
              notifyError(error, "Unable to open the templates folder.");
            });
        }}
        onOpenTemplateFolder={(template) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openStoredPath(activeWorkspacePath, template.folderPath)
            .catch((error: Error) => {
              notifyError(
                error,
                "Unable to open the selected template folder.",
              );
            });
        }}
        onDeleteTemplate={handleDeleteTemplate}
      />
    );
  } else if (activeWorkspace.selectedView === "classifications") {
    activeWorkspaceContent = (
      <ClassificationsView
        workspace={activeWorkspace}
        onCreateConfidentialityClass={() =>
          setClassificationDialog({
            ...defaultClassificationDialogState,
            open: true,
          })
        }
        onEditConfidentialityClass={(item) =>
          setClassificationDialog({
            open: true,
            id: item.id,
            name: item.name,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onDeleteConfidentialityClass={handleDeleteConfidentialityClass}
      />
    );
  } else if (activeWorkspace.selectedView === "languages") {
    activeWorkspaceContent = (
      <LanguagesView
        workspace={activeWorkspace}
        onCreateLanguage={() =>
          setLanguageDialog({ ...defaultLanguageDialogState, open: true })
        }
        onEditLanguage={(item) =>
          setLanguageDialog({
            open: true,
            id: item.id,
            code: item.code,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onDeleteLanguage={handleDeleteLanguage}
      />
    );
  }

  if (!isBootstrapped) {
    return (
      <div className="app-surface flex min-h-full items-center justify-center">
        {bootError ? (
          <div className="max-w-xl rounded-2xl border border-[#F0D5D3] bg-[#FFF7F6] px-6 py-5 shadow-sm dark:border-[#5A2D2F] dark:bg-[#3B1F21]/60">
            <div className="text-base font-semibold text-[#C4554D] dark:text-[#FFB7B2]">
              DocTrack could not start
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {bootError}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  setBootError(null);
                  void bootstrap().catch((error) => {
                    const message = getErrorMessage(
                      error,
                      "DocTrack failed to initialize the desktop shell.",
                    );
                    setBootError(message);
                    notifyError(
                      error,
                      "DocTrack failed to initialize the desktop shell.",
                    );
                  });
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2.5 text-base font-semibold">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading DocTrack workspace shell
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "app-surface flex min-h-full flex-col",
        isMacOs && "platform-macos",
      )}
    >
      <header className="app-header window-drag-region relative z-40 border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-md">
        <div className="app-header-row flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-workspace text-workspace-contrast shadow-sm">
              <FileStack className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">
                DocTrack
              </div>
              <div className="text-[13px] text-muted-foreground">
                Offline document workspaces with version control
              </div>
            </div>
          </div>

          <div className="window-no-drag flex flex-wrap items-center gap-1.5">
            <Button variant="outline" onClick={openApplicationSettingsDialog}>
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button variant="outline" onClick={openCreateWorkspaceDialog}>
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
            <div className="relative" ref={workspaceMenuRef}>
              <Button
                variant="secondary"
                aria-expanded={isWorkspaceMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
              >
                <FolderOpen className="h-4 w-4" />
                Open Workspace
                <ChevronDown className="h-4 w-4" />
              </Button>
              {isWorkspaceMenuOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] w-[320px] rounded-2xl border border-border bg-card p-2 shadow-2xl"
                  role="menu"
                >
                  <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Recent Workspaces
                  </div>
                  <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                    {recentWorkspaces.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-background px-3 py-4 text-[13px] text-muted-foreground">
                        No recent workspaces yet.
                      </div>
                    ) : (
                      recentWorkspaces.map((workspace) => (
                        <div
                          key={workspace.rootPath}
                          className="flex items-start gap-2 rounded-xl border border-transparent bg-background px-3 py-3 transition hover:border-border hover:bg-accent"
                        >
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              setIsWorkspaceMenuOpen(false);
                              void openWorkspace(workspace.rootPath).catch(
                                (error: Error) => {
                                  notifyError(
                                    error,
                                    "Unable to open workspace.",
                                  );
                                },
                              );
                            }}
                          >
                            <div className="truncate text-[13px] font-semibold">
                              {workspace.name}
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {workspace.rootPath}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Last opened{" "}
                              {formatDateTime(workspace.lastOpenedDate)}
                            </div>
                          </button>
                          <button
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
                            aria-label={`Dismiss ${workspace.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void dismissRecentWorkspace(
                                workspace.rootPath,
                              ).catch((error: Error) => {
                                notifyError(
                                  error,
                                  "Unable to remove the recent workspace.",
                                );
                              });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    <button
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition hover:bg-accent"
                      onClick={() => void openWorkspacePicker()}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Choose Workspace Folder...
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="window-no-drag mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {workspaceTabs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-[13px] text-muted-foreground">
              No workspace open yet. Create one or open an existing workspace
              folder.
            </div>
          ) : (
            workspaceTabs.map((workspaceTab) => {
              const filesystemAttention =
                getWorkspaceFilesystemAttentionCounts(workspaceTab);
              const hasFilesystemAttention =
                filesystemAttention.totalAttentionCount > 0;

              return (
                <div
                  key={workspaceTab.workspace.rootPath}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl border px-3 text-left transition",
                    applicationSettings.workspaceTabDensity === "compact"
                      ? "min-w-[160px] py-1.5"
                      : "min-w-[190px] py-2.5",
                    activeWorkspacePath === workspaceTab.workspace.rootPath
                      ? hasFilesystemAttention
                        ? "border-destructive/55 bg-destructive/10 text-foreground"
                        : "border-border bg-secondary text-foreground"
                      : hasFilesystemAttention
                        ? "border-destructive/35 bg-destructive/5 text-foreground hover:bg-destructive/10"
                        : "border-border bg-background text-muted-foreground hover:bg-accent",
                  )}
                  onClick={() => {
                    activateWorkspaceTab(workspaceTab.workspace.rootPath);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activateWorkspaceTab(workspaceTab.workspace.rootPath);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[13px] font-semibold">
                        {workspaceTab.workspace.name}
                      </div>
                      {hasFilesystemAttention ? (
                        <Badge
                          variant="destructive"
                          className="shrink-0 gap-1 px-1.5 py-0.5"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {filesystemAttention.totalAttentionCount}
                        </Badge>
                      ) : null}
                    </div>
                    {applicationSettings.workspaceTabDensity ===
                    "comfortable" ? (
                      <div
                        className={cn(
                          "truncate text-xs",
                          hasFilesystemAttention
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {hasFilesystemAttention
                          ? `${filesystemAttention.totalAttentionCount} action item${filesystemAttention.totalAttentionCount === 1 ? "" : "s"} to fix`
                          : `${workspaceTab.documents.length} docs`}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="rounded-md p-1 text-muted-foreground transition hover:bg-card hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      void closeWorkspace(workspaceTab.workspace.rootPath);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </header>

      {notification ? (
        <NotificationBar
          tone={notification.tone}
          message={notification.message}
          onClose={() => setNotification(undefined)}
        />
      ) : null}

      <main className="flex min-h-0 flex-1">
        <aside className="hidden w-[220px] border-r border-border/80 bg-card/60 p-3 lg:block">
          <div className="rounded-xl border border-border bg-background p-2.5 shadow-sm">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Workspace Views
            </div>
            <SidebarButton
              icon={Table2}
              label="Dashboard"
              active={activeWorkspace?.selectedView === "dashboard"}
              disabled={!hasActiveWorkspaceAccess}
              attentionCount={
                activeWorkspaceFilesystemAttention?.totalAttentionCount
              }
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "dashboard")
              }
            />
            <SidebarButton
              icon={FileText}
              label="Documents"
              active={activeWorkspace?.selectedView === "documents"}
              disabled={!hasActiveWorkspaceAccess}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "documents")
              }
            />
            {workspaceSupportsGroups ? (
              <SidebarButton
                icon={FolderOpen}
                label="Groups"
                active={activeWorkspace?.selectedView === "groups"}
                disabled={!hasActiveWorkspaceAccess}
                onClick={() =>
                  activeWorkspacePath &&
                  setWorkspaceView(activeWorkspacePath, "groups")
                }
              />
            ) : null}
            <SidebarButton
              icon={FileStack}
              label="Templates"
              active={activeWorkspace?.selectedView === "templates"}
              disabled={!hasActiveWorkspaceAccess}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "templates")
              }
            />
            <SidebarButton
              icon={LayoutPanelLeft}
              label="Document Types"
              active={activeWorkspace?.selectedView === "documentTypes"}
              disabled={!hasActiveWorkspaceAccess}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "documentTypes")
              }
            />
            {workspaceSupportsConfidentialityClasses ? (
              <SidebarButton
                icon={Settings2}
                label="Classifications"
                active={activeWorkspace?.selectedView === "classifications"}
                disabled={!hasActiveWorkspaceAccess}
                onClick={() =>
                  activeWorkspacePath &&
                  setWorkspaceView(activeWorkspacePath, "classifications")
                }
              />
            ) : null}
            {workspaceSupportsLanguages ? (
              <SidebarButton
                icon={Pencil}
                label="Languages"
                active={activeWorkspace?.selectedView === "languages"}
                disabled={!hasActiveWorkspaceAccess}
                onClick={() =>
                  activeWorkspacePath &&
                  setWorkspaceView(activeWorkspacePath, "languages")
                }
              />
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background p-2.5 shadow-sm">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Workspace Controls
            </div>
            {activeWorkspaceSession && isActiveWorkspaceUserSystemEnabled ? (
              <div className="mb-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px]">
                <div className="font-semibold text-foreground">
                  {activeWorkspaceSession.user.displayName}
                </div>
                <div className="text-muted-foreground">
                  {activeWorkspaceSession.user.roleName ??
                    activeWorkspaceSession.user.role}
                </div>
              </div>
            ) : null}
            <SidebarButton
              icon={FilePlus2}
              label="New Document"
              disabled={
                !hasActiveWorkspaceAccess ||
                !activeWorkspacePermissions?.canEditDocuments
              }
              onClick={openCreateDocumentDialog}
            />
            <SidebarButton
              icon={Settings2}
              label="Workspace Settings"
              active={workspaceSettingsDialog.open}
              disabled={
                !hasActiveWorkspaceAccess ||
                (!activeWorkspacePermissions?.canManageWorkspaceSettings &&
                  !activeWorkspacePermissions?.canManageRoles)
              }
              onClick={openWorkspaceSettingsDialog}
            />
            {isActiveWorkspaceUserSystemEnabled && canOpenWorkspaceUsers ? (
              <SidebarButton
                icon={Settings}
                label="Workspace Users"
                active={workspaceUsersDialog.open}
                disabled={!hasActiveWorkspaceAccess}
                onClick={openWorkspaceUsersDialog}
              />
            ) : null}
            <SidebarButton
              icon={History}
              label="Backups & Recovery"
              active={backupDialog.open}
              disabled={
                !hasActiveWorkspaceAccess ||
                !activeWorkspacePermissions?.canManageWorkspaceMaintenance
              }
              onClick={openBackupDialog}
            />
            {isActiveWorkspaceUserSystemEnabled ? (
              <SidebarButton
                icon={X}
                label="Sign Out"
                disabled={!activeWorkspaceSession}
                onClick={() => {
                  if (!activeWorkspacePath) {
                    return;
                  }

                  void signOutWorkspace(activeWorkspacePath).catch(
                    (error: Error) => {
                      notifyError(
                        error,
                        "Unable to sign out of the workspace.",
                      );
                    },
                  );
                }}
              />
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-3">
          {activeWorkspaceContent}
        </section>
      </main>

      <CommandPaletteDialog
        open={commandPalette.open}
        title={commandPaletteMeta.title}
        description={commandPaletteMeta.description}
        query={commandPalette.query}
        items={currentCommandPaletteCommands}
        emptyMessage={commandPaletteMeta.emptyMessage}
        showBackButton={commandPalette.mode !== "root"}
        onOpenChange={(open) => {
          if (!open) {
            closeCommandPalette();
            return;
          }

          openCommandPalette();
        }}
        onQueryChange={(query) =>
          setCommandPalette((state) => ({
            ...state,
            query,
          }))
        }
        onBack={handleCommandPaletteBack}
        onSelect={handleCommandPaletteSelect}
      />

      <WorkspaceDialog
        state={workspaceDialog}
        onStateChange={setWorkspaceDialog}
        onSubmit={handleCreateWorkspace}
      />

      <WorkspaceSettingsDialog
        state={workspaceSettingsDialog}
        currentPermissions={activeWorkspacePermissions ?? undefined}
        assignedCustomRoles={getAssignedCustomWorkspaceRoles(
          activeWorkspace?.users ?? [],
          workspaceSettingsDialog.roleSettings,
        )}
        onStateChange={setWorkspaceSettingsDialog}
        onSubmit={handleSaveWorkspaceSettings}
        onOpenRoleSettings={openWorkspaceRoleSettingsDialog}
        onSaveRoleSettings={handleSaveWorkspaceRoleSettings}
      />

      <WorkspaceUsersDialog
        state={workspaceUsersDialog}
        currentUserId={activeWorkspaceSession?.user.id}
        currentPermissions={activeWorkspacePermissions ?? undefined}
        onOpenChange={(open) =>
          setWorkspaceUsersDialog(
            open
              ? { ...workspaceUsersDialog, open }
              : defaultWorkspaceUsersDialogState,
          )
        }
        onStateChange={setWorkspaceUsersDialog}
        onSelectUser={handleSelectWorkspaceUser}
        onSave={handleSaveWorkspaceUser}
        onResetPassword={handleResetWorkspaceUserPassword}
        onToggleAccess={handleToggleWorkspaceUserAccess}
        onDelete={handleDeleteWorkspaceUser}
        onUnarchive={handleUnarchiveWorkspaceUser}
      />

      <ApplicationSettingsDialog
        state={applicationSettingsDialog}
        persistedSettings={applicationSettings}
        appUpdateState={appUpdateState}
        onStateChange={setApplicationSettingsDialog}
        onSubmit={handleSaveApplicationSettings}
        onCheckForUpdates={handleCheckForUpdates}
        onDownloadUpdate={handleDownloadUpdate}
        onInstallUpdate={handleInstallUpdate}
        isMacOs={isMacOs}
      />

      <TableColumnsDialog
        state={tableColumnsDialog}
        availableColumns={
          activeWorkspace?.settings.visibleDocumentColumns ?? []
        }
        onStateChange={setTableColumnsDialog}
        onSubmit={handleSaveTableColumns}
      />

      <DocumentDialog
        open={documentDialog.open}
        onOpenChange={(open) =>
          setDocumentDialog(
            open ? { ...documentDialog, open } : defaultDocumentDialogState,
          )
        }
        state={documentDialog}
        onStateChange={setDocumentDialog}
        onSubmit={handleSaveDocument}
        documentTypes={activeWorkspace?.documentTypes ?? []}
        userSystemEnabled={activeWorkspace?.settings.userSystemEnabled ?? true}
        workspaceUsers={(activeWorkspace?.users ?? []).filter(
          (user) => !user.archived,
        )}
        templates={activeWorkspace?.templates ?? []}
        groups={activeWorkspace?.groups ?? []}
        projects={activeWorkspace?.projects ?? []}
        confidentialityClasses={activeWorkspace?.confidentialityClasses ?? []}
        languages={activeWorkspace?.languages ?? []}
        availableColumns={activeWorkspaceAvailableColumns}
        onCreateProject={() =>
          setProjectDialog({
            ...defaultProjectDialogState,
            open: true,
            entity: "project",
          })
        }
        onEditProject={(project) =>
          setProjectDialog({
            open: true,
            entity: "project",
            id: project.id,
            name: project.name,
            isSubmitting: false,
            validationErrors: {},
          })
        }
        onDeleteProject={handleDeleteProjectDefinition}
      />

      <VersionDialog
        open={versionDialog.open}
        onOpenChange={(open) =>
          setVersionDialog(
            open ? { ...versionDialog, open } : defaultVersionDialogState,
          )
        }
        state={versionDialog}
        onStateChange={setVersionDialog}
        onSubmit={handleCreateVersion}
        documentDetail={selectedDocumentDetail}
      />

      <LatestVersionDialog
        open={latestVersionDialog.open}
        onOpenChange={(open) =>
          setLatestVersionDialog(
            open
              ? { ...latestVersionDialog, open }
              : defaultLatestVersionDialogState,
          )
        }
        state={latestVersionDialog}
        onStateChange={setLatestVersionDialog}
        onSubmit={handleSaveLatestVersion}
        documentDetail={selectedDocumentDetail}
        userSystemEnabled={activeWorkspace?.settings.userSystemEnabled ?? true}
        workspaceUsers={(activeWorkspace?.users ?? []).filter(
          (user) => !user.archived,
        )}
        lifecycle={
          activeWorkspace?.lifecycle ?? DEFAULT_WORKSPACE_LIFECYCLE_STATE
        }
        availableColumns={activeWorkspaceAvailableColumns}
      />

      <StatusChangeDialog
        state={statusChangeDialog}
        onOpenChange={(open) =>
          setStatusChangeDialog(
            open
              ? { ...statusChangeDialog, open }
              : defaultStatusChangeDialogState,
          )
        }
        onSubmit={handleConfirmStatusChange}
        lifecycle={
          activeWorkspace?.lifecycle ?? DEFAULT_WORKSPACE_LIFECYCLE_STATE
        }
      />

      <DocumentTypeDialog
        open={typeDialog.open}
        onOpenChange={(open) =>
          setTypeDialog(open ? { ...typeDialog, open } : defaultTypeDialogState)
        }
        state={typeDialog}
        onStateChange={setTypeDialog}
        onSubmit={handleSaveDocumentType}
      />

      <ProjectDialog
        open={projectDialog.open}
        onOpenChange={(open) =>
          setProjectDialog(
            open ? { ...projectDialog, open } : defaultProjectDialogState,
          )
        }
        state={projectDialog}
        onStateChange={setProjectDialog}
        onSubmit={handleSaveProject}
      />

      <TemplateDialog
        open={templateDialog.open}
        onOpenChange={(open) =>
          setTemplateDialog(
            open ? { ...templateDialog, open } : defaultTemplateDialogState,
          )
        }
        state={templateDialog}
        onStateChange={setTemplateDialog}
        onSubmit={handleSaveTemplate}
      />

      <TemplateFilesDialog
        open={templateFilesDialog.open}
        onOpenChange={(open) =>
          setTemplateFilesDialog(
            open
              ? { ...templateFilesDialog, open }
              : defaultTemplateFilesDialogState,
          )
        }
        state={templateFilesDialog}
        onStateChange={setTemplateFilesDialog}
        onPickFiles={handlePickTemplateFiles}
        onDropFiles={stageDroppedTemplateFiles}
        onRemoveFile={handleRemoveTemplateStagedFile}
        onClearFiles={handleClearTemplateStagedFiles}
        onSubmit={handleAddFilesToTemplate}
      />

      <ConfidentialityClassDialog
        open={classificationDialog.open}
        onOpenChange={(open) =>
          setClassificationDialog(
            open
              ? { ...classificationDialog, open }
              : defaultClassificationDialogState,
          )
        }
        state={classificationDialog}
        onStateChange={setClassificationDialog}
        onSubmit={handleSaveConfidentialityClass}
      />

      <LanguageDialog
        open={languageDialog.open}
        onOpenChange={(open) =>
          setLanguageDialog(
            open ? { ...languageDialog, open } : defaultLanguageDialogState,
          )
        }
        state={languageDialog}
        onStateChange={setLanguageDialog}
        onSubmit={handleSaveLanguage}
      />

      <VersionFilesDialog
        open={filesDialog.open}
        onOpenChange={(open) => {
          if (open) {
            setFilesDialog({ ...filesDialog, open });
            return;
          }

          setFilesDialogVersion(null);
          setFilesDialog(defaultFilesDialogState);
        }}
        state={filesDialog}
        onStateChange={setFilesDialog}
        lifecycle={
          activeWorkspace?.lifecycle ?? DEFAULT_WORKSPACE_LIFECYCLE_STATE
        }
        version={activeFilesVersion}
        affectedVersions={activeFilesAffectedVersions}
        canEdit={Boolean(selectedDocumentDetail && activeFilesVersion)}
        onSelectVersion={(documentVersionId) => {
          const version =
            selectedDocumentDetail?.versions.find(
              (item) => item.id === documentVersionId,
            ) ?? null;
          setFilesDialogVersion(version);
          setFilesDialog((current) => ({
            ...current,
            versionId: documentVersionId,
          }));
        }}
        onRefresh={handleRefreshVersionFiles}
        onAddFiles={handleAddFilesToVersion}
        onOpenFile={(fileId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openVersionFile(activeWorkspacePath, fileId)
            .catch((error: Error) => {
              notifyError(error, "Unable to open the selected file.");
            });
        }}
        onOpenFolder={(documentVersionId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openVersionFolder(activeWorkspacePath, documentVersionId)
            .catch((error: Error) => {
              notifyError(error, "Unable to open the version folder.");
            });
        }}
        onRenameFile={handleRenameVersionFile}
        onDeleteFile={handleDeleteVersionFile}
        onChangeRole={handleChangeVersionFileRole}
        onPreviewFile={handlePreviewVersionFile}
        onCompareVersion={handleCompareVersion}
        onDropFiles={stageFilesForVersion}
        onUploadStagedFiles={handleUploadStagedFiles}
        onOpenStoredPath={(relativePath) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openStoredPath(activeWorkspacePath, relativePath)
            .catch((error: Error) => {
              notifyError(error, "Unable to open the selected path.");
            });
        }}
        onIgnoreUnmanagedPath={handleIgnoreUnmanagedPath}
        onReconcileUnmanagedPath={handleReconcileUnmanagedPath}
        onApplyFilesystemChange={handleApplyFilesystemChange}
      />

      <DeleteRecordsDialog
        state={deleteRecordsDialog}
        onOpenChange={(open) =>
          setDeleteRecordsDialog(
            open
              ? { ...deleteRecordsDialog, open }
              : defaultDeleteRecordsDialogState,
          )
        }
        onConfirm={handleConfirmDeleteRecords}
      />
      <ConfirmationDialog
        appUpdateState={appUpdateState}
        state={confirmationDialog}
        onOpenChange={(open) =>
          setConfirmationDialog(
            open
              ? { ...confirmationDialog, open }
              : defaultConfirmationDialogState,
          )
        }
        onConfirm={handleConfirmActionDialog}
      />
      <RevisionDescriptionDialog
        state={revisionDescriptionDialog}
        onOpenChange={(open) =>
          setRevisionDescriptionDialog(
            open
              ? { ...revisionDescriptionDialog, open }
              : defaultRevisionDescriptionDialogState,
          )
        }
      />

      <RenameFileDialog
        open={renameFileDialog.open}
        onOpenChange={(open) =>
          setRenameFileDialog(
            open ? { ...renameFileDialog, open } : defaultRenameFileDialogState,
          )
        }
        state={renameFileDialog}
        onStateChange={setRenameFileDialog}
        onSubmit={handleConfirmRenameVersionFile}
      />

      <BackupDialog
        state={backupDialog}
        onOpenChange={(open) =>
          setBackupDialog(
            open ? { ...backupDialog, open } : defaultBackupDialogState,
          )
        }
        onCreateBackup={handleCreateBackup}
        onPreviewRestore={handlePreviewRestore}
        onOverwriteRestore={handleOverwriteBackup}
        onExportRestore={handleExportBackup}
        onRefresh={() =>
          activeWorkspacePath && void refreshBackupDialog(activeWorkspacePath)
        }
      />

      <FilePreviewDialog
        state={filePreviewDialog}
        onOpenChange={(open) =>
          setFilePreviewDialog(
            open
              ? { ...filePreviewDialog, open }
              : defaultFilePreviewDialogState,
          )
        }
      />

      <ActivityLogDialog
        state={activityLogDialog}
        onOpenChange={(open) =>
          setActivityLogDialog(
            open
              ? { ...activityLogDialog, open }
              : defaultActivityLogDialogState,
          )
        }
        onOpenDocument={(documentRecordId) => {
          if (!activeWorkspacePath) {
            return;
          }

          setActivityLogDialog(defaultActivityLogDialogState);
          setWorkspaceView(activeWorkspacePath, "documents");
          setSelectedDocument(activeWorkspacePath, documentRecordId);
        }}
      />

      <VersionComparisonDialog
        state={versionComparisonDialog}
        onOpenChange={(open) =>
          setVersionComparisonDialog(
            open
              ? { ...versionComparisonDialog, open }
              : defaultVersionComparisonDialogState,
          )
        }
      />
    </div>
  );
}

function ThemeToggle({
  themeMode,
  onChange,
}: {
  themeMode: ThemeMode;
  onChange: (value: ThemeMode) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {THEME_MODE_OPTIONS.map((option) => {
        const Icon = THEME_MODE_ICONS[option.value];
        const isSelected = themeMode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            className={cn(
              "w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isSelected
                ? "border-ring bg-card text-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-accent/60 hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <Icon className="h-4 w-4" />
                  {option.label}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
              <div
                className={cn(
                  "mt-0.5 h-2.5 w-2.5 rounded-full transition",
                  isSelected ? "bg-primary" : "bg-border",
                )}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ApplicationSettingsDialog({
  state,
  persistedSettings,
  appUpdateState,
  onStateChange,
  onSubmit,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  isMacOs,
}: {
  state: ApplicationSettingsDialogState;
  persistedSettings: ApplicationSettings;
  appUpdateState: AppUpdateState | null;
  onStateChange: React.Dispatch<
    React.SetStateAction<ApplicationSettingsDialogState>
  >;
  onSubmit: () => Promise<void>;
  onCheckForUpdates: () => void | Promise<void>;
  onDownloadUpdate: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
  isMacOs: boolean;
}) {
  const updateSettings = (partial: Partial<ApplicationSettings>) => {
    onStateChange((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...partial,
        keyboardShortcuts: partial.keyboardShortcuts
          ? { ...partial.keyboardShortcuts }
          : { ...current.settings.keyboardShortcuts },
      },
    }));
  };
  const selectedLaunchBehavior =
    APPLICATION_LAUNCH_BEHAVIOR_OPTIONS.find(
      (option) => option.value === state.settings.launchBehavior,
    ) ?? APPLICATION_LAUNCH_BEHAVIOR_OPTIONS[0];
  const selectedWorkspaceView =
    WORKSPACE_VIEW_OPTIONS.find(
      (option) => option.value === state.settings.defaultWorkspaceView,
    ) ?? WORKSPACE_VIEW_OPTIONS[0];
  const selectedDetailView =
    DOCUMENT_DETAIL_VIEW_MODE_OPTIONS.find(
      (option) => option.value === state.settings.documentDetailViewMode,
    ) ?? DOCUMENT_DETAIL_VIEW_MODE_OPTIONS[0];
  const selectedDocumentsVisualization =
    DOCUMENTS_VISUALIZATION_MODE_OPTIONS.find(
      (option) => option.value === state.settings.defaultDocumentsVisualization,
    ) ?? DOCUMENTS_VISUALIZATION_MODE_OPTIONS[0];
  const selectedDensity =
    DOCUMENT_TABLE_DENSITY_OPTIONS.find(
      (option) => option.value === state.settings.documentTableDensity,
    ) ?? DOCUMENT_TABLE_DENSITY_OPTIONS[0];
  const selectedTabDensity =
    WORKSPACE_TAB_DENSITY_OPTIONS.find(
      (option) => option.value === state.settings.workspaceTabDensity,
    ) ?? WORKSPACE_TAB_DENSITY_OPTIONS[0];
  const shortcutConflicts = getShortcutConflictActions(
    state.settings.keyboardShortcuts,
  );
  const hasShortcutConflicts = shortcutConflicts.length > 0;
  const hasPendingUpdaterPreferenceChanges =
    state.settings.autoUpdateEnabled !== persistedSettings.autoUpdateEnabled ||
    state.settings.checkForUpdatesOnLaunch !==
      persistedSettings.checkForUpdatesOnLaunch;
  const canCheckForUpdates =
    persistedSettings.autoUpdateEnabled &&
    !hasPendingUpdaterPreferenceChanges &&
    appUpdateState?.isSupported !== false &&
    appUpdateState?.status !== "checking" &&
    appUpdateState?.status !== "downloading";
  const canDownloadUpdate =
    persistedSettings.autoUpdateEnabled &&
    !hasPendingUpdaterPreferenceChanges &&
    appUpdateState?.status === "available";
  const canInstallUpdate =
    persistedSettings.autoUpdateEnabled &&
    !hasPendingUpdaterPreferenceChanges &&
    appUpdateState?.status === "downloaded";
  const appUpdateStatusMeta = getAppUpdateStatusMeta(appUpdateState?.status);
  const AppUpdateStatusIcon = appUpdateStatusMeta.icon;
  const checkForUpdatesLabel =
    appUpdateState?.status === "checking"
      ? "Checking..."
      : "Check for Updates";
  const downloadUpdateLabel =
    appUpdateState?.status === "downloading"
      ? appUpdateState.progress
        ? `Downloading ${Math.round(
            getAppUpdateProgressPercent(appUpdateState.progress),
          )}%`
        : "Preparing Download..."
      : "Download Update";
  const showDownloadProgress =
    appUpdateState?.status === "downloading" ||
    Boolean(appUpdateState?.progress);

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(
          open ? { ...state, open } : defaultApplicationSettingsDialogState,
        )
      }
    >
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize how DocTrack looks, launches, and behaves across every
            workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
            <SettingsSection
              title="Appearance"
              description="Set the look and feel for the whole app."
            >
              <div className="grid gap-2">
                <div className="text-[13px] font-medium text-foreground/90">
                  Theme
                </div>
                <ThemeToggle
                  themeMode={state.settings.themeMode}
                  onChange={(themeMode) => updateSettings({ themeMode })}
                />
                <div className="text-xs text-muted-foreground">
                  Theme changes preview immediately while this modal is open.
                  Save to keep them.
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Startup & Navigation"
              description="Choose where DocTrack starts and which workspace view opens first."
            >
              <Field label="Launch Behavior">
                <Select
                  value={state.settings.launchBehavior}
                  onChange={(event) =>
                    updateSettings({
                      launchBehavior: event.target
                        .value as ApplicationSettings["launchBehavior"],
                    })
                  }
                >
                  {APPLICATION_LAUNCH_BEHAVIOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedLaunchBehavior.description}
                </div>
              </Field>

              <Field label="Default Workspace View">
                <Select
                  value={state.settings.defaultWorkspaceView}
                  onChange={(event) =>
                    updateSettings({
                      defaultWorkspaceView: event.target
                        .value as ApplicationSettings["defaultWorkspaceView"],
                    })
                  }
                >
                  {WORKSPACE_VIEW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedWorkspaceView.description}
                </div>
              </Field>
            </SettingsSection>

            <SettingsSection
              title="Creation Defaults"
              description="Pre-fill common choices when users create workspaces and documents."
            >
              <ToggleSetting
                title="Seed starter data in new workspaces"
                description="New workspace dialogs start with example document types and sample documents enabled."
                checked={state.settings.defaultIncludeExampleData}
                onChange={(checked) =>
                  updateSettings({ defaultIncludeExampleData: checked })
                }
              />

              <Field label="Default Document Version Scheme">
                <Select
                  value={state.settings.defaultDocumentVersionScheme}
                  onChange={(event) =>
                    updateSettings({
                      defaultDocumentVersionScheme: event.target
                        .value as ApplicationSettings["defaultDocumentVersionScheme"],
                    })
                  }
                >
                  {Object.entries(DOCUMENT_VERSION_SCHEME_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
            </SettingsSection>

            <SettingsSection
              title="Workspace Interface"
              description="Tune document detail presentation and workspace tab density."
            >
              <Field label="Default Documents View">
                <Select
                  value={state.settings.defaultDocumentsVisualization}
                  onChange={(event) =>
                    updateSettings({
                      defaultDocumentsVisualization: event.target
                        .value as ApplicationSettings["defaultDocumentsVisualization"],
                    })
                  }
                >
                  {DOCUMENTS_VISUALIZATION_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedDocumentsVisualization.description}
                </div>
              </Field>

              <Field label="Document Detail View">
                <Select
                  value={state.settings.documentDetailViewMode}
                  onChange={(event) =>
                    updateSettings({
                      documentDetailViewMode: event.target
                        .value as DocumentDetailViewMode,
                    })
                  }
                >
                  {DOCUMENT_DETAIL_VIEW_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedDetailView.description}
                </div>
              </Field>

              <Field label="Workspace Tab Density">
                <Select
                  value={state.settings.workspaceTabDensity}
                  onChange={(event) =>
                    updateSettings({
                      workspaceTabDensity: event.target
                        .value as ApplicationSettings["workspaceTabDensity"],
                    })
                  }
                >
                  {WORKSPACE_TAB_DENSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedTabDensity.description}
                </div>
              </Field>
            </SettingsSection>

            <SettingsSection
              title="Table & Display"
              description="Tune how dense the main document workspace feels."
            >
              <Field label="Document Table Density">
                <Select
                  value={state.settings.documentTableDensity}
                  onChange={(event) =>
                    updateSettings({
                      documentTableDensity: event.target
                        .value as ApplicationSettings["documentTableDensity"],
                    })
                  }
                >
                  {DOCUMENT_TABLE_DENSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {selectedDensity.description}
                </div>
              </Field>
            </SettingsSection>

            <SettingsSection
              title="Keyboard Shortcuts"
              description="Record custom shortcuts for common app actions or clear one to disable it."
            >
              {hasShortcutConflicts ? (
                <div className="rounded-xl border border-[#F0D5D3] bg-[#FFF7F6] px-3 py-2 text-[13px] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21]/60 dark:text-[#FFB7B2]">
                  Duplicate shortcuts found. Each action needs a unique shortcut
                  before you can save.
                </div>
              ) : null}

              <div className="grid gap-3">
                {KEYBOARD_SHORTCUT_ACTIONS.map((action) => (
                  <ShortcutSettingRow
                    key={action}
                    action={action}
                    shortcut={state.settings.keyboardShortcuts[action]}
                    isConflicting={shortcutConflicts.includes(action)}
                    isMacOs={isMacOs}
                    onChange={(shortcut) =>
                      updateSettings({
                        keyboardShortcuts: {
                          ...state.settings.keyboardShortcuts,
                          [action]: shortcut,
                        },
                      })
                    }
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              title="Feedback & Safety"
              description="Control confirmation prompts and how long success messages stay visible."
            >
              <ToggleSetting
                title="Confirm destructive actions"
                description="Ask before deleting document types or version files."
                checked={state.settings.confirmDestructiveActions}
                onChange={(checked) =>
                  updateSettings({ confirmDestructiveActions: checked })
                }
              />

              <ToggleSetting
                title="Auto-dismiss success notifications"
                description="Success messages fade away automatically while error messages stay visible."
                checked={state.settings.autoDismissSuccessNotifications}
                onChange={(checked) =>
                  updateSettings({ autoDismissSuccessNotifications: checked })
                }
              />
            </SettingsSection>

            <SettingsSection
              title="Updates"
              description="Manage packaged app updates and choose when DocTrack checks for new releases."
            >
              <ToggleSetting
                title="Enable automatic updates"
                description="Allow DocTrack to look for packaged app updates."
                checked={state.settings.autoUpdateEnabled}
                onChange={(checked) =>
                  updateSettings({ autoUpdateEnabled: checked })
                }
              />

              <ToggleSetting
                title="Check for updates on launch"
                description="Packaged builds check once shortly after startup and still ask before downloading."
                checked={state.settings.checkForUpdatesOnLaunch}
                onChange={(checked) =>
                  updateSettings({ checkForUpdatesOnLaunch: checked })
                }
              />

              <div className="rounded-xl border border-border bg-card p-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Packaged app updates
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      appUpdateStatusMeta.className,
                    )}
                  >
                    <AppUpdateStatusIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        appUpdateStatusMeta.iconClassName,
                      )}
                    />
                    {appUpdateStatusMeta.label}
                  </div>
                </div>

                <div className="mt-3 text-sm text-muted-foreground">
                  {appUpdateState?.message ??
                    "Loading the application update status."}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Installed
                    </div>
                    <div className="mt-1 font-mono text-sm text-foreground">
                      {appUpdateState?.currentVersion ?? "Loading..."}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Latest release
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      {appUpdateState?.release
                        ? appUpdateState.release.releaseName ??
                          appUpdateState.release.version
                        : "No release selected"}
                    </div>
                    {appUpdateState?.release?.releaseDate ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(appUpdateState.release.releaseDate)}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Last checked
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      {appUpdateState?.lastCheckedAt
                        ? formatDateTime(appUpdateState.lastCheckedAt)
                        : "Not checked yet"}
                    </div>
                    {appUpdateState?.lastCheckSource ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Source:{" "}
                        {appUpdateState.lastCheckSource === "launch"
                          ? "Launch check"
                          : "Manual check"}
                      </div>
                    ) : null}
                  </div>
                </div>

                {showDownloadProgress ? (
                  <AppUpdateDownloadProgress
                    className="mt-4"
                    progress={appUpdateState?.progress ?? null}
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="w-full sm:w-auto"
                    variant="outline"
                    disabled={!canCheckForUpdates}
                    onClick={() => void onCheckForUpdates()}
                  >
                    {appUpdateState?.status === "checking" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" />
                    )}
                    {checkForUpdatesLabel}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    variant="outline"
                    disabled={!canDownloadUpdate}
                    onClick={() => void onDownloadUpdate()}
                  >
                    {appUpdateState?.status === "downloading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {downloadUpdateLabel}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={!canInstallUpdate}
                    onClick={() => onInstallUpdate()}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Install and Restart
                  </Button>
                </div>

                {!persistedSettings.autoUpdateEnabled ? (
                  <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Automatic updates are disabled in the saved settings. Enable
                    them and save before checking for new builds.
                  </div>
                ) : null}

                {hasPendingUpdaterPreferenceChanges ? (
                  <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    {APP_UPDATE_MANUAL_ACTION_MESSAGE}
                  </div>
                ) : null}

              </div>
            </SettingsSection>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={() => onStateChange(defaultApplicationSettingsDialogState)}
          >
            Cancel
          </Button>
          <Button
            disabled={state.isSubmitting || hasShortcutConflicts}
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutSettingRow({
  action,
  shortcut,
  isConflicting,
  isMacOs,
  onChange,
}: {
  action: KeyboardShortcutAction;
  shortcut: KeyboardShortcutValue;
  isConflicting: boolean;
  isMacOs: boolean;
  onChange: (shortcut: KeyboardShortcutValue) => void;
}) {
  const detail = KEYBOARD_SHORTCUT_ACTION_DETAILS[action];

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            {detail.label}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {detail.description}
          </div>
          {isConflicting ? (
            <div className="mt-2 text-xs font-medium text-[#C4554D] dark:text-[#FFB7B2]">
              This shortcut is duplicated by another action.
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShortcutRecorderInput
            shortcut={shortcut}
            isMacOs={isMacOs}
            onChange={onChange}
          />
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange(DEFAULT_KEYBOARD_SHORTCUTS[action])}
          >
            Reset
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Current: {formatShortcutForDisplay(shortcut, { isMacOs })}
      </div>
    </div>
  );
}

function ShortcutRecorderInput({
  shortcut,
  isMacOs,
  onChange,
}: {
  shortcut: KeyboardShortcutValue;
  isMacOs: boolean;
  onChange: (shortcut: KeyboardShortcutValue) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <Input
      readOnly
      aria-label="Shortcut"
      value={
        isRecording
          ? "Press keys..."
          : formatShortcutForDisplay(shortcut, { isMacOs })
      }
      className={cn(
        "w-[180px] cursor-text",
        isRecording && "border-ring ring-2 ring-ring",
      )}
      onFocus={() => setIsRecording(true)}
      onBlur={() => setIsRecording(false)}
      onKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();

        if (event.key === "Escape") {
          setIsRecording(false);
          return;
        }

        const shortcutValue = getShortcutFromKeyboardEvent(event.nativeEvent);
        if (shortcutValue) {
          onChange(shortcutValue);
          setIsRecording(false);
        }
      }}
    />
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="pb-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">
          {description}
        </div>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px]",
        disabled && "opacity-70",
      )}
    >
      <input
        checked={checked}
        className="mt-1"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function NotificationBar({
  tone,
  message,
  onClose,
}: {
  tone: NotificationTone;
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "window-no-drag fixed left-1/2 top-4 z-[80] flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between rounded-xl border px-3 py-2 text-[13px] shadow-lg",
        tone === "success"
          ? "border-[#CFE3D5] bg-[#F6FBF7] text-[#2F6B48] dark:border-[#35503F] dark:bg-[#1F2E25] dark:text-[#8FD9A8]"
          : "border-[#F0D5D3] bg-[#FFF7F6] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21] dark:text-[#FFB7B2]",
      )}
    >
      <div>{message}</div>
      <button
        aria-label="Dismiss notification"
        className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function InlineAlert({
  tone,
  message,
}: {
  tone: "warning" | "error";
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-[13px]",
        tone === "warning"
          ? "border-[#E6D6A8] bg-[#FBF7EA] text-[#8F6400] dark:border-[#5D4920] dark:bg-[#332717]/60 dark:text-[#EBCB8B]"
          : "border-[#F0D5D3] bg-[#FFF7F6] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21]/60 dark:text-[#FFB7B2]",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>{message}</div>
      </div>
    </div>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  disabled,
  attentionCount,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  active?: boolean;
  disabled?: boolean;
  attentionCount?: number;
  onClick: () => void;
}) {
  const hasAttention = Boolean(attentionCount && attentionCount > 0);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
        active
          ? hasAttention
            ? "bg-destructive/10 text-destructive"
            : "bg-accent text-foreground"
          : hasAttention
            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="min-w-0 flex-1 text-left">{label}</span>
      {hasAttention ? (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <Badge variant="destructive" className="px-1.5 py-0.5">
            {attentionCount}
          </Badge>
        </span>
      ) : null}
    </button>
  );
}

function Shortcut({ hint, label }: { hint: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="rounded-md border border-border bg-card px-1.5 py-1 font-mono text-[11px] text-muted-foreground">
        {hint}
      </span>
    </div>
  );
}

function WelcomeView({
  recentWorkspaces,
  onCreateWorkspace,
  onOpenWorkspace,
  onOpenRecent,
  onDismissRecent,
}: {
  recentWorkspaces: Array<{
    rootPath: string;
    name: string;
    lastOpenedDate: string;
  }>;
  onCreateWorkspace: () => void;
  onOpenWorkspace: () => void;
  onOpenRecent: (rootPath: string) => void;
  onDismissRecent: (rootPath: string) => void;
}) {
  return (
    <div className="grid h-full gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
          Keep every document, version, and status inside a portable offline
          workspace.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Create a new workspace folder or reopen an existing one. Each
          workspace opens in its own tab, with document tables, version history,
          and type configuration ready to go.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" onClick={onCreateWorkspace}>
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>
          <Button size="lg" variant="outline" onClick={onOpenWorkspace}>
            <FolderOpen className="h-4 w-4" />
            Open Existing Workspace
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Recent Workspaces</div>
            <div className="text-[13px] text-muted-foreground">
              Fast re-entry into the last offline workspaces you touched
            </div>
          </div>
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-4 space-y-2">
          {recentWorkspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-3 py-4 text-[13px] text-muted-foreground">
              No recent workspaces yet. Your newly created workspaces will
              appear here.
            </div>
          ) : (
            recentWorkspaces.map((workspace) => (
              <div
                key={workspace.rootPath}
                className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 transition hover:bg-accent"
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onOpenRecent(workspace.rootPath)}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {workspace.name}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {workspace.rootPath}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Last opened {formatDateTime(workspace.lastOpenedDate)}
                  </div>
                </button>
                <button
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-card hover:text-foreground"
                  aria-label={`Dismiss ${workspace.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDismissRecent(workspace.rootPath);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardView({
  workspace,
  onOpenDocuments,
  onOpenDocument,
  onApplySavedView,
  onUpdateDashboardLayout,
  onPromoteSavedViewToShared,
  onShowAllActivity,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onOpenDocuments: (drilldown: {
    status?: DocumentStatus | "Not started";
    groupFilter?: string;
    projectFilter?: string;
    healthFlag?: DocumentHealthFlag;
  }) => void;
  onOpenDocument: (documentRecordId: number) => void;
  onApplySavedView: (savedView: SavedView) => void;
  onUpdateDashboardLayout: (
    input: UpdateDashboardLayoutInput,
  ) => Promise<DashboardLayout>;
  onPromoteSavedViewToShared: (
    input: PromoteSavedViewToSharedInput,
  ) => Promise<PromoteSavedViewToSharedResult>;
  onShowAllActivity: () => void;
}) {
  const filesystemAttention = getWorkspaceFilesystemAttentionCounts(workspace);
  const hasFilesystemAttention = filesystemAttention.totalAttentionCount > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    normalizeDashboardLayout(workspace.dashboardLayout),
  );
  const [widgetDialog, setWidgetDialog] = useState<{
    open: boolean;
    type: DashboardWidgetType;
    title: string;
    savedViewId: string;
    isSubmitting: boolean;
    validationErrors: ValidationErrors;
  }>({
    open: false,
    type: "savedView",
    title: "",
    savedViewId: "",
    isSubmitting: false,
    validationErrors: {},
  });
  const [interaction, setInteraction] = useState<{
    widgetId: string;
    mode: "drag" | "resize";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
    previewLeft: number;
    previewTop: number;
    previewWidth: number;
    previewHeight: number;
    pointerOffsetX: number;
    pointerOffsetY: number;
    resizeDirection?: {
      top: boolean;
      right: boolean;
      bottom: boolean;
      left: boolean;
    };
  } | null>(null);
  const layoutRef = useRef(layout);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragPointerRef = useRef<{ clientX: number; clientY: number } | null>(
    null,
  );
  const savedViewsById = useMemo(
    () =>
      Object.fromEntries(workspace.savedViews.map((item) => [item.id, item])),
    [workspace.savedViews],
  );
  const draggedWidget =
    interaction?.mode === "drag"
      ? (layout.widgets.find((widget) => widget.id === interaction.widgetId) ??
        null)
      : null;

  useEffect(() => {
    const normalized = normalizeDashboardLayout(workspace.dashboardLayout);
    layoutRef.current = normalized;
    setLayout(normalized);
  }, [workspace.dashboardLayout]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (!isEditing) {
      setInteraction(null);
      dragPointerRef.current = null;
    }
  }, [isEditing]);

  useEffect(() => {
    if (!interaction) {
      return;
    }

    const updateInteractionFromPointer = (clientX: number, clientY: number) => {
      const container = gridRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const columnWidth = rect.width / DASHBOARD_GRID_COLUMNS || 1;
      const deltaColumns = Math.round(
        (clientX - interaction.startX) / columnWidth,
      );
      const deltaRows = Math.round(
        (clientY - interaction.startY) / DASHBOARD_GRID_ROW_HEIGHT,
      );

      let nextLeft = interaction.previewLeft;
      let nextTop = interaction.previewTop;
      if (interaction.mode === "drag") {
        nextLeft = clientX - interaction.pointerOffsetX;
        nextTop = clientY - interaction.pointerOffsetY;
        setInteraction((current) =>
          current && current.widgetId === interaction.widgetId
            ? {
                ...current,
                previewLeft: nextLeft,
                previewTop: nextTop,
              }
            : current,
        );
      }

      setLayout((current) => {
        const nextWidgets = current.widgets.map((widget) => {
          if (widget.id !== interaction.widgetId) {
            return widget;
          }

          if (interaction.mode === "drag") {
            return {
              ...widget,
              x: clampNumber(
                Math.round(
                  (nextLeft - rect.left + interaction.previewWidth / 2) /
                    columnWidth -
                    widget.w / 2,
                ),
                0,
                DASHBOARD_GRID_COLUMNS - widget.w,
              ),
              y: Math.max(
                0,
                Math.round(
                  (nextTop - rect.top + interaction.previewHeight / 2) /
                    DASHBOARD_GRID_ROW_HEIGHT -
                    widget.h / 2,
                ),
              ),
            };
          }

          const direction = interaction.resizeDirection ?? {
            top: false,
            right: true,
            bottom: true,
            left: false,
          };
          let nextX = interaction.originX;
          let nextY = interaction.originY;
          let nextW = interaction.originW;
          let nextH = interaction.originH;

          if (direction.left) {
            nextX = clampNumber(
              interaction.originX + deltaColumns,
              0,
              interaction.originX +
                interaction.originW -
                DASHBOARD_WIDGET_MIN_WIDTH,
            );
            nextW = interaction.originW + (interaction.originX - nextX);
          }

          if (direction.right) {
            nextW = clampNumber(
              interaction.originW + deltaColumns,
              DASHBOARD_WIDGET_MIN_WIDTH,
              DASHBOARD_GRID_COLUMNS - nextX,
            );
          }

          if (direction.top) {
            nextY = Math.max(
              0,
              Math.min(
                interaction.originY + deltaRows,
                interaction.originY +
                  interaction.originH -
                  DASHBOARD_WIDGET_MIN_HEIGHT,
              ),
            );
            nextH = interaction.originH + (interaction.originY - nextY);
          }

          if (direction.bottom) {
            nextH = Math.max(
              DASHBOARD_WIDGET_MIN_HEIGHT,
              interaction.originH + deltaRows,
            );
          }

          return {
            ...widget,
            x: nextX,
            y: nextY,
            w: nextW,
            h: nextH,
          };
        });

        return {
          widgets: resolveDashboardLayoutConflicts(nextWidgets, {
            prioritizedWidgetId: interaction.widgetId,
          }),
        };
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      updateInteractionFromPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      const nextLayout = normalizeDashboardLayout(layoutRef.current);
      setInteraction(null);
      dragPointerRef.current = null;
      void onUpdateDashboardLayout({ layout: nextLayout }).catch(
        () => undefined,
      );
    };

    let autoScrollFrameId: number | null = null;
    const runAutoScroll = () => {
      if (interaction.mode !== "drag") {
        return;
      }

      const pointer = dragPointerRef.current;
      if (pointer) {
        const threshold = 96;
        const topDistance = pointer.clientY;
        const bottomDistance = window.innerHeight - pointer.clientY;
        let scrollDelta = 0;

        if (topDistance < threshold) {
          scrollDelta = -Math.max(
            10,
            Math.round((threshold - topDistance) / 4),
          );
        } else if (bottomDistance < threshold) {
          scrollDelta = Math.max(
            10,
            Math.round((threshold - bottomDistance) / 4),
          );
        }

        if (scrollDelta !== 0) {
          const previousScrollY = window.scrollY;
          try {
            window.scrollBy(0, scrollDelta);
          } catch {
            // JSDOM does not implement scrolling; ignore in tests.
          }

          if (window.scrollY !== previousScrollY) {
            updateInteractionFromPointer(pointer.clientX, pointer.clientY);
          }
        }
      }

      autoScrollFrameId = window.requestAnimationFrame(runAutoScroll);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    if (interaction.mode === "drag") {
      autoScrollFrameId = window.requestAnimationFrame(runAutoScroll);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (autoScrollFrameId !== null) {
        window.cancelAnimationFrame(autoScrollFrameId);
      }
    };
  }, [interaction, onUpdateDashboardLayout]);

  const beginWidgetInteraction = (
    widget: DashboardWidget,
    mode: "drag" | "resize",
    event: React.PointerEvent<HTMLElement>,
    resizeDirection?: {
      top: boolean;
      right: boolean;
      bottom: boolean;
      left: boolean;
    },
  ) => {
    if (!isEditing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const widgetElement = gridRef.current?.querySelector<HTMLElement>(
      `[data-dashboard-widget-card="${widget.id}"]`,
    );
    const widgetRect = widgetElement?.getBoundingClientRect();
    if (mode === "drag") {
      dragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }
    setInteraction({
      widgetId: widget.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      originX: widget.x,
      originY: widget.y,
      originW: widget.w,
      originH: widget.h,
      previewLeft: widgetRect?.left ?? event.clientX - 160,
      previewTop: widgetRect?.top ?? event.clientY - 32,
      previewWidth: widgetRect?.width ?? 320,
      previewHeight: widgetRect?.height ?? widget.h * DASHBOARD_GRID_ROW_HEIGHT,
      pointerOffsetX: widgetRect ? event.clientX - widgetRect.left : 32,
      pointerOffsetY: widgetRect ? event.clientY - widgetRect.top : 24,
      resizeDirection,
    });
  };

  const handleWidgetPointerDown = (
    widget: DashboardWidget,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (!isEditing || interaction) {
      return;
    }

    if (shouldIgnoreDashboardDragStart(event.target)) {
      return;
    }

    beginWidgetInteraction(widget, "drag", event);
  };

  const handleDeleteWidget = (widgetId: string) => {
    const nextLayout = {
      widgets: layout.widgets.filter((widget) => widget.id !== widgetId),
    };
    setLayout(nextLayout);
    void onUpdateDashboardLayout({ layout: nextLayout }).catch(() => undefined);
  };

  const handleSubmitWidgetDialog = async () => {
    if (widgetDialog.type === "savedView" && !widgetDialog.savedViewId) {
      setWidgetDialog((current) => ({
        ...current,
        validationErrors: {
          savedViewId: "Choose a saved view to pin.",
        },
      }));
      return;
    }

    try {
      setWidgetDialog((current) => ({
        ...current,
        isSubmitting: true,
        validationErrors: {},
      }));

      let savedViewId: string | null = null;
      if (widgetDialog.type === "savedView") {
        const selectedSavedView = savedViewsById[widgetDialog.savedViewId];
        if (!selectedSavedView) {
          throw new Error("The selected saved view could not be found.");
        }

        if (selectedSavedView.scope === "shared") {
          savedViewId = selectedSavedView.id;
        } else {
          const result = await onPromoteSavedViewToShared({
            savedViewId: selectedSavedView.id,
          });
          savedViewId = result.savedView.id;
        }
      }

      const nextY = layout.widgets.reduce(
        (max, widget) => Math.max(max, widget.y + widget.h),
        0,
      );
      const nextWidget: DashboardWidget = {
        id: createClientId("dashboard-widget"),
        type: widgetDialog.type,
        title:
          widgetDialog.title.trim() ||
          (savedViewId && savedViewsById[widgetDialog.savedViewId]
            ? savedViewsById[widgetDialog.savedViewId]!.name
            : getDashboardWidgetTypeLabel(widgetDialog.type)),
        x: 0,
        y: nextY,
        w:
          widgetDialog.type === "recentActivity" ||
          widgetDialog.type === "statusSummary"
            ? 12
            : 4,
        h:
          widgetDialog.type === "filesystemAttention"
            ? 1
            : widgetDialog.type === "savedView"
              ? 2
              : 3,
        config: {},
        savedViewId,
      };
      const nextLayout = {
        widgets: resolveDashboardLayoutConflicts([
          ...layout.widgets,
          nextWidget,
        ]),
      };
      setLayout(nextLayout);
      await onUpdateDashboardLayout({ layout: nextLayout });
      setWidgetDialog({
        open: false,
        type: "savedView",
        title: "",
        savedViewId: "",
        isSubmitting: false,
        validationErrors: {},
      });
    } catch (error) {
      setWidgetDialog((current) => ({ ...current, isSubmitting: false }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              {workspace.workspace.name}
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Dashboard refreshed{" "}
              {formatDateTime(workspace.dashboard.generatedDate)}
            </div>
            {isEditing ? (
              <div className="mt-2 text-[13px] text-muted-foreground">
                Grab a card anywhere to move it, or drag an edge to resize it.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasFilesystemAttention ? (
              <Badge variant="destructive" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Action required
              </Badge>
            ) : null}
            <Badge variant="outline">
              {workspace.dashboard.totalDocuments} documents
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing((current) => !current)}
            >
              {isEditing ? "Done Editing" : "Edit Dashboard"}
            </Button>
            {isEditing ? (
              <Button
                size="sm"
                onClick={() =>
                  setWidgetDialog({
                    open: true,
                    type: "savedView",
                    title: "",
                    savedViewId: "",
                    isSubmitting: false,
                    validationErrors: {},
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add Widget
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {layout.widgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground shadow-sm">
          This dashboard is empty. Enter edit mode to add summary or saved-view
          widgets.
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${DASHBOARD_GRID_COLUMNS}, minmax(0, 1fr))`,
            gridAutoRows: `${DASHBOARD_GRID_ROW_HEIGHT}px`,
          }}
        >
          {layout.widgets.map((widget) => {
            const savedView =
              widget.savedViewId !== null
                ? savedViewsById[widget.savedViewId]
                : undefined;
            const savedViewRows =
              widget.type === "savedView" && savedView
                ? sortDocumentsBySavedView(
                    filterDocumentsBySavedViewQuery(
                      workspace.documents,
                      savedView.query,
                    ),
                    savedView.presentation.sorting,
                  ).slice(0, SAVED_VIEW_WIDGET_PREVIEW_LIMIT)
                : [];
            const isDraggingWidget =
              interaction?.mode === "drag" &&
              interaction.widgetId === widget.id;
            const isResizingWidget =
              interaction?.mode === "resize" &&
              interaction.widgetId === widget.id;
            const interactionLocked =
              interaction !== null && interaction.widgetId !== widget.id;

            return (
              <section
                key={widget.id}
                data-dashboard-widget-card={widget.id}
                className={cn(
                  "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition",
                  isEditing && "select-none",
                  isEditing && !interactionLocked && "cursor-grab",
                  isDraggingWidget && "cursor-grabbing",
                  isDraggingWidget &&
                    "border-dashed border-blue-500/50 bg-blue-500/5 shadow-inner",
                  isResizingWidget && "ring-2 ring-blue-500/20",
                )}
                style={{
                  gridColumn: `${widget.x + 1} / span ${widget.w}`,
                  gridRow: `${widget.y + 1} / span ${widget.h}`,
                }}
                onPointerDown={(event) =>
                  handleWidgetPointerDown(widget, event)
                }
              >
                {isDraggingWidget ? (
                  <div className="flex h-full flex-1 items-center justify-center rounded-xl border-2 border-dashed border-blue-500/50 bg-background/70 px-4 text-center text-sm font-medium text-blue-700">
                    Release to place this card here
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {widget.title}
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {widget.type === "savedView"
                            ? savedView
                              ? `${savedView.scope === "shared" ? "Shared" : "Personal"} saved view`
                              : "Saved view widget"
                            : getDashboardWidgetTypeLabel(widget.type)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {widget.type === "recentActivity" &&
                        workspace.settings.activityLogEnabled ? (
                          <button
                            type="button"
                            className="text-[12px] font-medium text-blue-600 transition hover:text-blue-700"
                            onClick={onShowAllActivity}
                          >
                            Show all
                          </button>
                        ) : null}
                        {isEditing ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteWidget(widget.id)}
                            disabled={interactionLocked}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto pr-1">
                      {widget.type === "filesystemAttention" ? (
                        hasFilesystemAttention ? (
                          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                            <div className="text-sm font-semibold">
                              {filesystemAttention.totalAttentionCount} document
                              {filesystemAttention.totalAttentionCount === 1
                                ? ""
                                : "s"}{" "}
                              need filesystem review
                            </div>
                            <div className="mt-1 text-[13px] text-destructive/90">
                              Open affected documents and use Review Files on
                              highlighted rows.
                            </div>
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  onOpenDocuments({
                                    healthFlag: "unmanagedPaths",
                                  })
                                }
                              >
                                Open affected documents
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                            No filesystem drift needs attention right now.
                          </div>
                        )
                      ) : null}

                      {widget.type === "statusSummary" ? (
                        <div className="grid gap-3 md:grid-cols-3">
                          {workspace.dashboard.countsByStatus.map((item) => (
                            <button
                              key={item.id}
                              className="rounded-xl border border-border bg-background p-3 text-left transition hover:bg-accent"
                              onClick={() =>
                                onOpenDocuments({ status: item.status })
                              }
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {item.label}
                              </div>
                              <div className="mt-2 text-2xl font-semibold">
                                {item.count}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {widget.type === "healthInsights" ? (
                        workspace.dashboard.healthInsights.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                            No document health issues detected right now.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {workspace.dashboard.healthInsights.map((item) => (
                              <button
                                key={item.id}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-xl border bg-background px-3 py-3 text-left transition",
                                  item.tone === "danger"
                                    ? "border-destructive/35 hover:bg-destructive/5"
                                    : "border-border hover:bg-accent",
                                )}
                                onClick={() =>
                                  onOpenDocuments({
                                    healthFlag: item.healthFlag,
                                  })
                                }
                              >
                                <div>
                                  <div className="text-sm font-semibold">
                                    {item.label}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Open the filtered documents table
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    item.tone === "danger"
                                      ? "destructive"
                                      : item.tone === "warning"
                                        ? "warning"
                                        : "outline"
                                  }
                                >
                                  {item.count}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        )
                      ) : null}

                      {widget.type === "typeGrouping" ? (
                        <div className="space-y-2">
                          {workspace.dashboard.countsByType.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
                            >
                              <span className="text-[13px]">{item.label}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {widget.type === "groupGrouping" ? (
                        <div className="space-y-2">
                          {workspace.dashboard.countsByGroup.map((item) => (
                            <button
                              key={item.id}
                              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:bg-accent"
                              onClick={() =>
                                onOpenDocuments({
                                  groupFilter:
                                    item.groupId === null
                                      ? ""
                                      : String(item.groupId),
                                })
                              }
                            >
                              <span className="text-[13px]">{item.label}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {widget.type === "projectGrouping" ? (
                        <div className="space-y-2">
                          {workspace.dashboard.countsByProject.map((item) => (
                            <button
                              key={item.id}
                              className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:bg-accent"
                              onClick={() =>
                                onOpenDocuments({
                                  projectFilter:
                                    item.projectId === null
                                      ? ""
                                      : String(item.projectId),
                                })
                              }
                            >
                              <span className="text-[13px]">{item.label}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {widget.type === "recentActivity" ? (
                        !workspace.settings.activityLogEnabled ? (
                          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                            {ACTIVITY_LOG_DISABLED_MESSAGE}
                          </div>
                        ) : workspace.dashboard.recentActivity.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                            No recent activity has been recorded yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {workspace.dashboard.recentActivity.map((item) => (
                              <button
                                key={item.id}
                                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left transition hover:bg-accent"
                                onClick={() =>
                                  item.documentRecordId &&
                                  onOpenDocument(item.documentRecordId)
                                }
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    {formatActivityEventTypeLabel(
                                      item.eventType,
                                    )}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDateTime(item.createdDate)}
                                  </div>
                                </div>
                                <div className="mt-2 text-[13px] font-medium">
                                  {item.message}
                                </div>
                              </button>
                            ))}
                          </div>
                        )
                      ) : null}

                      {widget.type === "savedView" ? (
                        !savedView ? (
                          <div className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-5 text-[13px] text-destructive">
                            The linked saved view is no longer available.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  savedView.scope === "shared"
                                    ? "outline"
                                    : "default"
                                }
                              >
                                {savedView.scope === "shared"
                                  ? "Shared"
                                  : "Personal"}
                              </Badge>
                              <Badge variant="outline">
                                {
                                  filterDocumentsBySavedViewQuery(
                                    workspace.documents,
                                    savedView.query,
                                  ).length
                                }{" "}
                                matches
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onApplySavedView(savedView)}
                              >
                                Open View
                              </Button>
                            </div>
                            {savedView.query.rules.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {savedView.query.rules.map((rule) => (
                                  <Badge key={rule.id} variant="outline">
                                    {formatSavedViewRuleSummary(rule)}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              {savedViewRows.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                                  No documents match this saved view right now.
                                </div>
                              ) : (
                                savedViewRows.map((document) => (
                                  <button
                                    key={document.id}
                                    className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:bg-accent"
                                    onClick={() => onOpenDocument(document.id)}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold">
                                        {document.title}
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {document.documentId} •{" "}
                                        {document.typeName}
                                      </div>
                                    </div>
                                    <Badge variant="outline">
                                      {document.status ?? "Not started"}
                                    </Badge>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>

                    {isEditing ? (
                      <>
                        {DASHBOARD_RESIZE_HANDLE_CONFIGS.map((handle) => (
                          <div
                            key={handle.id}
                            data-dashboard-resize-handle="true"
                            className={cn(
                              handle.className,
                              interactionLocked && "pointer-events-none",
                            )}
                            onPointerDown={(event) =>
                              beginWidgetInteraction(
                                widget,
                                "resize",
                                event,
                                handle.direction,
                              )
                            }
                            title="Resize card"
                          />
                        ))}
                        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-dashed border-blue-500/30" />
                      </>
                    ) : null}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {interaction?.mode === "drag" && draggedWidget ? (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: interaction.previewLeft,
            top: interaction.previewTop,
            width: interaction.previewWidth,
            height: interaction.previewHeight,
          }}
        >
          <div className="flex h-full flex-col rounded-2xl border border-blue-500/40 bg-card/95 p-4 shadow-2xl ring-1 ring-blue-500/15 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-blue-600" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {draggedWidget.title}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Release to place this card.
                </div>
              </div>
            </div>
            <div className="mt-4 flex-1 rounded-xl border border-dashed border-border/70 bg-background/70" />
          </div>
        </div>
      ) : null}

      <Dialog
        open={widgetDialog.open}
        onOpenChange={(open) =>
          setWidgetDialog((current) =>
            open
              ? current
              : {
                  open: false,
                  type: "savedView",
                  title: "",
                  savedViewId: "",
                  isSubmitting: false,
                  validationErrors: {},
                },
          )
        }
      >
        <DialogContent className="w-[min(92vw,520px)]">
          <DialogHeader>
            <DialogTitle>Add Dashboard Widget</DialogTitle>
            <DialogDescription>
              Build a shared dashboard with built-in summaries and pinned saved
              views.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Widget Type">
              <Select
                value={widgetDialog.type}
                onChange={(event) =>
                  setWidgetDialog((current) => ({
                    ...current,
                    type: event.target.value as DashboardWidgetType,
                    title:
                      event.target.value === "savedView"
                        ? current.title
                        : getDashboardWidgetTypeLabel(
                            event.target.value as DashboardWidgetType,
                          ),
                    validationErrors: {},
                  }))
                }
              >
                <option value="savedView">Saved View</option>
                <option value="filesystemAttention">
                  Filesystem Attention
                </option>
                <option value="statusSummary">Status Summary</option>
                <option value="healthInsights">Document Health</option>
                <option value="typeGrouping">Document Types</option>
                <option value="groupGrouping">Groups</option>
                <option value="projectGrouping">Projects</option>
                <option value="recentActivity">Recent Activity</option>
              </Select>
            </Field>
            {widgetDialog.type === "savedView" ? (
              <Field
                label="Saved View"
                error={widgetDialog.validationErrors.savedViewId}
              >
                <Select
                  value={widgetDialog.savedViewId}
                  onChange={(event) =>
                    setWidgetDialog((current) => ({
                      ...current,
                      savedViewId: event.target.value,
                      validationErrors: {},
                    }))
                  }
                >
                  <option value="">Choose a saved view</option>
                  {workspace.savedViews.map((savedView) => (
                    <option key={savedView.id} value={savedView.id}>
                      {savedView.name} ({savedView.scope})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Widget Title">
              <Input
                value={widgetDialog.title}
                onChange={(event) =>
                  setWidgetDialog((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Optional custom title"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={widgetDialog.isSubmitting}
              onClick={() =>
                setWidgetDialog({
                  open: false,
                  type: "savedView",
                  title: "",
                  savedViewId: "",
                  isSubmitting: false,
                  validationErrors: {},
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitWidgetDialog()}
              disabled={widgetDialog.isSubmitting}
            >
              {widgetDialog.isSubmitting ? "Adding..." : "Add Widget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const formatActivityEventTypeLabel = (eventType: string): string =>
  eventType
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

function DocumentsView({
  workspace,
  applicationSettings,
  isMacOs,
  documentTableDensity,
  documentViewState,
  documentsVisualizationMode,
  visibleTableColumns,
  savedViews,
  selectedDocumentDetail,
  isDetailLoading,
  onSelectDocument,
  onCloseDocumentDetail,
  onShowFiles,
  onRequestStatusChange,
  onRequestNewDocument,
  onExportDocuments,
  onDocumentsVisualizationModeChange,
  onOpenTableSettings,
  onRequestEditDocument,
  onRequestNewVersion,
  onRequestLatestVersionEdit,
  onRequestVersionEdit,
  onOpenRevisionDescription,
  onShowDocumentFolder,
  onShowVersionFiles,
  onRequestDeleteDocument,
  onRequestDeleteVersion,
  onUpdateSidebarWidth,
  onDocumentViewStateChange,
  onApplySavedView,
  onCreateSavedView,
  onUpdateSavedView,
  onDeleteSavedView,
  onDuplicateSavedView,
  onPromoteSavedViewToShared,
  onPinSavedViewToDashboard,
  documentExportDialogRequest,
  onDocumentExportDialogRequestConsumed,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  applicationSettings: ApplicationSettings;
  isMacOs: boolean;
  documentTableDensity: DocumentTableDensity;
  documentViewState: DocumentViewState;
  documentsVisualizationMode: DocumentsVisualizationMode;
  visibleTableColumns: DocumentTableColumn[];
  savedViews: SavedView[];
  selectedDocumentDetail: DocumentDetail | null;
  isDetailLoading: boolean;
  onSelectDocument: (documentRecordId: number) => void;
  onCloseDocumentDetail: () => void;
  onShowFiles: (
    documentRecordId: number,
    options?: { preferAffectedVersion?: boolean },
  ) => void;
  onRequestStatusChange: (
    document: DocumentListItem,
    nextStatus: DocumentStatus,
  ) => void;
  onRequestNewDocument: () => void;
  onExportDocuments: (request: DocumentExportRequest) => Promise<void>;
  onDocumentsVisualizationModeChange: (
    mode: DocumentsVisualizationMode,
  ) => void;
  onOpenTableSettings: () => void;
  onRequestEditDocument: (documentRecordId?: number) => void;
  onRequestNewVersion: () => void;
  onRequestLatestVersionEdit: (documentRecordId?: number) => void;
  onRequestVersionEdit: (documentVersionId: number) => void;
  onOpenRevisionDescription: (title: string, content: string) => void;
  onShowDocumentFolder: () => void;
  onShowVersionFiles: (documentVersionId: number) => void;
  onRequestDeleteDocument: (documentRecordId?: number) => void;
  onRequestDeleteVersion: (documentVersionId: number) => void;
  onUpdateSidebarWidth: (nextWidth: number) => Promise<void>;
  onDocumentViewStateChange: (
    updater:
      | DocumentViewState
      | ((current: DocumentViewState) => DocumentViewState),
  ) => void;
  onApplySavedView: (savedView: SavedView) => void;
  onCreateSavedView: (input: CreateSavedViewInput) => Promise<SavedView>;
  onUpdateSavedView: (
    savedViewId: string,
    scope: SavedView["scope"],
    input: UpdateSavedViewInput,
  ) => Promise<SavedView>;
  onDeleteSavedView: (input: DeleteSavedViewInput) => Promise<void>;
  onDuplicateSavedView: (input: DuplicateSavedViewInput) => Promise<SavedView>;
  onPromoteSavedViewToShared: (
    input: PromoteSavedViewToSharedInput,
  ) => Promise<PromoteSavedViewToSharedResult>;
  onPinSavedViewToDashboard: (savedView: SavedView) => Promise<void>;
  documentExportDialogRequest: DocumentExportDialogRequestState | null;
  onDocumentExportDialogRequestConsumed: () => void;
}) {
  const fallbackSortingColumn = visibleTableColumns.includes("modifiedDate")
    ? "modifiedDate"
    : (visibleTableColumns[0] ?? "documentId");
  const [exportDialog, setExportDialog] = useState(
    defaultDocumentExportDialogState,
  );
  const [savedViewDialog, setSavedViewDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    savedView?: SavedView;
    name: string;
    scope: SavedView["scope"];
    isSubmitting: boolean;
    validationErrors: ValidationErrors;
  }>({
    open: false,
    mode: "create",
    name: "",
    scope: "personal",
    isSubmitting: false,
    validationErrors: {},
  });
  const [savedViewsDialogOpen, setSavedViewsDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(
    applicationSettings.documentDetailSidebarWidth,
  );
  const [isSidebarEntered, setIsSidebarEntered] = useState(false);
  const availableColumns = workspace.settings.visibleDocumentColumns;
  const groupFeatureEnabled = availableColumns.includes("group");
  const projectFeatureEnabled = availableColumns.includes("project");
  const deferredSearch = useDeferredValue(documentViewState.search);
  const detailViewMode = applicationSettings.documentDetailViewMode;
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [calendarMonthKey, setCalendarMonthKey] = useState(() =>
    getMonthKeyForDate(new Date()),
  );
  const [draggedDocumentId, setDraggedDocumentId] = useState<number | null>(
    null,
  );
  const [kanbanDropStatus, setKanbanDropStatus] =
    useState<DocumentStatus | null>(null);
  const hasSelectedDocument = Boolean(workspace.selectedDocumentRecordId);
  const isSidebarOpen = detailViewMode === "sidebar" && hasSelectedDocument;
  const isTableView = documentsVisualizationMode === "table";
  const headerCellClassName =
    documentTableDensity === "compact"
      ? "whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
      : "whitespace-nowrap px-3 py-2.5 text-left font-medium text-muted-foreground";
  const bodyCellClassName =
    documentTableDensity === "compact"
      ? "px-3 py-2 align-middle"
      : "px-3 py-2.5 align-middle";
  const emptyStateClassName =
    documentTableDensity === "compact"
      ? "px-6 py-10 text-center text-muted-foreground"
      : "px-6 py-12 text-center text-muted-foreground";
  const sorting = useMemo<SortingState>(() => {
    const currentSorting = documentViewState.sorting.map((entry) => ({
      id: entry.column,
      desc: entry.desc,
    }));
    if (
      currentSorting.length > 0 &&
      currentSorting.every((entry) =>
        visibleTableColumns.includes(entry.id as DocumentTableColumn),
      )
    ) {
      return currentSorting;
    }

    return [
      {
        id: fallbackSortingColumn,
        desc: fallbackSortingColumn === "modifiedDate",
      },
    ];
  }, [documentViewState.sorting, fallbackSortingColumn, visibleTableColumns]);

  const statusOptions = useMemo(
    () => ["All", "Not started", ...workspace.statuses] as const,
    [workspace.statuses],
  );
  const exportGroupingOptions = useMemo(
    () => getDocumentExportGroupingOptions(availableColumns),
    [availableColumns],
  );
  const latestVersion = selectedDocumentDetail?.versions[0] ?? null;

  useEffect(() => {
    setExportDialog((current) => {
      if (
        exportGroupingOptions.some((option) => option.value === current.groupBy)
      ) {
        return current;
      }

      return {
        ...current,
        groupBy: exportGroupingOptions[0]?.value ?? "none",
      };
    });
  }, [exportGroupingOptions]);

  useEffect(() => {
    if (
      !documentExportDialogRequest ||
      documentExportDialogRequest.workspacePath !== workspace.workspace.rootPath
    ) {
      return;
    }

    setExportDialog({
      ...defaultDocumentExportDialogState,
      open: true,
      format: documentExportDialogRequest.format,
      scope: documentExportDialogRequest.scope,
    });
    onDocumentExportDialogRequestConsumed();
  }, [
    documentExportDialogRequest,
    onDocumentExportDialogRequestConsumed,
    workspace.workspace.rootPath,
  ]);

  useEffect(() => {
    const appWidth = window.innerWidth;
    const minWidth =
      (appWidth * DOCUMENT_DETAIL_SIDEBAR_MIN_WIDTH_PERCENT) / 100;
    const maxWidth =
      (appWidth * DOCUMENT_DETAIL_SIDEBAR_MAX_WIDTH_PERCENT) / 100;

    setSidebarWidth(() =>
      appWidth > 0
        ? Math.max(
            minWidth,
            Math.min(maxWidth, applicationSettings.documentDetailSidebarWidth),
          )
        : applicationSettings.documentDetailSidebarWidth,
    );
  }, [applicationSettings.documentDetailSidebarWidth]);

  useEffect(() => {
    if (!isSidebarOpen) {
      setIsSidebarEntered(false);
      return;
    }

    setIsSidebarEntered(false);
    const frame = window.requestAnimationFrame(() => {
      setIsSidebarEntered(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSidebarOpen]);

  useEffect(() => {
    setCalendarMonthKey(getMonthKeyForDate(new Date()));
    setDraggedDocumentId(null);
    setKanbanDropStatus(null);
    timelineSectionRefs.current = {};
  }, [workspace.workspace.rootPath]);

  const filteredDocuments = useMemo(
    () =>
      filterDocumentsBySavedViewQuery(workspace.documents, {
        search: deferredSearch.trim(),
        statusFilter: documentViewState.statusFilter,
        groupFilter: groupFeatureEnabled ? documentViewState.groupFilter : "All",
        projectFilter: projectFeatureEnabled
          ? documentViewState.projectFilter
          : "All",
        healthFilter: documentViewState.healthFilter,
        rules: documentViewState.rules,
      }),
    [
      deferredSearch,
      documentViewState.healthFilter,
      documentViewState.groupFilter,
      documentViewState.projectFilter,
      documentViewState.rules,
      documentViewState.statusFilter,
      groupFeatureEnabled,
      projectFeatureEnabled,
      workspace.documents,
    ],
  );

  const getSortValue = (
    document: DocumentListItem,
    column: DocumentTableColumn,
  ): string | number => {
    switch (column) {
      case "documentId":
        return document.documentId;
      case "title":
        return document.title;
      case "documentType":
        return document.typeName;
      case "version":
        return document.latestVersionLabel ?? "";
      case "status":
        return document.status ?? "";
      case "author":
        return document.author;
      case "language":
        return document.languageCode ?? "";
      case "confidentialityClass":
        return document.confidentialityClassName ?? "";
      case "group":
        return document.groupName ?? "";
      case "project":
        return document.projectName ?? "";
      case "company":
        return document.company;
      case "department":
        return document.department;
      case "startDate":
        return document.startDate;
      case "createdDate":
        return document.createdDate;
      case "modifiedDate":
        return document.modifiedDate;
      case "releasedDate":
        return document.releasedDate ?? "";
      case "reviewedBy":
        return document.reviewedBy;
      case "approvedBy":
        return document.approvedBy;
      case "revisionIntervalMonths":
        return document.revisionIntervalMonths ?? -1;
      case "revisionDescription":
        return document.revisionDescription;
    }
  };

  const compareSortValues = (
    left: string | number,
    right: string | number,
  ): number => {
    if (typeof left === "number" || typeof right === "number") {
      return Number(left) - Number(right);
    }

    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const columns = useMemo<Array<ColumnDef<DocumentListItem>>>(() => {
    const fixedColumns: Array<
      ColumnDef<DocumentListItem> & { id: DocumentTableColumn }
    > = [
      {
        id: "documentId",
        accessorKey: "documentId",
        header: columnHeader("Document ID"),
        cell: ({ row }) => (
          <span className="copyable-text font-mono text-xs">
            {row.original.documentId}
          </span>
        ),
      },
      {
        id: "title",
        accessorKey: "title",
        header: columnHeader("Title"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {documentNeedsFilesystemReview(row.original) ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            ) : null}
            <span className="copyable-text font-medium">
              {row.original.title}
            </span>
          </div>
        ),
      },
      {
        id: "documentType",
        accessorFn: (row) => row.typeName,
        header: columnHeader("Document Type"),
      },
      {
        id: "version",
        accessorFn: (row) => row.latestVersionLabel ?? "",
        header: columnHeader("Version"),
        cell: ({ row }) => (
          <span>{row.original.latestVersionLabel ?? "—"}</span>
        ),
      },
      {
        id: "status",
        accessorFn: (row) => row.status ?? "",
        header: columnHeader("Status"),
        cell: ({ row }) => (
          <DocumentStatusSelect
            document={row.original}
            lifecycle={workspace.lifecycle}
            onRequestStatusChange={onRequestStatusChange}
          />
        ),
      },
      {
        id: "author",
        accessorKey: "author",
        header: columnHeader("Author"),
      },
      {
        id: "language",
        accessorFn: (row) => row.languageCode ?? "",
        header: columnHeader("Language"),
        cell: ({ row }) => <span>{row.original.languageCode ?? "—"}</span>,
      },
      {
        id: "confidentialityClass",
        accessorFn: (row) => row.confidentialityClassName ?? "",
        header: columnHeader("Confidentiality Class"),
        cell: ({ row }) => (
          <span>{row.original.confidentialityClassName ?? "—"}</span>
        ),
      },
      {
        id: "group",
        accessorFn: (row) => row.groupName ?? "",
        header: columnHeader("Group"),
        cell: ({ row }) =>
          row.original.groupName ? (
            <span>{row.original.groupName}</span>
          ) : (
            <span className="text-muted-foreground">No group</span>
          ),
      },
      {
        id: "project",
        accessorFn: (row) => row.projectName ?? "",
        header: columnHeader("Project"),
        cell: ({ row }) =>
          row.original.projectName ? (
            <span>{row.original.projectName}</span>
          ) : (
            <span className="text-muted-foreground">No project</span>
          ),
      },
      {
        id: "company",
        accessorKey: "company",
        header: columnHeader("Company"),
        cell: ({ row }) => <span>{row.original.company || "—"}</span>,
      },
      {
        id: "department",
        accessorKey: "department",
        header: columnHeader("Department"),
        cell: ({ row }) => <span>{row.original.department || "—"}</span>,
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        header: columnHeader("Start Date"),
        cell: ({ row }) => (
          <span>{formatDateShort(row.original.startDate)}</span>
        ),
      },
      {
        id: "createdDate",
        accessorKey: "createdDate",
        header: columnHeader("Created Date"),
        cell: ({ row }) => (
          <span>{formatDateShort(row.original.createdDate)}</span>
        ),
      },
      {
        id: "modifiedDate",
        accessorKey: "modifiedDate",
        header: columnHeader("Modified Date"),
        cell: ({ row }) => (
          <span>{formatDateShort(row.original.modifiedDate)}</span>
        ),
      },
      {
        id: "releasedDate",
        accessorFn: (row) => row.releasedDate ?? "",
        header: columnHeader("Released Date"),
        cell: ({ row }) => (
          <span>
            {row.original.releasedDate
              ? formatDateShort(row.original.releasedDate)
              : "—"}
          </span>
        ),
      },
      {
        id: "reviewedBy",
        accessorKey: "reviewedBy",
        header: columnHeader("Reviewed By"),
        cell: ({ row }) => <span>{row.original.reviewedBy || "—"}</span>,
      },
      {
        id: "approvedBy",
        accessorKey: "approvedBy",
        header: columnHeader("Approved By"),
        cell: ({ row }) => <span>{row.original.approvedBy || "—"}</span>,
      },
      {
        id: "revisionIntervalMonths",
        accessorFn: (row) => row.revisionIntervalMonths ?? "",
        header: columnHeader("Revision Interval"),
        cell: ({ row }) => (
          <span>
            {row.original.revisionIntervalMonths
              ? `${row.original.revisionIntervalMonths} months`
              : "—"}
          </span>
        ),
      },
      {
        id: "revisionDescription",
        accessorKey: "revisionDescription",
        header: columnHeader("Revision Description"),
        cell: ({ row }) => (
          <span
            className="inline-block max-w-[240px] truncate"
            title={row.original.revisionDescription}
          >
            {row.original.revisionDescription || "—"}
          </span>
        ),
      },
    ];

    return [
      ...fixedColumns.filter((column) =>
        visibleTableColumns.includes(column.id),
      ),
      {
        id: "actions",
        header: () => <span className="text-right">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                stopRowAction(event);
                onRequestEditDocument(row.original.id);
              }}
            >
              <PencilLine className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant={
                documentNeedsFilesystemReview(row.original)
                  ? "destructive"
                  : "ghost"
              }
              size="sm"
              disabled={!row.original.latestVersionLabel}
              onClick={(event) => {
                stopRowAction(event);
                void onShowFiles(
                  row.original.id,
                  documentNeedsFilesystemReview(row.original)
                    ? { preferAffectedVersion: true }
                    : undefined,
                );
              }}
            >
              <FolderOpen className="h-4 w-4" />
              {documentNeedsFilesystemReview(row.original)
                ? "Review Files"
                : "Show Files"}
            </Button>
          </div>
        ),
      },
    ];
  }, [
    onRequestStatusChange,
    onRequestEditDocument,
    onRequestLatestVersionEdit,
    onShowFiles,
    workspace.statuses,
    visibleTableColumns,
  ]);

  const table = useReactTable({
    data: filteredDocuments,
    columns,
    state: {
      sorting,
    },
    onSortingChange: (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      onDocumentViewStateChange((current) => ({
        ...current,
        sorting: nextSorting
          .filter((entry) =>
            DOCUMENT_TABLE_COLUMNS.includes(entry.id as DocumentTableColumn),
          )
          .map((entry) => ({
            column: entry.id as DocumentTableColumn,
            desc: entry.desc,
          })),
      }));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const currentTableRows = table.getRowModel().rows.map((row) => row.original);
  const savedViewMatchCounts = useMemo(
    () =>
      Object.fromEntries(
        savedViews.map((savedView) => [
          savedView.id,
          filterDocumentsBySavedViewQuery(workspace.documents, savedView.query)
            .length,
        ]),
      ),
    [savedViews, workspace.documents],
  );
  const affectedCurrentRows = currentTableRows.filter((document) =>
    documentNeedsFilesystemReview(document),
  );
  const kanbanColumns = useMemo(
    () => buildKanbanColumns(currentTableRows, workspace.statuses),
    [currentTableRows, workspace.statuses],
  );
  const timelineGroups = useMemo(
    () => buildTimelineGroups(currentTableRows),
    [currentTableRows],
  );
  const calendarDocuments = useMemo(
    () =>
      currentTableRows.filter(
        (document) => getCanonicalDateKey(document.nextReviewDate) !== null,
      ),
    [currentTableRows],
  );
  const undatedCalendarDocuments = useMemo(
    () =>
      currentTableRows.filter(
        (document) => getCanonicalDateKey(document.nextReviewDate) === null,
      ),
    [currentTableRows],
  );
  const calendarMonth = useMemo(
    () => buildCalendarMonth(calendarMonthKey, calendarDocuments),
    [calendarDocuments, calendarMonthKey],
  );

  const wholeWorkspaceRows = useMemo(() => {
    const sortingToUse =
      sorting.length > 0 &&
      sorting.every(
        (entry) =>
          DOCUMENT_TABLE_COLUMNS.includes(entry.id as DocumentTableColumn) &&
          availableColumns.includes(entry.id as DocumentTableColumn),
      )
        ? sorting
        : [
            {
              id: "modifiedDate",
              desc: true,
            },
          ];

    return sortDocumentsBySavedView(
      workspace.documents,
      sortingToUse.map((entry) => ({
        column: entry.id as DocumentTableColumn,
        desc: entry.desc,
      })),
    );
  }, [availableColumns, sorting, workspace.documents]);

  useEffect(() => {
    if (
      documentsVisualizationMode !== "timeline" ||
      timelineGroups.orderedMonthKeys.length === 0
    ) {
      return;
    }

    const anchorMonthKey = findNearestMonthKey(
      timelineGroups.orderedMonthKeys,
      getMonthKeyForDate(new Date()),
    );
    if (!anchorMonthKey) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const container = timelineContainerRef.current;
      const section = timelineSectionRefs.current[anchorMonthKey];
      if (!container || !section) {
        return;
      }

      const nextTop = section.offsetTop - container.clientTop - 12;
      container.scrollTo({
        top: Math.max(0, nextTop),
        behavior: "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [documentsVisualizationMode, timelineGroups.orderedMonthKeys]);

  const handleSubmitExport = async () => {
    const columns =
      exportDialog.scope === "current-table"
        ? visibleTableColumns
        : DOCUMENT_TABLE_COLUMNS.filter((column) =>
            availableColumns.includes(column),
          );
    const rows =
      exportDialog.scope === "current-table"
        ? currentTableRows
        : wholeWorkspaceRows;
    const selectedGroup =
      exportDialog.scope === "current-table" && groupFeatureEnabled
        ? (workspace.groups.find(
            (group) => String(group.id) === documentViewState.groupFilter,
          )?.name ??
          (documentViewState.groupFilter === "" ? "No group" : "All groups"))
        : "";
    const selectedProject =
      exportDialog.scope === "current-table" && projectFeatureEnabled
        ? (workspace.projects.find(
            (project) => String(project.id) === documentViewState.projectFilter,
          )?.name ??
          (documentViewState.projectFilter === ""
            ? "No project"
            : "All projects"))
        : "";

    try {
      setExportDialog((current) => ({ ...current, isSubmitting: true }));
      await onExportDocuments({
        format: exportDialog.format,
        scope: exportDialog.scope,
        groupBy: exportDialog.format === "pdf" ? exportDialog.groupBy : "none",
        pdfColorMode:
          exportDialog.format === "pdf" ? exportDialog.pdfColorMode : "color",
        workspaceName: workspace.workspace.name,
        lifecycle: workspace.lifecycle,
        companyLogoPath: workspace.settings.companyLogoPath || null,
        exportTimestamp: new Date().toISOString(),
        columns: columns.map((column) => ({
          key: column,
          label: getDocumentTableColumnLabel(column),
        })),
        rows,
        filters:
          exportDialog.scope === "current-table"
            ? {
                search: deferredSearch.trim(),
                status: documentViewState.statusFilter,
                group: selectedGroup,
                project: selectedProject,
              }
            : {
                search: "",
                status: "All",
                group: "",
                project: "",
              },
      });
      setExportDialog(defaultDocumentExportDialogState);
    } catch (error) {
      setExportDialog((current) => ({ ...current, isSubmitting: false }));
      throw error;
    }
  };

  const currentSavedViewQuery: SavedViewQuery = {
    search: documentViewState.search,
    statusFilter: documentViewState.statusFilter,
    groupFilter: groupFeatureEnabled ? documentViewState.groupFilter : "All",
    projectFilter: projectFeatureEnabled
      ? documentViewState.projectFilter
      : "All",
    healthFilter: documentViewState.healthFilter,
    rules: documentViewState.rules,
  };
  const currentSavedViewPresentation: SavedViewPresentation = {
    visualizationMode: documentsVisualizationMode,
    sorting: sorting.map((entry) => ({
      column: entry.id as DocumentTableColumn,
      desc: entry.desc,
    })),
  };

  const handleSubmitSavedView = async () => {
    if (!savedViewDialog.name.trim()) {
      setSavedViewDialog((current) => ({
        ...current,
        validationErrors: {
          name: "View name is required.",
        },
      }));
      return;
    }

    try {
      setSavedViewDialog((current) => ({
        ...current,
        isSubmitting: true,
        validationErrors: {},
      }));

      if (savedViewDialog.mode === "edit" && savedViewDialog.savedView) {
        await onUpdateSavedView(
          savedViewDialog.savedView.id,
          savedViewDialog.savedView.scope,
          {
            name: savedViewDialog.name,
            query: currentSavedViewQuery,
            presentation: currentSavedViewPresentation,
          },
        );
      } else {
        await onCreateSavedView({
          name: savedViewDialog.name,
          scope: savedViewDialog.scope,
          query: currentSavedViewQuery,
          presentation: currentSavedViewPresentation,
        });
      }

      setSavedViewDialog({
        open: false,
        mode: "create",
        name: "",
        scope: "personal",
        isSubmitting: false,
        validationErrors: {},
      });
    } catch (error) {
      setSavedViewDialog((current) => ({ ...current, isSubmitting: false }));
    }
  };

  const openCreateSavedViewDialog = () => {
    setSavedViewsDialogOpen(false);
    setSavedViewDialog({
      open: true,
      mode: "create",
      name: buildSuggestedSavedViewName(currentSavedViewQuery),
      scope: "personal",
      isSubmitting: false,
      validationErrors: {},
    });
  };

  const openEditSavedViewDialog = (savedView: SavedView) => {
    setSavedViewsDialogOpen(false);
    setSavedViewDialog({
      open: true,
      mode: "edit",
      savedView,
      name: savedView.name,
      scope: savedView.scope,
      isSubmitting: false,
      validationErrors: {},
    });
  };

  const handleKanbanCardDragStart = (
    document: DocumentListItem,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    if (!document.status || !document.latestVersionLabel) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(document.id));
    setDraggedDocumentId(document.id);
    setKanbanDropStatus(null);
  };

  const handleKanbanCardDragEnd: React.DragEventHandler<
    HTMLDivElement
  > = () => {
    setDraggedDocumentId(null);
    setKanbanDropStatus(null);
  };

  const handleKanbanColumnDragOver = (
    status: DocumentStatus,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    if (draggedDocumentId === null) {
      return;
    }

    const document =
      currentTableRows.find((item) => item.id === draggedDocumentId) ??
      workspace.documents.find((item) => item.id === draggedDocumentId);
    if (
      !document?.status ||
      !getAllowedLifecycleTransitionTargets(
        workspace.lifecycle,
        document.status,
      ).some((item) => item.name === status)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setKanbanDropStatus(status);
  };

  const handleKanbanColumnDrop = (
    status: DocumentStatus,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const documentId =
      Number(event.dataTransfer.getData("text/plain")) || draggedDocumentId;
    const document =
      currentTableRows.find((item) => item.id === documentId) ??
      workspace.documents.find((item) => item.id === documentId);

    setDraggedDocumentId(null);
    setKanbanDropStatus(null);

    if (!document || !document.status || !document.latestVersionLabel) {
      return;
    }

    if (
      !getAllowedLifecycleTransitionTargets(
        workspace.lifecycle,
        document.status,
      ).some((item) => item.name === status)
    ) {
      return;
    }

    onRequestStatusChange(document, status);
  };

  const renderDetailContent = (layout: "sidebar" | "modal" | "page") => (
    <DocumentDetailSurface
      layout={layout}
      documentDetail={selectedDocumentDetail}
      lifecycle={workspace.lifecycle}
      availableColumns={availableColumns}
      isLoading={isDetailLoading}
      onClose={onCloseDocumentDetail}
      onRequestEditDocument={onRequestEditDocument}
      onRequestLatestVersionEdit={onRequestLatestVersionEdit}
      onRequestVersionEdit={onRequestVersionEdit}
      onRequestNewVersion={onRequestNewVersion}
      onShowDocumentFolder={onShowDocumentFolder}
      onShowVersionFiles={onShowVersionFiles}
      onRequestDeleteDocument={onRequestDeleteDocument}
      onRequestDeleteVersion={onRequestDeleteVersion}
      onOpenRevisionDescription={onOpenRevisionDescription}
      isMacOs={isMacOs}
    />
  );

  const handleSidebarResizeStart = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const appWidth = window.innerWidth;
    if (appWidth <= 0) {
      return;
    }

    const minWidth =
      (appWidth * DOCUMENT_DETAIL_SIDEBAR_MIN_WIDTH_PERCENT) / 100;
    const maxWidth =
      (appWidth * DOCUMENT_DETAIL_SIDEBAR_MAX_WIDTH_PERCENT) / 100;
    const startX = event.clientX;
    const startWidth = Math.max(minWidth, Math.min(maxWidth, sidebarWidth));
    let nextWidth = startWidth;
    setSidebarWidth(startWidth);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      nextWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidth + (startX - moveEvent.clientX)),
      );
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      const persistedWidth = Math.round(nextWidth);
      setSidebarWidth(persistedWidth);
      void onUpdateSidebarWidth(persistedWidth);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const documentsVisualizationContent =
    documentsVisualizationMode === "table" ? (
      <div className="h-full overflow-auto rounded-xl border border-border">
        <table className="min-w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-card/95">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  const ariaSort =
                    sortDirection === "asc"
                      ? "ascending"
                      : sortDirection === "desc"
                        ? "descending"
                        : header.column.getCanSort()
                          ? "none"
                          : undefined;

                  return (
                    <th
                      key={header.id}
                      aria-sort={ariaSort}
                      className={cn(
                        headerCellClassName,
                        header.id === "actions" && "text-right",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={emptyStateClassName}>
                  No documents match the current search and filter settings.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const hasFilesystemReviewIssue = documentNeedsFilesystemReview(
                  row.original,
                );

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition hover:bg-accent/70",
                      hasFilesystemReviewIssue &&
                        "border-destructive/25 bg-destructive/5 hover:bg-destructive/10",
                      workspace.selectedDocumentRecordId === row.original.id &&
                        (hasFilesystemReviewIssue
                          ? "bg-destructive/10"
                          : "bg-accent/70"),
                    )}
                    onClick={() => onSelectDocument(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          bodyCellClassName,
                          cell.column.id === "actions" && "min-w-[180px]",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    ) : documentsVisualizationMode === "kanban" ? (
      <DocumentsKanbanBoard
        columns={kanbanColumns}
        lifecycle={workspace.lifecycle}
        selectedDocumentId={workspace.selectedDocumentRecordId}
        draggedDocumentId={draggedDocumentId}
        dropStatus={kanbanDropStatus}
        onSelectDocument={onSelectDocument}
        onDragStart={handleKanbanCardDragStart}
        onDragEnd={handleKanbanCardDragEnd}
        onColumnDragOver={handleKanbanColumnDragOver}
        onColumnDrop={handleKanbanColumnDrop}
      />
    ) : documentsVisualizationMode === "timeline" ? (
      <DocumentsTimeline
        containerRef={timelineContainerRef}
        sectionRefs={timelineSectionRefs}
        groups={timelineGroups}
        lifecycle={workspace.lifecycle}
        selectedDocumentId={workspace.selectedDocumentRecordId}
        onSelectDocument={onSelectDocument}
      />
    ) : (
      <DocumentsCalendar
        month={calendarMonth}
        undatedDocuments={undatedCalendarDocuments}
        lifecycle={workspace.lifecycle}
        selectedDocumentId={workspace.selectedDocumentRecordId}
        onSelectDocument={onSelectDocument}
        onPreviousMonth={() =>
          setCalendarMonthKey((current) => shiftMonthKey(current, -1))
        }
        onNextMonth={() =>
          setCalendarMonthKey((current) => shiftMonthKey(current, 1))
        }
        onToday={() => setCalendarMonthKey(getMonthKeyForDate(new Date()))}
      />
    );

  if (detailViewMode === "page" && hasSelectedDocument) {
    return (
      <>
        <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/80 px-4 py-3">
            <Button variant="ghost" onClick={onCloseDocumentDetail}>
              <ChevronLeft className="h-4 w-4" />
              Back to Documents
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-3">
            {renderDetailContent("page")}
          </div>
        </div>
        <DocumentExportDialog
          state={exportDialog}
          groupingOptions={exportGroupingOptions}
          onStateChange={setExportDialog}
          onSubmit={handleSubmitExport}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative h-full">
        <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-1 pb-3">
            <div>
              <div className="text-lg font-semibold">
                {workspace.workspace.name}
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {workspace.documents.length} documents tracked in this workspace
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div
                className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-background p-1"
                aria-label="Documents visualization mode"
              >
                {DOCUMENTS_VISUALIZATION_MODE_OPTIONS.map((option) => {
                  const Icon = getDocumentsVisualizationIcon(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-documents-visualization-button={option.value}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
                        documentsVisualizationMode === option.value
                          ? "bg-secondary text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                      aria-pressed={documentsVisualizationMode === option.value}
                      onClick={() =>
                        onDocumentsVisualizationModeChange(option.value)
                      }
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={onRequestNewDocument}>
                  <FilePlus2 className="h-4 w-4" />
                  New Document
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setExportDialog({
                      ...defaultDocumentExportDialogState,
                      open: true,
                    })
                  }
                >
                  <FileStack className="h-4 w-4" />
                  Export
                </Button>
                {isTableView ? (
                  <Button
                    aria-label="Table View Settings"
                    variant="outline"
                    size="icon"
                    onClick={onOpenTableSettings}
                    title="Table View Settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            {/* Search */}
            <div className="min-w-[240px] flex-1">
              <label
                htmlFor="doc-search"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="doc-search"
                  data-doc-search="true"
                  className="pl-10"
                  placeholder="ID, title, type, author, group, project, status, metadata..."
                  value={documentViewState.search}
                  onChange={(event) => {
                    startTransition(() => {
                      onDocumentViewStateChange((current) => ({
                        ...current,
                        search: event.target.value,
                      }));
                    });
                  }}
                />
              </div>
            </div>

            {/* Status filter */}
            <div className="flex flex-col">
              <span className="mb-1 text-sm font-medium text-foreground">
                Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition",
                      documentViewState.statusFilter === status
                        ? "border-border bg-secondary text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() =>
                      onDocumentViewStateChange((current) => ({
                        ...current,
                        statusFilter: status,
                      }))
                    }
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {groupFeatureEnabled ? (
              <Field label="Group">
                <Select
                  value={documentViewState.groupFilter}
                  onChange={(event) =>
                    onDocumentViewStateChange((current) => ({
                      ...current,
                      groupFilter: event.target.value,
                    }))
                  }
                >
                  <option value="All">All groups</option>
                  {workspace.groups.map((group) => (
                    <option key={group.id} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                  <option value="">No group</option>
                </Select>
              </Field>
            ) : null}

            {/* Project filter */}
            {projectFeatureEnabled ? (
              <Field label="Project">
                <Select
                  value={documentViewState.projectFilter}
                  onChange={(event) =>
                    onDocumentViewStateChange((current) => ({
                      ...current,
                      projectFilter: event.target.value,
                    }))
                  }
                >
                  <option value="All">All projects</option>
                  {workspace.projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}
                    </option>
                  ))}
                  <option value="">No project</option>
                </Select>
              </Field>
            ) : null}

            <Field label="Health">
              <Select
                value={documentViewState.healthFilter}
                onChange={(event) =>
                  onDocumentViewStateChange((current) => ({
                    ...current,
                    healthFilter: event.target.value as
                      | DocumentHealthFlag
                      | "All",
                  }))
                }
              >
                <option value="All">All health states</option>
                <option value="overdueReview">Overdue review</option>
                <option value="missingFiles">Missing tracked files</option>
                <option value="unversionedShell">Unversioned shells</option>
                <option value="unmanagedPaths">Unmanaged paths</option>
                <option value="staleDocument">Stale documents</option>
              </Select>
            </Field>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background px-3 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Views & Rules</div>
                  <Badge variant="outline">
                    {savedViews.length} saved view
                    {savedViews.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge
                    variant={
                      documentViewState.rules.length > 0 ? "warning" : "outline"
                    }
                  >
                    {documentViewState.rules.length} smart rule
                    {documentViewState.rules.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {documentViewState.rules.length === 0 ? (
                    <span className="text-[13px] text-muted-foreground">
                      No smart rules applied.
                    </span>
                  ) : (
                    <>
                      {documentViewState.rules.slice(0, 2).map((rule) => (
                        <button
                          key={rule.id}
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-foreground transition hover:bg-accent"
                          onClick={() =>
                            onDocumentViewStateChange((current) => ({
                              ...current,
                              rules: current.rules.filter(
                                (item) => item.id !== rule.id,
                              ),
                            }))
                          }
                          title="Remove rule"
                        >
                          <span>{formatSavedViewRuleSummary(rule)}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                      {documentViewState.rules.length > 2 ? (
                        <Badge variant="outline">
                          +{documentViewState.rules.length - 2} more
                        </Badge>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSavedViewsDialogOpen(true)}
                >
                  Saved Views
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRulesDialogOpen(true)}
                >
                  Smart Rules
                </Button>
              </div>
            </div>
          </div>

          {affectedCurrentRows.length > 0 ? (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Highlighted rows need filesystem review
                  </div>
                  <div className="mt-1 text-destructive/90">
                    Use <span className="font-semibold">Review Files</span> to
                    open the Show Files dialog and reconcile external changes.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 min-h-0 flex-1 overflow-hidden">
            {documentsVisualizationContent}
          </div>
        </div>

        {false ? (
          <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <div className="text-base font-semibold">Document Detail</div>
                <div className="text-[13px] text-muted-foreground">
                  Inspect metadata, latest-version fields, and managed folders
                </div>
              </div>
              {selectedDocumentDetail ? (
                <DocumentProgressBadge
                  status={latestVersion?.status ?? null}
                  lifecycle={workspace.lifecycle}
                />
              ) : null}
            </div>

            {!selectedDocumentDetail && !isDetailLoading ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background p-5 text-center text-[13px] text-muted-foreground">
                Select a document from the table to view versions, show files,
                or open its folder.
              </div>
            ) : null}

            {isDetailLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading document detail
              </div>
            ) : null}

            {selectedDocumentDetail ? (
              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <div className="rounded-xl border border-border bg-background p-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="copyable-text font-mono text-xs text-primary">
                        {selectedDocumentDetail!.documentId}
                      </div>
                      <div className="copyable-text mt-1.5 text-lg font-semibold">
                        {selectedDocumentDetail!.title}
                      </div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {selectedDocumentDetail!.typeName} •{" "}
                        {selectedDocumentDetail!.author}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onRequestEditDocument(selectedDocumentDetail!.id)
                        }
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit Document
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!latestVersion}
                        onClick={() =>
                          onRequestLatestVersionEdit(selectedDocumentDetail!.id)
                        }
                      >
                        <CircleDot className="h-4 w-4" />
                        Edit Latest Version
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onShowDocumentFolder}
                      >
                        <FolderOpen className="h-4 w-4" />
                        Show Folder
                      </Button>
                      <Button size="sm" onClick={onRequestNewVersion}>
                        <PencilLine className="h-4 w-4" />
                        {selectedDocumentDetail!.versions.length === 0
                          ? "Create First Version"
                          : "New Version"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    <InfoCard
                      label="Document Type"
                      value={selectedDocumentDetail!.typeName}
                    />
                    {availableColumns.includes("author") ? (
                      <InfoCard
                        label="Author"
                        value={selectedDocumentDetail!.author}
                      />
                    ) : null}
                    {availableColumns.includes("language") ? (
                      <InfoCard
                        label="Language"
                        value={selectedDocumentDetail!.languageCode ?? "—"}
                      />
                    ) : null}
                    {availableColumns.includes("confidentialityClass") ? (
                      <InfoCard
                        label="Confidentiality"
                        value={
                          selectedDocumentDetail!.confidentialityClassName ??
                          "—"
                        }
                      />
                    ) : null}
                    {projectFeatureEnabled ? (
                      <InfoCard
                        label="Project"
                        value={selectedDocumentDetail!.projectName ?? "—"}
                      />
                    ) : null}
                    {availableColumns.includes("company") ? (
                      <InfoCard
                        label="Company"
                        value={selectedDocumentDetail!.company || "—"}
                      />
                    ) : null}
                    {availableColumns.includes("department") ? (
                      <InfoCard
                        label="Department"
                        value={selectedDocumentDetail!.department || "—"}
                      />
                    ) : null}
                    {availableColumns.includes("revisionIntervalMonths") ? (
                      <InfoCard
                        label="Revision Interval"
                        value={
                          selectedDocumentDetail!.revisionIntervalMonths
                            ? `${selectedDocumentDetail!.revisionIntervalMonths} months`
                            : "—"
                        }
                      />
                    ) : null}
                    {availableColumns.includes("createdDate") ? (
                      <InfoCard
                        label="Created"
                        value={formatDateTime(
                          selectedDocumentDetail!.createdDate,
                        )}
                      />
                    ) : null}
                    {availableColumns.includes("modifiedDate") ? (
                      <InfoCard
                        label="Modified"
                        value={formatDateTime(
                          selectedDocumentDetail!.modifiedDate,
                        )}
                      />
                    ) : null}
                    {availableColumns.includes("releasedDate") ? (
                      <InfoCard
                        label="Released"
                        value={
                          latestVersion?.releasedDate
                            ? formatDateTime(latestVersion?.releasedDate ?? "")
                            : "—"
                        }
                      />
                    ) : null}
                    {availableColumns.includes("approvedBy") ? (
                      <InfoCard
                        label="Approved By"
                        value={latestVersion?.approvedBy || "—"}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-background p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[13px] font-semibold">Versions</div>
                    <Badge variant="outline">
                      {selectedDocumentDetail!.versions.length} total
                    </Badge>
                  </div>
                  {selectedDocumentDetail!.versions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                      This document shell has no versions yet. Create the first
                      version to start tracking files.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedDocumentDetail!.versions.map((version) => (
                        <div
                          key={version.id}
                          className="rounded-xl border border-border bg-card p-3 transition hover:bg-accent/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">
                                  Version {version.versionLabel}
                                </div>
                                <StatusBadge
                                  status={version.status}
                                  lifecycle={workspace.lifecycle}
                                />
                                <Badge variant="outline">
                                  {version.files.length} files
                                </Badge>
                              </div>
                              <div className="copyable-text mt-1 font-mono text-xs text-primary">
                                {version.versionDocumentId}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Created {formatDateTime(version.createdDate)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onShowVersionFiles(version.id)}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Show Files
                            </Button>
                          </div>
                          {availableColumns.includes("releasedDate") ||
                          availableColumns.includes("approvedBy") ||
                          availableColumns.includes("revisionDescription") ? (
                            <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] md:grid-cols-3">
                              {availableColumns.includes("releasedDate") ? (
                                <InfoCard
                                  label="Released"
                                  value={
                                    version.releasedDate
                                      ? formatDateTime(version.releasedDate)
                                      : "—"
                                  }
                                />
                              ) : null}
                              {availableColumns.includes("approvedBy") ? (
                                <InfoCard
                                  label="Approved By"
                                  value={version.approvedBy || "—"}
                                />
                              ) : null}
                              {availableColumns.includes(
                                "revisionDescription",
                              ) ? (
                                <InfoCard
                                  label="Revision Description"
                                  value={
                                    version.revisionDescription ||
                                    "No revision description."
                                  }
                                />
                              ) : null}
                            </div>
                          ) : null}
                          {version.filesystemChanges.length > 0 ? (
                            <div className="mt-3">
                              <FilesystemDriftSummary
                                compact
                                state={version.filesystemState}
                                paths={version.filesystemChanges.map(
                                  (change) =>
                                    change.discoveredPath ??
                                    change.trackedPath ??
                                    change.kind,
                                )}
                              />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {isSidebarOpen ? (
          <>
            <div
              className={cn(
                "fixed inset-0 z-[70] bg-slate-950/12 backdrop-blur-[1px] transition-opacity duration-300 ease-out",
                isSidebarEntered ? "opacity-100" : "opacity-0",
              )}
              onClick={onCloseDocumentDetail}
            />
            <div
              className={cn(
                "fixed inset-y-0 right-0 z-[80] flex border-l border-border bg-card shadow-2xl transition-[opacity,transform] duration-300 ease-out",
                isSidebarEntered
                  ? "translate-x-0 opacity-100"
                  : "translate-x-8 opacity-0",
              )}
              style={{
                width: `clamp(${DOCUMENT_DETAIL_SIDEBAR_MIN_WIDTH_PERCENT}vw, ${Math.round(sidebarWidth)}px, ${DOCUMENT_DETAIL_SIDEBAR_MAX_WIDTH_PERCENT}vw)`,
              }}
              data-detail-sidebar="true"
            >
              <div
                className="flex w-5 cursor-col-resize items-center justify-center border-r border-border/60 bg-background/80"
                onPointerDown={handleSidebarResizeStart}
                title="Resize detail sidebar"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                {renderDetailContent("sidebar")}
              </div>
            </div>
          </>
        ) : null}
      </div>
      <Dialog
        open={detailViewMode === "modal" && hasSelectedDocument}
        onOpenChange={(open) => !open && onCloseDocumentDetail()}
      >
        <DialogContent
          className="h-[min(92vh,920px)] w-[min(96vw,1240px)] max-w-none overflow-hidden p-0"
          showCloseButton={false}
        >
          {renderDetailContent("modal")}
        </DialogContent>
      </Dialog>
      <DocumentExportDialog
        state={exportDialog}
        groupingOptions={exportGroupingOptions}
        onStateChange={setExportDialog}
        onSubmit={handleSubmitExport}
      />
      <Dialog
        open={savedViewsDialogOpen}
        onOpenChange={setSavedViewsDialogOpen}
      >
        <DialogContent className="w-[min(96vw,920px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Saved Views</DialogTitle>
            <DialogDescription>
              Reopen saved filters, smart collections, and dashboard pins
              without taking over the documents page.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto pr-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                <Badge variant="outline">
                  {savedViews.length} saved view
                  {savedViews.length === 1 ? "" : "s"}
                </Badge>
                <Badge
                  variant={
                    documentViewState.rules.length > 0 ? "warning" : "outline"
                  }
                >
                  {documentViewState.rules.length} active smart rule
                  {documentViewState.rules.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <Button size="sm" onClick={openCreateSavedViewDialog}>
                Save Current View
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              {savedViews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-[13px] text-muted-foreground">
                  No saved views yet. Save the current filters to reuse them
                  from the documents page or pin them to the dashboard later.
                </div>
              ) : (
                savedViews.map((savedView) => (
                  <div
                    key={savedView.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSavedViewsDialogOpen(false);
                        onApplySavedView(savedView);
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {savedView.name}
                        </span>
                        <Badge
                          variant={
                            savedView.scope === "shared" ? "outline" : "default"
                          }
                        >
                          {savedView.scope === "shared" ? "Shared" : "Personal"}
                        </Badge>
                        <Badge variant="outline">
                          {savedViewMatchCounts[savedView.id] ?? 0} matches
                        </Badge>
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {savedView.presentation.visualizationMode
                          .charAt(0)
                          .toUpperCase() +
                          savedView.presentation.visualizationMode.slice(
                            1,
                          )}{" "}
                        view
                        {savedView.query.rules.length > 0
                          ? ` • ${savedView.query.rules.length} smart rule${savedView.query.rules.length === 1 ? "" : "s"}`
                          : ""}
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditSavedViewDialog(savedView)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void onDuplicateSavedView({
                            savedViewId: savedView.id,
                            scope: savedView.scope,
                          }).catch(() => undefined)
                        }
                      >
                        Copy
                      </Button>
                      {savedView.scope === "personal" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void onPromoteSavedViewToShared({
                              savedViewId: savedView.id,
                            }).catch(() => undefined)
                          }
                        >
                          Share
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void onPinSavedViewToDashboard(savedView).catch(
                            () => undefined,
                          )
                        }
                      >
                        Pin
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void onDeleteSavedView({
                            savedViewId: savedView.id,
                            scope: savedView.scope,
                          }).catch(() => undefined)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SavedViewRulesDialog
        open={rulesDialogOpen}
        workspace={workspace}
        rules={documentViewState.rules}
        onOpenChange={setRulesDialogOpen}
        onSave={(rules) =>
          onDocumentViewStateChange((current) => ({
            ...current,
            rules,
          }))
        }
      />
      <Dialog
        open={savedViewDialog.open}
        onOpenChange={(open) =>
          setSavedViewDialog((current) =>
            open
              ? current
              : {
                  open: false,
                  mode: "create",
                  name: "",
                  scope: "personal",
                  isSubmitting: false,
                  validationErrors: {},
                },
          )
        }
      >
        <DialogContent className="w-[min(92vw,520px)]">
          <DialogHeader>
            <DialogTitle>
              {savedViewDialog.mode === "edit"
                ? "Update Saved View"
                : "Save Current View"}
            </DialogTitle>
            <DialogDescription>
              This stores the current search, quick filters, smart rules,
              sorting, and visualization mode.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field
              label="View Name"
              error={savedViewDialog.validationErrors.name}
            >
              <Input
                value={savedViewDialog.name}
                onChange={(event) =>
                  setSavedViewDialog((current) => ({
                    ...current,
                    name: event.target.value,
                    validationErrors: {},
                  }))
                }
                placeholder="Overdue procedures"
              />
            </Field>
            <Field label="Scope">
              <Select
                value={savedViewDialog.scope}
                disabled={savedViewDialog.mode === "edit"}
                onChange={(event) =>
                  setSavedViewDialog((current) => ({
                    ...current,
                    scope: event.target.value as SavedView["scope"],
                  }))
                }
              >
                <option value="personal">Personal</option>
                <option value="shared">Shared</option>
              </Select>
            </Field>
            <div className="rounded-xl border border-border bg-background px-3 py-3 text-[13px] text-muted-foreground">
              {currentTableRows.length} matching document
              {currentTableRows.length === 1 ? "" : "s"} in the current view.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSavedViewDialog({
                  open: false,
                  mode: "create",
                  name: "",
                  scope: "personal",
                  isSubmitting: false,
                  validationErrors: {},
                })
              }
              disabled={savedViewDialog.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitSavedView()}
              disabled={savedViewDialog.isSubmitting}
            >
              {savedViewDialog.isSubmitting ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SavedViewRulesDialog({
  open,
  workspace,
  rules,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  rules: SavedViewRule[];
  onOpenChange: (open: boolean) => void;
  onSave: (rules: SavedViewRule[]) => void;
}) {
  const [draftRules, setDraftRules] = useState<SavedViewRule[]>(rules);

  useEffect(() => {
    if (open) {
      setDraftRules(rules);
    }
  }, [open, rules]);

  const addRule = () => {
    setDraftRules((current) => [
      ...current,
      {
        id: createClientId("saved-view-rule"),
        field: "documentType",
        operator: "is",
        value: "",
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,860px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Smart Rules</DialogTitle>
          <DialogDescription>
            Build structured, reusable rules for the current documents view.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-2">
          <div className="grid gap-3">
            {draftRules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                No smart rules yet. Add rules for dates, metadata, or
                missing-file conditions.
              </div>
            ) : (
              draftRules.map((rule) => {
                const operatorOptions = getSavedViewOperatorOptions(rule.field);
                const showValue = ![
                  "isEmpty",
                  "isNotEmpty",
                  "thisMonth",
                ].includes(rule.operator);
                const showSecondaryValue = rule.operator === "between";
                const showAmount = rule.operator === "withinLastDays";
                const isDateField = isSavedViewDateField(rule.field);

                return (
                  <div
                    key={rule.id}
                    className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto]"
                  >
                    <Field label="Field">
                      <Select
                        value={rule.field}
                        onChange={(event) =>
                          setDraftRules((current) =>
                            current.map((item) =>
                              item.id === rule.id
                                ? {
                                    ...item,
                                    field: event.target
                                      .value as SavedViewRuleField,
                                    operator: getSavedViewOperatorOptions(
                                      event.target.value as SavedViewRuleField,
                                    )[0],
                                    value: "",
                                    secondaryValue: "",
                                    amount: undefined,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {(
                          Object.keys(
                            SAVED_VIEW_RULE_FIELD_LABELS,
                          ) as SavedViewRuleField[]
                        ).map((field) => (
                          <option key={field} value={field}>
                            {SAVED_VIEW_RULE_FIELD_LABELS[field]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Operator">
                      <Select
                        value={rule.operator}
                        onChange={(event) =>
                          setDraftRules((current) =>
                            current.map((item) =>
                              item.id === rule.id
                                ? {
                                    ...item,
                                    operator: event.target
                                      .value as SavedViewRuleOperator,
                                    secondaryValue:
                                      event.target.value === "between"
                                        ? item.secondaryValue
                                        : "",
                                    amount:
                                      event.target.value === "withinLastDays"
                                        ? (item.amount ?? 30)
                                        : undefined,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {operatorOptions.map((operator) => (
                          <option key={operator} value={operator}>
                            {SAVED_VIEW_RULE_OPERATOR_LABELS[operator]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="grid gap-2">
                      {showValue ? (
                        <Field label={showSecondaryValue ? "From" : "Value"}>
                          {renderSavedViewRuleValueInput({
                            workspace,
                            rule,
                            value: rule.value ?? "",
                            isDateField,
                            onChange: (value) =>
                              setDraftRules((current) =>
                                current.map((item) =>
                                  item.id === rule.id
                                    ? {
                                        ...item,
                                        value,
                                      }
                                    : item,
                                ),
                              ),
                          })}
                        </Field>
                      ) : null}
                      {showSecondaryValue ? (
                        <Field label="To">
                          <Input
                            type={isDateField ? "date" : "text"}
                            value={rule.secondaryValue ?? ""}
                            onChange={(event) =>
                              setDraftRules((current) =>
                                current.map((item) =>
                                  item.id === rule.id
                                    ? {
                                        ...item,
                                        secondaryValue: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </Field>
                      ) : null}
                      {showAmount ? (
                        <Field label="Days">
                          <Input
                            type="number"
                            min="0"
                            value={String(rule.amount ?? 30)}
                            onChange={(event) =>
                              setDraftRules((current) =>
                                current.map((item) =>
                                  item.id === rule.id
                                    ? {
                                        ...item,
                                        amount: Math.max(
                                          0,
                                          Number(event.target.value) || 0,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </Field>
                      ) : null}
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDraftRules((current) =>
                            current.filter((item) => item.id !== rule.id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={addRule}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onSave([]);
              onOpenChange(false);
            }}
          >
            Clear Rules
          </Button>
          <Button
            onClick={() => {
              onSave(draftRules);
              onOpenChange(false);
            }}
          >
            Apply Rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderSavedViewRuleValueInput({
  workspace,
  rule,
  value,
  isDateField,
  onChange,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  rule: SavedViewRule;
  value: string;
  isDateField: boolean;
  onChange: (value: string) => void;
}) {
  if (rule.field === "documentType") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a document type</option>
        {workspace.documentTypes.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "status") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a status</option>
        <option value="Not started">Not started</option>
        {workspace.statuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "group") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a group</option>
        <option value="No group">No group</option>
        {workspace.groups.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "project") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a project</option>
        <option value="No project">No project</option>
        {workspace.projects.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "language") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a language</option>
        {workspace.languages.map((item) => (
          <option key={item.id} value={item.code}>
            {item.code}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "confidentialityClass") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a class</option>
        {workspace.confidentialityClasses.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </Select>
    );
  }

  if (rule.field === "healthFlag") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a health flag</option>
        <option value="overdueReview">Overdue review</option>
        <option value="missingFiles">Missing tracked files</option>
        <option value="unversionedShell">Unversioned shells</option>
        <option value="unmanagedPaths">Unmanaged paths</option>
        <option value="staleDocument">Stale documents</option>
      </Select>
    );
  }

  return (
    <Input
      type={isDateField ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function isSavedViewDateField(field: SavedViewRuleField): boolean {
  return (
    field === "createdDate" ||
    field === "modifiedDate" ||
    field === "releasedDate" ||
    field === "effectiveDate" ||
    field === "startDate" ||
    field === "nextReviewDate"
  );
}

function getSavedViewOperatorOptions(
  field: SavedViewRuleField,
): SavedViewRuleOperator[] {
  if (field === "latestVersion") {
    return ["isEmpty", "isNotEmpty"];
  }

  if (field === "healthFlag") {
    return ["is", "isNot"];
  }

  if (isSavedViewDateField(field)) {
    return [
      "before",
      "after",
      "between",
      "withinLastDays",
      "thisMonth",
      "isEmpty",
      "isNotEmpty",
    ];
  }

  return ["is", "isNot", "contains", "isEmpty", "isNotEmpty"];
}

function formatSavedViewRuleSummary(rule: SavedViewRule): string {
  const fieldLabel = SAVED_VIEW_RULE_FIELD_LABELS[rule.field];
  const operatorLabel = SAVED_VIEW_RULE_OPERATOR_LABELS[rule.operator];

  if (rule.operator === "withinLastDays") {
    return `${fieldLabel} ${operatorLabel} ${rule.amount ?? 0}`;
  }

  if (
    rule.operator === "thisMonth" ||
    rule.operator === "isEmpty" ||
    rule.operator === "isNotEmpty"
  ) {
    return `${fieldLabel} ${operatorLabel}`;
  }

  if (rule.operator === "between") {
    return `${fieldLabel} ${operatorLabel} ${rule.value || "?"} and ${rule.secondaryValue || "?"}`;
  }

  return `${fieldLabel} ${operatorLabel} ${rule.value || "?"}`;
}

function buildSuggestedSavedViewName(query: SavedViewQuery): string {
  const overdueRule = query.rules.find(
    (rule) => rule.field === "healthFlag" && rule.value === "overdueReview",
  );
  const typeRule = query.rules.find((rule) => rule.field === "documentType");
  const releasedThisMonthRule = query.rules.find(
    (rule) => rule.field === "releasedDate" && rule.operator === "thisMonth",
  );
  const missingFilesRule = query.rules.find(
    (rule) => rule.field === "healthFlag" && rule.value === "missingFiles",
  );

  if (overdueRule && typeRule?.value) {
    return `Overdue ${typeRule.value.toLowerCase()}s`;
  }

  if (releasedThisMonthRule) {
    return "Released this month";
  }

  if (query.statusFilter === "Draft" && missingFilesRule) {
    return "Drafts with missing files";
  }

  if (query.statusFilter !== "All") {
    return `${query.statusFilter} documents`;
  }

  if (query.search.trim()) {
    return `Search: ${query.search.trim()}`;
  }

  return "Saved view";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shouldIgnoreDashboardDragStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, input, select, textarea, a, [role="button"], [data-dashboard-resize-handle="true"]',
    ),
  );
}

function resolveDashboardLayoutConflicts(
  widgets: DashboardWidget[],
  options?: {
    prioritizedWidgetId?: string;
  },
): DashboardWidget[] {
  const nextWidgets = widgets
    .map((widget) => ({
      ...widget,
      x: clampNumber(widget.x, 0, DASHBOARD_GRID_COLUMNS - widget.w),
      y: Math.max(0, widget.y),
      w: clampNumber(
        widget.w,
        DASHBOARD_WIDGET_MIN_WIDTH,
        DASHBOARD_GRID_COLUMNS,
      ),
      h: Math.max(DASHBOARD_WIDGET_MIN_HEIGHT, widget.h),
    }))
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const prioritizedWidget = options?.prioritizedWidgetId
    ? nextWidgets.find((widget) => widget.id === options.prioritizedWidgetId)
    : undefined;
  const orderedWidgets = prioritizedWidget
    ? nextWidgets.filter((widget) => widget.id !== prioritizedWidget.id)
    : nextWidgets;
  const placedWidgets: DashboardWidget[] = prioritizedWidget
    ? [{ ...prioritizedWidget }]
    : [];

  for (const widget of orderedWidgets) {
    placedWidgets.push(
      placeDashboardWidget(widget, placedWidgets, {
        preferredX: widget.x,
      }),
    );
  }

  return placedWidgets.sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );
}

function placeDashboardWidget(
  widget: DashboardWidget,
  placedWidgets: DashboardWidget[],
  options?: {
    preferredX?: number;
  },
): DashboardWidget {
  const maxX = Math.max(0, DASHBOARD_GRID_COLUMNS - widget.w);
  const preferredX = clampNumber(options?.preferredX ?? widget.x, 0, maxX);
  const candidateXs = Array.from(
    { length: maxX + 1 },
    (_, index) => index,
  ).sort(
    (left, right) =>
      Math.abs(left - preferredX) - Math.abs(right - preferredX) ||
      left - right,
  );
  const maxY =
    Math.max(0, ...placedWidgets.map((item) => item.y + item.h)) + widget.h + 4;

  for (let candidateY = 0; candidateY <= maxY; candidateY += 1) {
    for (const candidateX of candidateXs) {
      const candidate = {
        ...widget,
        x: candidateX,
        y: candidateY,
      };

      if (
        placedWidgets.every(
          (placedWidget) => !dashboardWidgetsOverlap(candidate, placedWidget),
        )
      ) {
        return candidate;
      }
    }
  }

  return {
    ...widget,
    x: preferredX,
    y: maxY,
  };
}

function dashboardWidgetsOverlap(
  left: DashboardWidget,
  right: DashboardWidget,
): boolean {
  return (
    left.x < right.x + right.w &&
    left.x + left.w > right.x &&
    left.y < right.y + right.h &&
    left.y + left.h > right.y
  );
}

function createClientId(prefix: string): string {
  const identifier =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  return `${prefix}-${identifier}`;
}

interface DocumentsKanbanColumn {
  label: DocumentStatus | "Not started";
  status: DocumentStatus | null;
  documents: DocumentListItem[];
}

interface TimelineDocumentEntry {
  document: DocumentListItem;
  effectiveDateKey: string;
}

interface TimelineMonthGroup {
  monthKey: string;
  label: string;
  entries: TimelineDocumentEntry[];
}

interface TimelineGroupsData {
  orderedMonthKeys: string[];
  monthGroups: TimelineMonthGroup[];
  undatedDocuments: DocumentListItem[];
}

interface CalendarDayCell {
  dateKey: string;
  label: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  documents: DocumentListItem[];
}

interface CalendarMonthData {
  monthKey: string;
  label: string;
  weeks: CalendarDayCell[][];
}

const DOCUMENTS_VISUALIZATION_ICONS: Record<
  DocumentsVisualizationMode,
  typeof Grid3x3
> = {
  table: Grid3x3,
  kanban: Columns3,
  timeline: Milestone,
  calendar: CalendarDays,
};

const getDocumentsVisualizationIcon = (
  mode: DocumentsVisualizationMode,
): typeof Grid3x3 => DOCUMENTS_VISUALIZATION_ICONS[mode];

const parseDateKey = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const parseMonthKey = (value: string): Date => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
};

const getDateKeyForDate = (value: Date): string =>
  [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");

const getMonthKeyForDate = (value: Date): string =>
  [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0")].join(
    "-",
  );

const getCanonicalDateKey = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const dateKey = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  return Number.isNaN(parseDateKey(dateKey).getTime()) ? null : dateKey;
};

const formatMonthKey = (value: string): string =>
  formatDateFns(parseMonthKey(value), "MMMM yyyy");

const formatDateKeyLabel = (value: string): string =>
  formatDateFns(parseDateKey(value), "dd MMM yyyy");

const shiftMonthKey = (monthKey: string, delta: number): string =>
  getMonthKeyForDate(addMonths(parseMonthKey(monthKey), delta));

const compareDateKeys = (left: string, right: string): number =>
  left.localeCompare(right);

const getMonthIndex = (monthKey: string): number => {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + month;
};

const findNearestMonthKey = (
  orderedMonthKeys: string[],
  targetMonthKey: string,
): string | null => {
  if (orderedMonthKeys.length === 0) {
    return null;
  }

  const targetIndex = getMonthIndex(targetMonthKey);

  return orderedMonthKeys.reduce((closest, candidate) => {
    if (!closest) {
      return candidate;
    }

    const candidateDistance = Math.abs(getMonthIndex(candidate) - targetIndex);
    const closestDistance = Math.abs(getMonthIndex(closest) - targetIndex);
    return candidateDistance < closestDistance ? candidate : closest;
  }, orderedMonthKeys[0] ?? null);
};

const buildKanbanColumns = (
  documents: DocumentListItem[],
  statuses: DocumentStatus[],
): DocumentsKanbanColumn[] => {
  const notStartedDocuments = documents.filter(
    (document) => !document.status || !document.latestVersionLabel,
  );
  const statusColumns = statuses.map((status) => ({
    label: status,
    status,
    documents: documents.filter(
      (document) =>
        document.status === status && Boolean(document.latestVersionLabel),
    ),
  }));

  return [
    {
      label: "Not started",
      status: null,
      documents: notStartedDocuments,
    },
    ...statusColumns,
  ];
};

const buildTimelineGroups = (
  documents: DocumentListItem[],
): TimelineGroupsData => {
  const monthEntries = new Map<string, TimelineDocumentEntry[]>();
  const undatedDocuments: DocumentListItem[] = [];

  for (const document of documents) {
    const effectiveDateKey = getCanonicalDateKey(document.effectiveDate);
    if (!effectiveDateKey) {
      undatedDocuments.push(document);
      continue;
    }

    const monthKey = effectiveDateKey.slice(0, 7);
    monthEntries.set(monthKey, [
      ...(monthEntries.get(monthKey) ?? []),
      { document, effectiveDateKey },
    ]);
  }

  const orderedMonthKeys = [...monthEntries.keys()].sort(compareDateKeys);

  return {
    orderedMonthKeys,
    monthGroups: orderedMonthKeys.map((monthKey) => ({
      monthKey,
      label: formatMonthKey(monthKey),
      entries: [...(monthEntries.get(monthKey) ?? [])].sort((left, right) => {
        const dateComparison = compareDateKeys(
          left.effectiveDateKey,
          right.effectiveDateKey,
        );
        if (dateComparison !== 0) {
          return dateComparison;
        }

        return left.document.title.localeCompare(
          right.document.title,
          undefined,
          {
            sensitivity: "base",
          },
        );
      }),
    })),
    undatedDocuments,
  };
};

const buildCalendarMonth = (
  monthKey: string,
  documents: DocumentListItem[],
): CalendarMonthData => {
  const documentsByDate = new Map<string, DocumentListItem[]>();

  for (const document of documents) {
    const reviewDateKey = getCanonicalDateKey(document.nextReviewDate);
    if (!reviewDateKey) {
      continue;
    }

    documentsByDate.set(reviewDateKey, [
      ...(documentsByDate.get(reviewDateKey) ?? []),
      document,
    ]);
  }

  const monthStart = startOfMonth(parseMonthKey(monthKey));
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const todayKey = getDateKeyForDate(new Date());
  const cells = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  }).map((date) => {
    const dateKey = getDateKeyForDate(date);

    return {
      dateKey,
      label: String(date.getDate()),
      isCurrentMonth: getMonthKeyForDate(date) === monthKey,
      isToday: dateKey === todayKey,
      documents: [...(documentsByDate.get(dateKey) ?? [])].sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        }),
      ),
    };
  });

  const weeks: CalendarDayCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return {
    monthKey,
    label: formatMonthKey(monthKey),
    weeks,
  };
};

function DocumentsVisualizationEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-10 text-center">
      <div className="max-w-md">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-2 text-[13px] text-muted-foreground">
          {description}
        </div>
      </div>
    </div>
  );
}

function DocumentVisualizationCard({
  document,
  lifecycle = DEFAULT_WORKSPACE_LIFECYCLE_STATE,
  selected,
  detailLines,
  draggable = false,
  dimmed = false,
  onSelectDocument,
  onDragStart,
  onDragEnd,
}: {
  document: DocumentListItem;
  lifecycle?: WorkspaceLifecycle;
  selected: boolean;
  detailLines: string[];
  draggable?: boolean;
  dimmed?: boolean;
  onSelectDocument: (documentRecordId: number) => void;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}) {
  const needsFilesystemReview = documentNeedsFilesystemReview(document);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-document-visual-card={String(document.id)}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition",
        selected
          ? "border-primary/50 ring-1 ring-primary/30"
          : "border-border hover:border-border/80",
        needsFilesystemReview && "border-destructive/35 bg-destructive/5",
        dimmed && "opacity-60",
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onSelectDocument(document.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="copyable-text font-mono text-[11px] text-primary">
              {document.documentId}
            </div>
            <div className="mt-1.5 text-sm font-semibold leading-snug">
              {document.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {document.typeName}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {needsFilesystemReview ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DocumentProgressBadge
            status={document.status}
            lifecycle={lifecycle}
          />
          {document.isOverdue ? (
            <Badge variant="destructive">Overdue review</Badge>
          ) : null}
        </div>

        {detailLines.length > 0 ? (
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {detailLines.map((line, index) => (
              <div key={`${document.id}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}
      </button>
    </div>
  );
}

function DocumentsKanbanBoard({
  columns,
  lifecycle,
  selectedDocumentId,
  draggedDocumentId,
  dropStatus,
  onSelectDocument,
  onDragStart,
  onDragEnd,
  onColumnDragOver,
  onColumnDrop,
}: {
  columns: DocumentsKanbanColumn[];
  lifecycle: WorkspaceLifecycle;
  selectedDocumentId?: number;
  draggedDocumentId: number | null;
  dropStatus: DocumentStatus | null;
  onSelectDocument: (documentRecordId: number) => void;
  onDragStart: (
    document: DocumentListItem,
    event: React.DragEvent<HTMLDivElement>,
  ) => void;
  onDragEnd: React.DragEventHandler<HTMLDivElement>;
  onColumnDragOver: (
    status: DocumentStatus,
    event: React.DragEvent<HTMLDivElement>,
  ) => void;
  onColumnDrop: (
    status: DocumentStatus,
    event: React.DragEvent<HTMLDivElement>,
  ) => void;
}) {
  const totalDocuments = columns.reduce(
    (total, column) => total + column.documents.length,
    0,
  );

  if (totalDocuments === 0) {
    return (
      <DocumentsVisualizationEmptyState
        title="No documents to organize"
        description="Adjust the current search or filters to populate the Kanban board."
      />
    );
  }

  return (
    <div className="h-full overflow-auto rounded-xl border border-border bg-background p-3">
      <div className="grid min-w-max gap-3 xl:grid-cols-5">
        {columns.map((column) => {
          const isDropTarget =
            column.status !== null && dropStatus === column.status;

          return (
            <div
              key={column.label}
              data-kanban-column={column.status ?? "not-started"}
              className={cn(
                "flex h-[32rem] min-h-0 min-w-[260px] max-h-full flex-col overflow-hidden rounded-2xl border bg-card",
                isDropTarget && "border-primary/50 bg-primary/5",
              )}
              onDragOver={
                column.status
                  ? (event) => onColumnDragOver(column.status!, event)
                  : undefined
              }
              onDrop={
                column.status
                  ? (event) => onColumnDrop(column.status!, event)
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">{column.label}</div>
                <Badge variant="outline">{column.documents.length}</Badge>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pr-2">
                {column.documents.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-[13px] text-muted-foreground">
                    {column.status
                      ? "Drop a document here or change filters."
                      : "Documents without a started version appear here."}
                  </div>
                ) : (
                  column.documents.map((document) => (
                    <DocumentVisualizationCard
                      key={document.id}
                      document={document}
                      lifecycle={lifecycle}
                      selected={selectedDocumentId === document.id}
                      detailLines={[
                        document.projectName
                          ? `Project: ${document.projectName}`
                          : "Project: No project",
                        document.effectiveDate
                          ? `Effective: ${formatDateKeyLabel(
                              getCanonicalDateKey(document.effectiveDate)!,
                            )}`
                          : "Effective: Not scheduled",
                        document.nextReviewDate
                          ? `Review due: ${formatDateKeyLabel(
                              getCanonicalDateKey(document.nextReviewDate)!,
                            )}`
                          : "Review due: Not set",
                      ]}
                      draggable={Boolean(
                        column.status && document.latestVersionLabel,
                      )}
                      dimmed={draggedDocumentId === document.id}
                      onSelectDocument={onSelectDocument}
                      onDragStart={(event) => onDragStart(document, event)}
                      onDragEnd={onDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentsTimeline({
  containerRef,
  sectionRefs,
  groups,
  lifecycle,
  selectedDocumentId,
  onSelectDocument,
}: {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  sectionRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  groups: TimelineGroupsData;
  lifecycle: WorkspaceLifecycle;
  selectedDocumentId?: number;
  onSelectDocument: (documentRecordId: number) => void;
}) {
  if (groups.monthGroups.length === 0 && groups.undatedDocuments.length === 0) {
    return (
      <DocumentsVisualizationEmptyState
        title="No documents on the timeline"
        description="Adjust the current search or filters to populate the timeline."
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto rounded-xl border border-border bg-background p-4"
    >
      <div className="space-y-6">
        {groups.monthGroups.map((group) => (
          <section
            key={group.monthKey}
            ref={(node) => {
              sectionRefs.current[group.monthKey] = node;
            }}
            className="space-y-3"
          >
            <div className="sticky top-0 z-10 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <div className="text-sm font-semibold">{group.label}</div>
            </div>

            <div className="space-y-3">
              {group.entries.map((entry) => (
                <div
                  key={entry.document.id}
                  className="grid gap-3 md:grid-cols-[132px_minmax(0,1fr)]"
                >
                  <div className="pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {formatDateKeyLabel(entry.effectiveDateKey)}
                  </div>
                  <DocumentVisualizationCard
                    document={entry.document}
                    lifecycle={lifecycle}
                    selected={selectedDocumentId === entry.document.id}
                    detailLines={[
                      entry.document.projectName
                        ? `Project: ${entry.document.projectName}`
                        : "Project: No project",
                      entry.document.nextReviewDate
                        ? `Review due: ${formatDateKeyLabel(
                            getCanonicalDateKey(entry.document.nextReviewDate)!,
                          )}`
                        : "Review due: Not set",
                    ]}
                    onSelectDocument={onSelectDocument}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        {groups.undatedDocuments.length > 0 ? (
          <section className="space-y-3">
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-2">
              <div className="text-sm font-semibold">No effective date</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.undatedDocuments.map((document) => (
                <DocumentVisualizationCard
                  key={document.id}
                  document={document}
                  lifecycle={lifecycle}
                  selected={selectedDocumentId === document.id}
                  detailLines={[
                    document.projectName
                      ? `Project: ${document.projectName}`
                      : "Project: No project",
                    document.nextReviewDate
                      ? `Review due: ${formatDateKeyLabel(
                          getCanonicalDateKey(document.nextReviewDate)!,
                        )}`
                      : "Review due: Not set",
                  ]}
                  onSelectDocument={onSelectDocument}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function DocumentsCalendar({
  month,
  undatedDocuments,
  lifecycle: _lifecycle,
  selectedDocumentId,
  onSelectDocument,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: {
  month: CalendarMonthData;
  undatedDocuments: DocumentListItem[];
  lifecycle: WorkspaceLifecycle;
  selectedDocumentId?: number;
  onSelectDocument: (documentRecordId: number) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const firstWeek = month.weeks[0] ?? [];
  const hasDocumentsInMonth = month.weeks.some((week) =>
    week.some((day) => day.documents.length > 0),
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="text-base font-semibold">{month.label}</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Documents grouped by review due date.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={onNextMonth}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="min-w-[820px] space-y-2">
          <div className="grid grid-cols-7 gap-2">
            {firstWeek.map((day) => (
              <div
                key={day.dateKey}
                className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                {formatDateFns(parseDateKey(day.dateKey), "EEE")}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {month.weeks.map((week, weekIndex) => (
              <div
                key={`${month.monthKey}-${weekIndex}`}
                className="grid grid-cols-7 gap-2"
              >
                {week.map((day) => (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "flex min-h-[150px] flex-col rounded-xl border p-2",
                      day.isCurrentMonth
                        ? "border-border bg-card"
                        : "border-border/60 bg-muted/20",
                      day.isToday && "ring-1 ring-primary/40",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          !day.isCurrentMonth && "text-muted-foreground",
                        )}
                      >
                        {day.label}
                      </span>
                      {day.documents.length > 0 ? (
                        <Badge variant="outline">{day.documents.length}</Badge>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 overflow-y-auto">
                      {day.documents.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          className={cn(
                            "w-full rounded-lg border px-2 py-2 text-left transition",
                            document.isOverdue
                              ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                              : "border-border bg-background hover:bg-accent",
                            selectedDocumentId === document.id &&
                              "border-primary/50 ring-1 ring-primary/30",
                          )}
                          onClick={() => onSelectDocument(document.id)}
                        >
                          <div className="copyable-text font-mono text-[10px] text-primary">
                            {document.documentId}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[12px] font-medium">
                            {document.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {!hasDocumentsInMonth ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
              No documents are due for review in {month.label}.
            </div>
          ) : null}

          {undatedDocuments.length > 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-4">
              <div className="text-sm font-semibold">No review due date</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                These filtered documents are not scheduled on the calendar yet.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {undatedDocuments.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] transition",
                      selectedDocumentId === document.id
                        ? "border-primary/50 bg-secondary text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() => onSelectDocument(document.id)}
                  >
                    {document.documentId} • {document.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DocumentDetailSurface({
  layout,
  documentDetail,
  lifecycle,
  availableColumns,
  isLoading,
  onClose,
  onRequestEditDocument,
  onRequestLatestVersionEdit,
  onRequestVersionEdit,
  onRequestNewVersion,
  onShowDocumentFolder,
  onShowVersionFiles,
  onRequestDeleteDocument,
  onRequestDeleteVersion,
  onOpenRevisionDescription,
  isMacOs,
}: {
  layout: "sidebar" | "modal" | "page";
  documentDetail: DocumentDetail | null;
  lifecycle: WorkspaceLifecycle;
  availableColumns: DocumentTableColumn[];
  isLoading: boolean;
  onClose: () => void;
  onRequestEditDocument: (documentRecordId?: number) => void;
  onRequestLatestVersionEdit: (documentRecordId?: number) => void;
  onRequestVersionEdit: (documentVersionId: number) => void;
  onRequestNewVersion: () => void;
  onShowDocumentFolder: () => void;
  onShowVersionFiles: (documentVersionId: number) => void;
  onRequestDeleteDocument: (documentRecordId?: number) => void;
  onRequestDeleteVersion: (documentVersionId: number) => void;
  onOpenRevisionDescription: (title: string, content: string) => void;
  isMacOs: boolean;
}) {
  const latestVersion = documentDetail?.versions[0] ?? null;
  const detailMetaCards = documentDetail
    ? [
        { label: "Document Type", value: documentDetail.typeName, show: true },
        {
          label: "Author",
          value: documentDetail.author || "—",
          show: availableColumns.includes("author"),
        },
        {
          label: "Language",
          value: documentDetail.languageCode ?? "—",
          show: availableColumns.includes("language"),
        },
        {
          label: "Confidentiality",
          value: documentDetail.confidentialityClassName ?? "—",
          show: availableColumns.includes("confidentialityClass"),
        },
        {
          label: "Group",
          value: documentDetail.groupName ?? "—",
          show: availableColumns.includes("group"),
        },
        {
          label: "Project",
          value: documentDetail.projectName ?? "—",
          show: availableColumns.includes("project"),
        },
        {
          label: "Company",
          value: documentDetail.company || "—",
          show: availableColumns.includes("company"),
        },
        {
          label: "Department",
          value: documentDetail.department || "—",
          show: availableColumns.includes("department"),
        },
        {
          label: "Start Date",
          value: formatDateShort(documentDetail.startDate),
          show: availableColumns.includes("startDate"),
        },
        {
          label: "Revision Interval",
          value: documentDetail.revisionIntervalMonths
            ? `${documentDetail.revisionIntervalMonths} months`
            : "—",
          show: availableColumns.includes("revisionIntervalMonths"),
        },
        {
          label: "Created",
          value: formatDateTime(documentDetail.createdDate),
          show: availableColumns.includes("createdDate"),
        },
        {
          label: "Modified",
          value: formatDateTime(documentDetail.modifiedDate),
          show: availableColumns.includes("modifiedDate"),
        },
      ].filter((item) => item.show)
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-border/80 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="copyable-text font-mono text-[11px]"
              >
                {documentDetail?.documentId ?? "Document detail"}
              </Badge>
              {latestVersion ? (
                <StatusBadge
                  status={latestVersion.status}
                  lifecycle={lifecycle}
                />
              ) : null}
              {documentDetail ? (
                <Badge variant="outline">
                  {documentDetail.versions.length} version
                  {documentDetail.versions.length === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <div className="copyable-text mt-3 text-xl font-semibold tracking-tight">
              {documentDetail?.title ?? "Document detail"}
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {documentDetail
                ? `${documentDetail.typeName} • ${documentDetail.author || "Unassigned author"}`
                : "Select a document to inspect metadata, versions, and managed files."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {layout !== "page" ? (
              <div className="hidden rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground sm:block">
                Esc closes this panel
                {isMacOs ? " on macOS" : ""}
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close detail view"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {documentDetail ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onRequestEditDocument(documentDetail.id)}
            >
              <PencilLine className="h-4 w-4" />
              Edit Document
            </Button>
            <Button
              variant="outline"
              disabled={!latestVersion}
              onClick={() => onRequestLatestVersionEdit(documentDetail.id)}
            >
              <CircleDot className="h-4 w-4" />
              Edit Latest Version
            </Button>
            <Button variant="outline" onClick={onShowDocumentFolder}>
              <FolderOpen className="h-4 w-4" />
              Show Folder
            </Button>
            <Button
              variant="destructive"
              onClick={() => onRequestDeleteDocument(documentDetail.id)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Document
            </Button>
            <Button onClick={onRequestNewVersion}>
              <FilePlus2 className="h-4 w-4" />
              {documentDetail.versions.length === 0
                ? "Create First Version"
                : "New Version"}
            </Button>
          </div>
        ) : null}
      </div>

      {!documentDetail && !isLoading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-dashed border-border bg-background px-5 py-8 text-center">
            <div className="text-sm font-semibold">No document selected</div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              Choose a row from the documents table to open metadata, version
              history, and file actions.
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading document detail
        </div>
      ) : null}

      {documentDetail ? (
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Overview</div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Core metadata for this document shell.
                    </div>
                  </div>
                  {latestVersion ? (
                    <DocumentProgressBadge
                      status={latestVersion.status}
                      lifecycle={lifecycle}
                    />
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {detailMetaCards.map((item) => (
                    <InfoCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Version History</div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Track release state, approvals, and managed files across
                      every version.
                    </div>
                  </div>
                  <Badge variant="outline">
                    {documentDetail.versions.length} total
                  </Badge>
                </div>

                {documentDetail.versions.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    This document does not have any versions yet. Create the
                    first version to begin managing files.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {documentDetail.versions.map((version, index) => (
                      <div
                        key={version.id}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold">
                                Version {version.versionLabel}
                              </div>
                              <StatusBadge
                                status={version.status}
                                lifecycle={lifecycle}
                              />
                              <Badge variant="outline">
                                {version.files.length} files
                              </Badge>
                              {index === 0 ? <Badge>Latest</Badge> : null}
                            </div>
                            <div className="copyable-text mt-1 font-mono text-xs text-primary">
                              {version.versionDocumentId}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Created {formatDateTime(version.createdDate)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRequestVersionEdit(version.id)}
                          >
                            <PencilLine className="h-4 w-4" />
                            Edit Version
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onShowVersionFiles(version.id)}
                          >
                            <FolderOpen className="h-4 w-4" />
                            Show Files
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRequestDeleteVersion(version.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Version
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {availableColumns.includes("releasedDate") ? (
                            <InfoCard
                              label="Released"
                              value={
                                version.releasedDate
                                  ? formatDateTime(version.releasedDate)
                                  : "—"
                              }
                            />
                          ) : null}
                          {availableColumns.includes("reviewedBy") ? (
                            <InfoCard
                              label="Reviewed By"
                              value={version.reviewedBy || "—"}
                            />
                          ) : null}
                          {availableColumns.includes("approvedBy") ? (
                            <InfoCard
                              label="Approved By"
                              value={version.approvedBy || "—"}
                            />
                          ) : null}
                          {availableColumns.includes("revisionDescription") ? (
                            <ExpandableInfoCard
                              label="Revision Description"
                              value={version.revisionDescription}
                              emptyValue="No revision description."
                              onShowMore={() =>
                                onOpenRevisionDescription(
                                  `Version ${version.versionLabel} Revision Description`,
                                  version.revisionDescription,
                                )
                              }
                            />
                          ) : null}
                        </div>

                        {version.filesystemChanges.length > 0 ? (
                          <div className="mt-3">
                            <FilesystemDriftSummary
                              compact
                              state={version.filesystemState}
                              paths={version.filesystemChanges.map(
                                (change) =>
                                  change.discoveredPath ??
                                  change.trackedPath ??
                                  change.kind,
                              )}
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="text-sm font-semibold">
                  Latest Version Spotlight
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  The current release view for approvals, publication state, and
                  document routing.
                </div>
                {latestVersion ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-card p-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={latestVersion.status}
                          lifecycle={lifecycle}
                        />
                        <div className="font-semibold">
                          Version {latestVersion.versionLabel}
                        </div>
                      </div>
                      <div className="copyable-text mt-2 font-mono text-xs text-primary">
                        {latestVersion.versionDocumentId}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <InfoCard
                        label="Released"
                        value={
                          latestVersion.releasedDate
                            ? formatDateTime(latestVersion.releasedDate)
                            : "—"
                        }
                      />
                      {availableColumns.includes("reviewedBy") ? (
                        <InfoCard
                          label="Reviewed By"
                          value={latestVersion.reviewedBy || "—"}
                        />
                      ) : null}
                      <InfoCard
                        label="Approved By"
                        value={latestVersion.approvedBy || "—"}
                      />
                      <ExpandableInfoCard
                        label="Revision Description"
                        value={latestVersion.revisionDescription}
                        emptyValue="No revision description."
                        onShowMore={() =>
                          onOpenRevisionDescription(
                            `Version ${latestVersion.versionLabel} Revision Description`,
                            latestVersion.revisionDescription,
                          )
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    This document shell does not have a latest version yet.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="text-sm font-semibold">Managed Location</div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Files for this document are managed inside the workspace
                  folder structure.
                </div>
                <div className="mt-4 rounded-xl border border-border bg-card px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Document Folder
                  </div>
                  <div className="copyable-text mt-2 break-all font-mono text-xs text-primary">
                    {documentDetail.documentFolderPath}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onShowDocumentFolder}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Document Folder
                  </Button>
                  {latestVersion ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShowVersionFiles(latestVersion.id)}
                    >
                      <CircleDot className="h-4 w-4" />
                      Open Latest Files
                    </Button>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DocumentTypesView({
  workspace,
  onCreateType,
  onEditType,
  onDeleteType,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateType: () => void;
  onEditType: (type: DocumentType) => void;
  onDeleteType: (type: DocumentType) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="text-lg font-semibold">Document Types</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Prefix-managed document categories for structured numeric IDs
          </div>
        </div>
        <Button onClick={onCreateType}>
          <Plus className="h-4 w-4" />
          Add Document Type
        </Button>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {workspace.documentTypes.map((type) => (
          <div
            key={type.id}
            className="rounded-xl border border-border bg-background p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="copyable-text font-mono text-xs text-primary">
                  {type.numberPrefix}
                </div>
                <div className="copyable-text mt-1.5 text-base font-semibold">
                  {type.name}
                </div>
              </div>
              <Badge variant="outline">2-digit prefix</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditType(type)}
              >
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteType(type)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsView({
  workspace,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onAssignProject,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateProject: () => void;
  onEditProject: (project: Group) => void;
  onDeleteProject: (project: Group) => void;
  onAssignProject: (document: DocumentListItem, nextProjectId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const totalAssignedDocuments = workspace.documents.filter(
    (document) => document.groupId !== null,
  ).length;
  const filteredDocuments = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return workspace.documents
      .filter((document) => {
        const matchesSearch =
          !query ||
          [
            document.documentId,
            document.title,
            document.typeName,
            document.groupName ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesAssignment =
          assignmentFilter === "all"
            ? true
            : assignmentFilter === "assigned"
              ? document.groupId !== null
              : document.groupId === null;
        const matchesProject =
          projectFilter === "all"
            ? true
            : String(document.groupId ?? "") === projectFilter;

        return matchesSearch && matchesAssignment && matchesProject;
      })
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        }),
      );
  }, [assignmentFilter, deferredSearch, projectFilter, workspace.documents]);

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <div className="text-lg font-semibold">Groups</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Group related documents inside one workspace group.
            </div>
          </div>
          <Button onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
            Add Group
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total Groups
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {workspace.groups.length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Assigned Documents
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {totalAssignedDocuments}
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
          {workspace.groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No groups yet. Create a group, then assign existing documents
              from the panel on the right.
            </div>
          ) : (
            workspace.groups.map((project) => {
              const documentCount = workspace.documents.filter(
                (document) => document.groupId === project.id,
              ).length;

              return (
                <div
                  key={project.id}
                  className="rounded-xl border border-border bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">
                        {project.name}
                      </div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {documentCount} document{documentCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Badge variant="outline">Workspace group</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditProject(project)}
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteProject(project)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="border-b border-border/80 pb-3">
          <div className="text-lg font-semibold">Assign Documents</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Quickly move existing documents into a group or clear the
            assignment.
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_200px]">
          <Field label="Search Documents">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder="Search by title, ID, type, or group"
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Assignment State">
            <Select
              value={assignmentFilter}
              onChange={(event) =>
                setAssignmentFilter(
                  event.target.value as "all" | "assigned" | "unassigned",
                )
              }
            >
              <option value="all">All documents</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </Select>
          </Field>
          <Field label="Group Filter">
            <Select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All groups</option>
              <option value="">No group</option>
              {workspace.groups.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-3">
          <div className="text-[13px] text-muted-foreground">
            Showing {filteredDocuments.length} of {workspace.documents.length}{" "}
            document{workspace.documents.length === 1 ? "" : "s"}.
          </div>
          <div className="text-xs text-muted-foreground">
            {totalAssignedDocuments} assigned,{" "}
            {workspace.documents.length - totalAssignedDocuments} unassigned
          </div>
        </div>

        <div className="mt-4 max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
          {workspace.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No documents yet. Create a document first, then assign it to a
              group here.
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No documents match the current group filters.
            </div>
          ) : (
            filteredDocuments.map((document) => (
              <div
                key={document.id}
                className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_240px]"
              >
                <div className="min-w-0">
                  <div className="copyable-text font-mono text-xs text-primary">
                    {document.documentId}
                  </div>
                  <div className="copyable-text mt-1 text-sm font-semibold">
                    {document.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{document.typeName}</span>
                    <span>•</span>
                    <span>{document.groupName ?? "No group"}</span>
                    {document.status ? (
                      <>
                        <span>•</span>
                        <span>{document.status}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Field label="Group">
                  <Select
                    value={document.groupId ? String(document.groupId) : ""}
                    onChange={(event) =>
                      void onAssignProject(document, event.target.value)
                    }
                  >
                    <option value="">No group</option>
                    {workspace.groups.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TemplatesView({
  workspace,
  onCreateTemplate,
  onAddFiles,
  onOpenTemplatesFolder,
  onOpenTemplateFolder,
  onDeleteTemplate,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateTemplate: () => void;
  onAddFiles: (template: TemplateSummary) => void;
  onOpenTemplatesFolder: () => void;
  onOpenTemplateFolder: (template: TemplateSummary) => void;
  onDeleteTemplate: (template: TemplateSummary) => void;
}) {
  const totalTemplateFiles = workspace.templates.reduce(
    (total, template) => total + template.fileCount,
    0,
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="text-lg font-semibold">Templates</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Reusable workspace document starters stored in the root Templates
            folder.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenTemplatesFolder}>
            <FolderOpen className="h-4 w-4" />
            Open Templates Folder
          </Button>
          <Button onClick={onCreateTemplate}>
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Templates
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {workspace.templates.length}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Template Files
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {totalTemplateFiles}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
            No templates yet. Create one, add files, and use it when creating a
            new document.
          </div>
        ) : (
          workspace.templates.map((template) => {
            return (
              <div
                key={template.id}
                className="rounded-xl border border-border bg-background p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="copyable-text text-base font-semibold">
                      {template.name}
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      {template.fileCount} file
                      {template.fileCount === 1 ? "" : "s"}
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-primary">
                      {template.folderPath}
                    </div>
                  </div>
                  <Badge variant="outline">Template</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.files.length === 0 ? (
                    <Badge variant="outline">No files yet</Badge>
                  ) : (
                    template.files.map((file) => (
                      <Badge key={file.filePath} variant="outline">
                        {file.fileName}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddFiles(template)}
                  >
                    <Upload className="h-4 w-4" />
                    Add Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenTemplateFolder(template)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Folder
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteTemplate(template)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClassificationsView({
  workspace,
  onCreateConfidentialityClass,
  onEditConfidentialityClass,
  onDeleteConfidentialityClass,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateConfidentialityClass: () => void;
  onEditConfidentialityClass: (item: ConfidentialityClass) => void;
  onDeleteConfidentialityClass: (item: ConfidentialityClass) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="text-lg font-semibold">Confidentiality Classes</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Workspace-defined selectable classes for document handling.
          </div>
        </div>
        <Button onClick={onCreateConfidentialityClass}>
          <Plus className="h-4 w-4" />
          Add Class
        </Button>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {workspace.confidentialityClasses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
            No confidentiality classes defined yet.
          </div>
        ) : (
          workspace.confidentialityClasses.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <div className="text-base font-semibold">{item.name}</div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditConfidentialityClass(item)}
                >
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteConfidentialityClass(item)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LanguagesView({
  workspace,
  onCreateLanguage,
  onEditLanguage,
  onDeleteLanguage,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateLanguage: () => void;
  onEditLanguage: (item: WorkspaceLanguage) => void;
  onDeleteLanguage: (item: WorkspaceLanguage) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="text-lg font-semibold">Languages</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Short workspace language codes shown in the documents table and
            document metadata forms.
          </div>
        </div>
        <Button onClick={onCreateLanguage}>
          <Plus className="h-4 w-4" />
          Add Language
        </Button>
      </div>

      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {workspace.languages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
            No languages defined yet.
          </div>
        ) : (
          workspace.languages.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-background p-4 shadow-sm"
            >
              <div className="font-mono text-base font-semibold">
                {item.code}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditLanguage(item)}
                >
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteLanguage(item)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilesystemDriftSummary({
  state,
  paths,
  compact = false,
}: {
  state: "clean" | "dirty" | "ambiguous";
  paths: string[];
  compact?: boolean;
}) {
  const containerClassName =
    state === "ambiguous"
      ? "border-destructive/60 bg-destructive/10 text-destructive"
      : "border-destructive/40 bg-destructive/5 text-destructive";

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        containerClassName,
        compact ? "text-xs" : "text-[13px]",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            Action required: filesystem drift detected
          </div>
          <div className="mt-1 text-current/90">
            Review this version before trusting the tracked file list.
          </div>
          <div className="mt-1 break-words">
            {state === "ambiguous"
              ? "Ambiguous changes found."
              : "Changes found."}{" "}
            {paths.join(", ")}
          </div>
        </div>
      </div>
    </div>
  );
}

function getWorkspaceFilesystemAttentionCounts(
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string],
) {
  const unmanagedPathDocuments = workspace.documents.filter((document) =>
    document.healthFlags.includes("unmanagedPaths"),
  );
  const missingFileDocuments = workspace.documents.filter((document) =>
    document.healthFlags.includes("missingFiles"),
  );
  const attentionDocumentIds = new Set<number>([
    ...unmanagedPathDocuments.map((document) => document.id),
    ...missingFileDocuments.map((document) => document.id),
  ]);

  return {
    unmanagedPathDocumentCount: unmanagedPathDocuments.length,
    missingFileDocumentCount: missingFileDocuments.length,
    totalAttentionCount: attentionDocumentIds.size,
  };
}

function documentNeedsFilesystemReview(document: DocumentListItem) {
  return (
    document.healthFlags.includes("unmanagedPaths") ||
    document.healthFlags.includes("missingFiles")
  );
}

function versionNeedsFilesystemReview(version: DocumentVersion) {
  return (
    version.filesystemState !== "clean" ||
    version.filesystemChanges.length > 0 ||
    version.unmanagedPaths.length > 0
  );
}

function WorkspaceDialog({
  state,
  onStateChange,
  onSubmit,
}: {
  state: WorkspaceDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<WorkspaceDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(open ? { ...state, open } : defaultWorkspaceDialogState)
      }
    >
      <DialogContent className="w-[min(94vw,960px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            DocTrack will create a workspace folder with
            `Database/workspace.sqlite` and `Documents`.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-4 px-1 py-1 pr-2">
            <Field label="Workspace Name" error={state.validationErrors.name}>
              <Input
                aria-invalid={Boolean(state.validationErrors.name)}
                placeholder="Quality Operations"
                value={state.name}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...applyInputChange(current, "name", {
                      name: event.target.value,
                    }),
                    folderName:
                      !current.useCustomFolderName && !current.folderName
                        ? event.target.value
                        : current.folderName,
                  }))
                }
              />
            </Field>

            <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]">
              <input
                checked={state.useCustomFolderName}
                className="mt-1"
                type="checkbox"
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    useCustomFolderName: event.target.checked,
                    folderName:
                      event.target.checked && !current.folderName
                        ? current.name
                        : current.folderName,
                  }))
                }
              />
              <span>
                <span className="block font-medium">
                  Use a different folder name
                </span>
                <span className="text-muted-foreground">
                  Keep the workspace name in DocTrack while choosing a different
                  folder name on disk.
                </span>
              </span>
            </label>

            {state.useCustomFolderName ? (
              <Field
                label="Folder Name"
                error={state.validationErrors.folderName}
              >
                <Input
                  aria-invalid={Boolean(state.validationErrors.folderName)}
                  placeholder="quality-operations"
                  value={state.folderName}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "folderName", {
                        folderName: event.target.value,
                      }),
                    )
                  }
                />
              </Field>
            ) : null}

            <Field
              label="Workspace Location"
              error={state.validationErrors.parentPath}
            >
              <div className="flex gap-2">
                <Input
                  aria-invalid={Boolean(state.validationErrors.parentPath)}
                  placeholder="/Users/you/Documents"
                  value={state.parentPath}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "parentPath", {
                        parentPath: event.target.value,
                      }),
                    )
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const folderLabel =
                      (state.useCustomFolderName
                        ? state.folderName
                        : state.name) ||
                      state.name ||
                      "DocTrack Workspace";

                    void window.docTrack.dialogs
                      .pickWorkspaceCreatePath(folderLabel)
                      .then((parentPath) => {
                        if (parentPath) {
                          onStateChange((current) =>
                            applyInputChange(current, "parentPath", {
                              parentPath,
                            }),
                          );
                        }
                      });
                  }}
                >
                  Browse
                </Button>
              </div>
            </Field>

            <ToggleSetting
              title="Enable local user sign-in"
              description="Store workspace users inside the SQLite database and require sign-in before editing this workspace."
              checked={state.settings.userSystemEnabled}
              onChange={(checked) =>
                onStateChange((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    userSystemEnabled: checked,
                  },
                  validationErrors: {},
                }))
              }
            />

            {state.settings.userSystemEnabled ? (
              <div className="grid gap-4 rounded-2xl border border-border bg-background p-4 md:grid-cols-3">
                <Field
                  label="Admin Display Name"
                  error={state.validationErrors.initialAdminDisplayName}
                >
                  <Input
                    aria-invalid={Boolean(
                      state.validationErrors.initialAdminDisplayName,
                    )}
                    placeholder="Taylor Reed"
                    value={state.initialAdminDisplayName}
                    onChange={(event) =>
                      onStateChange((current) =>
                        applyInputChange(current, "initialAdminDisplayName", {
                          initialAdminDisplayName: event.target.value,
                        }),
                      )
                    }
                  />
                </Field>

                <Field label="Admin Username">
                  <Input
                    placeholder="admin"
                    value={state.initialAdminUsername}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        initialAdminUsername: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  label="Admin Password / PIN"
                  error={state.validationErrors.initialAdminPassword}
                >
                  <Input
                    aria-invalid={Boolean(
                      state.validationErrors.initialAdminPassword,
                    )}
                    type="password"
                    value={state.initialAdminPassword}
                    onChange={(event) =>
                      onStateChange((current) =>
                        applyInputChange(current, "initialAdminPassword", {
                          initialAdminPassword: event.target.value,
                        }),
                      )
                    }
                  />
                </Field>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-[13px] text-muted-foreground">
                This workspace will open without sign-in and will use free-text
                author, reviewer, and approver fields.
              </div>
            )}

            <WorkspaceStorageSettingsFields
              workspaceName={
                state.useCustomFolderName
                  ? state.folderName || state.name
                  : state.name
              }
              settings={state.settings}
              lifecycle={state.lifecycle}
              showBrandingControls={false}
              validationErrors={state.validationErrors}
              showAdvancedSettings
              isAdvancedSettingsOpen={state.isAdvancedSettingsOpen}
              originalLifecycle={undefined}
              statusRemaps={undefined}
              companyLogoSourceFilePath={null}
              clearCompanyLogo={false}
              onSettingsChange={(settings) =>
                onStateChange((current) => ({
                  ...current,
                  settings,
                  validationErrors: {},
                }))
              }
              onLifecycleChange={(lifecycle) =>
                onStateChange((current) => ({
                  ...current,
                  lifecycle,
                  validationErrors: {},
                }))
              }
              onStatusRemapsChange={() => undefined}
              onAdvancedSettingsOpenChange={(open) =>
                onStateChange((current) => ({
                  ...current,
                  isAdvancedSettingsOpen: open,
                }))
              }
              onLogoSelect={() => undefined}
              onLogoRemove={() => undefined}
            />

            <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]">
              <input
                checked={state.includeExampleData}
                className="mt-1"
                type="checkbox"
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    includeExampleData: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="block font-medium">Seed starter data</span>
                <span className="text-muted-foreground">
                  Adds example document types and sample documents so the
                  workspace opens with realistic data.
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onStateChange(defaultWorkspaceDialogState)}
          >
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TableColumnsDialog({
  state,
  availableColumns,
  onStateChange,
  onSubmit,
}: {
  state: TableColumnsDialogState;
  availableColumns: DocumentTableColumn[];
  onStateChange: React.Dispatch<React.SetStateAction<TableColumnsDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  const columnOptions = DOCUMENT_TABLE_COLUMN_OPTIONS.filter((column) =>
    availableColumns.includes(column.value),
  );

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(
          open ? { ...state, open } : defaultTableColumnsDialogState,
        )
      }
    >
      <DialogContent className="w-[min(88vw,380px)] max-h-[72vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>Table View Settings</DialogTitle>
          <DialogDescription>
            Choose which workspace columns this app should show in the documents
            table.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {columnOptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                No table columns are enabled for this workspace.
              </div>
            ) : (
              columnOptions.map((column) => (
                <label
                  key={column.value}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]"
                >
                  <input
                    checked={state.visibleColumns.includes(column.value)}
                    className="mt-1"
                    type="checkbox"
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        visibleColumns: event.target.checked
                          ? [...current.visibleColumns, column.value]
                          : current.visibleColumns.filter(
                              (item) => item !== column.value,
                            ),
                        validationErrors: clearValidationError(
                          current.validationErrors,
                          "visibleColumns",
                        ),
                      }))
                    }
                  />
                  <span>{column.label}</span>
                </label>
              ))
            )}
            {state.validationErrors.visibleColumns ? (
              <div className="text-xs text-destructive">
                {state.validationErrors.visibleColumns}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onStateChange(defaultTableColumnsDialogState)}
          >
            Cancel
          </Button>
          <Button
            disabled={
              state.isSubmitting ||
              columnOptions.length === 0 ||
              state.visibleColumns.length === 0
            }
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentExportDialog({
  state,
  groupingOptions,
  onStateChange,
  onSubmit,
}: {
  state: DocumentExportDialogState;
  groupingOptions: ExportGroupingOption[];
  onStateChange: React.Dispatch<
    React.SetStateAction<DocumentExportDialogState>
  >;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(
          open ? { ...state, open } : defaultDocumentExportDialogState,
        )
      }
    >
      <DialogContent className="w-[min(88vw,440px)]">
        <DialogHeader>
          <DialogTitle>Export Documents</DialogTitle>
          <DialogDescription>
            Create a CSV data export or a structured PDF report from the
            documents table.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Format">
            <Select
              value={state.format}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  format: event.target.value as "csv" | "pdf",
                }))
              }
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </Select>
          </Field>

          <Field label="Scope">
            <Select
              value={state.scope}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  scope: event.target.value as DocumentExportScope,
                }))
              }
            >
              <option value="current-table">Current Table</option>
              <option value="whole-workspace">Whole Workspace</option>
            </Select>
          </Field>

          {state.format === "pdf" ? (
            <>
              <Field label="Group By">
                <Select
                  value={state.groupBy}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      groupBy: event.target.value as DocumentExportGrouping,
                    }))
                  }
                >
                  {groupingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Appearance">
                <Select
                  value={state.pdfColorMode}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      pdfColorMode: event.target
                        .value as DocumentExportPdfColorMode,
                    }))
                  }
                >
                  <option value="color">Color</option>
                  <option value="black-and-white">Black and White</option>
                </Select>
              </Field>
            </>
          ) : null}

          <div className="rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-muted-foreground">
            {state.format === "csv"
              ? `${getDocumentExportScopeLabel(state.scope)} will be exported as a flat spreadsheet-friendly file.`
              : `${getDocumentExportScopeLabel(state.scope)} will be exported as a polished PDF report.`}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onStateChange(defaultDocumentExportDialogState)}
          >
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileStack className="h-4 w-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettingsDialog({
  state,
  currentPermissions,
  assignedCustomRoles,
  onStateChange,
  onSubmit,
  onOpenRoleSettings,
  onSaveRoleSettings,
}: {
  state: WorkspaceSettingsDialogState;
  currentPermissions?: NonNullable<
    ReturnType<typeof useAppStore.getState>["openWorkspaces"][string]["session"]
  >["permissions"];
  assignedCustomRoles: Array<[roleKey: string, roleName: string]>;
  onStateChange: React.Dispatch<
    React.SetStateAction<WorkspaceSettingsDialogState>
  >;
  onSubmit: () => Promise<void>;
  onOpenRoleSettings: (mode?: WorkspaceRoleMode) => void;
  onSaveRoleSettings: () => Promise<void>;
}) {
  const canManageWorkspaceSettings = Boolean(
    currentPermissions?.canManageWorkspaceSettings,
  );
  const canManageRoles = Boolean(currentPermissions?.canManageRoles);
  const roleModeLabel =
    state.roleSettings.mode === "custom" ? "Custom roles" : "Default roles";

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(
          open ? { ...state, open } : defaultWorkspaceSettingsDialogState,
        )
      }
    >
      <DialogContent className="w-[min(94vw,960px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Update workspace-wide storage rules, metadata defaults, and which
            fields are enabled at all in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          <div className="px-1 py-1 pr-2">
            <div className="mb-4 grid gap-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div>
                  <div className="text-base font-semibold">
                    Permissions & Authentication
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    Configure local sign-in access and choose whether this
                    workspace uses the built-in role model or custom roles.
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <ToggleSetting
                    title="Enable local user sign-in"
                    description="Require workspace sign-in and use workspace user records for author, reviewer, and approver metadata."
                    checked={state.settings.userSystemEnabled}
                    disabled={!canManageWorkspaceSettings}
                    onChange={(checked) =>
                      onStateChange((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          userSystemEnabled: checked,
                        },
                        validationErrors: {},
                      }))
                    }
                  />

                  {!state.originalSettings?.userSystemEnabled &&
                  state.settings.userSystemEnabled ? (
                    <div className="grid gap-4 rounded-2xl border border-border bg-background p-4 md:grid-cols-3">
                      <Field label="Bootstrap Admin Display Name">
                        <Input
                          disabled={!canManageWorkspaceSettings}
                          placeholder="Taylor Reed"
                          value={state.initialAdminDisplayName}
                          onChange={(event) =>
                            onStateChange((current) =>
                              applyInputChange(
                                current,
                                "initialAdminDisplayName",
                                {
                                  initialAdminDisplayName: event.target.value,
                                },
                              ),
                            )
                          }
                        />
                      </Field>

                      <Field label="Bootstrap Admin Username">
                        <Input
                          disabled={!canManageWorkspaceSettings}
                          placeholder="admin"
                          value={state.initialAdminUsername}
                          onChange={(event) =>
                            onStateChange((current) => ({
                              ...current,
                              initialAdminUsername: event.target.value,
                            }))
                          }
                        />
                      </Field>

                      <Field label="Bootstrap Admin Password / PIN">
                        <Input
                          disabled={!canManageWorkspaceSettings}
                          type="password"
                          value={state.initialAdminPassword}
                          onChange={(event) =>
                            onStateChange((current) =>
                              applyInputChange(
                                current,
                                "initialAdminPassword",
                                {
                                  initialAdminPassword: event.target.value,
                                },
                              ),
                            )
                          }
                        />
                      </Field>

                      <div className="md:col-span-3 text-xs text-muted-foreground">
                        Only needed if this workspace does not already have any
                        local users.
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">Roles</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {state.settings.userSystemEnabled
                            ? "Choose the role model for workspace users and open the designer to review or edit role definitions."
                            : "Role rules are saved per workspace and take effect whenever local user sign-in is enabled."}
                        </div>
                      </div>
                      <Badge variant="outline">{roleModeLabel}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant={
                          state.roleSettings.mode === "default"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        disabled={!canManageRoles}
                        onClick={() => onOpenRoleSettings("default")}
                      >
                        Default
                      </Button>
                      <Button
                        variant={
                          state.roleSettings.mode === "custom"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        disabled={!canManageRoles}
                        onClick={() => onOpenRoleSettings("custom")}
                      >
                        Custom
                      </Button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200",
                          !canManageRoles && "cursor-not-allowed opacity-70",
                        )}
                        disabled={!canManageRoles}
                        onClick={() => onOpenRoleSettings("custom")}
                      >
                        <Settings className="h-4 w-4" />
                        Role Designer
                      </button>
                    </div>

                    {!canManageRoles ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Your account can view the active role model but cannot
                        change workspace roles.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {!canManageWorkspaceSettings ? (
                <div className="text-xs text-muted-foreground">
                  Workspace storage and metadata settings are visible here, but
                  your account cannot save changes to them.
                </div>
              ) : null}
            </div>

            <WorkspaceStorageSettingsFields
              workspaceName={state.workspaceName}
              settings={state.settings}
              lifecycle={state.lifecycle}
              validationErrors={state.validationErrors}
              showAdvancedSettings
              isAdvancedSettingsOpen={state.isAdvancedSettingsOpen}
              originalLifecycle={state.originalLifecycle}
              statusRemaps={state.statusRemaps}
              companyLogoSourceFilePath={state.companyLogoSourceFilePath}
              clearCompanyLogo={state.clearCompanyLogo}
              onSettingsChange={(settings) =>
                onStateChange((current) => ({
                  ...current,
                  settings,
                  validationErrors: {},
                }))
              }
              onLifecycleChange={(lifecycle) =>
                onStateChange((current) => ({
                  ...current,
                  lifecycle,
                  validationErrors: {},
                }))
              }
              onStatusRemapsChange={(statusRemaps) =>
                onStateChange((current) => ({
                  ...current,
                  statusRemaps,
                  validationErrors: {},
                }))
              }
              onAdvancedSettingsOpenChange={(open) =>
                onStateChange((current) => ({
                  ...current,
                  isAdvancedSettingsOpen: open,
                }))
              }
              onLogoSelect={(filePath) =>
                onStateChange((current) => ({
                  ...current,
                  companyLogoSourceFilePath: filePath,
                  clearCompanyLogo: false,
                  validationErrors: {},
                }))
              }
              onLogoRemove={() =>
                onStateChange((current) => ({
                  ...current,
                  companyLogoSourceFilePath: null,
                  clearCompanyLogo: true,
                  settings: {
                    ...current.settings,
                    companyLogoPath: "",
                  },
                  validationErrors: {},
                }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onStateChange(defaultWorkspaceSettingsDialogState)}
          >
            Cancel
          </Button>
          <Button
            disabled={state.isSubmitting || !canManageWorkspaceSettings}
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </DialogFooter>

        <WorkspaceRoleSettingsDialog
          state={state.roleSettingsDialog}
          currentRoleSettings={state.roleSettings}
          assignedCustomRoles={assignedCustomRoles}
          canManageRoles={canManageRoles}
          onOpenChange={(open) =>
            onStateChange((current) => ({
              ...current,
              roleSettingsDialog: open
                ? current.roleSettingsDialog
                : {
                    ...current.roleSettingsDialog,
                    open: false,
                    isSubmitting: false,
                    message: "",
                  },
            }))
          }
          onStateChange={(updater) =>
            onStateChange((current) => ({
              ...current,
              roleSettingsDialog:
                typeof updater === "function"
                  ? updater(current.roleSettingsDialog)
                  : updater,
            }))
          }
          onSave={onSaveRoleSettings}
        />
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceLifecycleSettingsFields({
  lifecycle,
  validationErrors,
  onLifecycleChange,
  originalLifecycle,
  statusRemaps,
  onStatusRemapsChange,
}: {
  lifecycle: WorkspaceLifecycle;
  validationErrors: ValidationErrors;
  onLifecycleChange: (lifecycle: WorkspaceLifecycle) => void;
  originalLifecycle?: WorkspaceLifecycle;
  statusRemaps?: Record<string, string>;
  onStatusRemapsChange?: (statusRemaps: Record<string, string>) => void;
}) {
  const orderedStatuses = getWorkspaceLifecycleStatuses(lifecycle);
  const removedStatuses = getRemovedLifecycleStatuses(
    originalLifecycle,
    lifecycle,
  );

  return (
    <Field label="Document Lifecycle" error={validationErrors.lifecycle}>
      <div className="grid gap-4 rounded-xl border border-border bg-background p-3">
        <Field label="Lifecycle Mode">
          <Select
            value={lifecycle.mode}
            onChange={(event) =>
              onLifecycleChange(
                setWorkspaceLifecycleMode(
                  lifecycle,
                  event.target.value as WorkspaceLifecycle["mode"],
                ),
              )
            }
          >
            <option value="default">Default lifecycle</option>
            <option value="custom">Custom lifecycle</option>
          </Select>
        </Field>

        {lifecycle.mode === "default" ? (
          <div className="rounded-xl border border-border bg-card p-3 text-[13px]">
            <div className="font-medium">Built-in simplified workflow</div>
            <div className="mt-1 text-muted-foreground">
              Uses the fixed statuses with permissive transitions and no
              required metadata rules.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {orderedStatuses.map((status) => (
                <Badge
                  key={status.key}
                  variant={getLifecycleBadgeVariant(status.role)}
                >
                  {status.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Statuses</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Define the status names, semantic roles, order, and metadata
                    requirements for this workspace.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onLifecycleChange(addWorkspaceLifecycleStatus(lifecycle))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Status
                </Button>
              </div>

              <div className="mt-3 grid gap-3">
                {orderedStatuses.map((status, index) => (
                  <div
                    key={status.key}
                    className="rounded-xl border border-border bg-background p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[220px] flex-1">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Status Name
                        </div>
                        <Input
                          value={status.name}
                          onChange={(event) =>
                            onLifecycleChange(
                              updateWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                (current) => ({
                                  ...current,
                                  name: event.target.value,
                                }),
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="w-[180px]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Semantic Role
                        </div>
                        <Select
                          value={status.role}
                          onChange={(event) =>
                            onLifecycleChange(
                              updateWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                (current) => ({
                                  ...current,
                                  role: event.target
                                    .value as WorkspaceStatusDefinition["role"],
                                }),
                              ),
                            )
                          }
                        >
                          <option value="draft">Draft</option>
                          <option value="review">Review</option>
                          <option value="released">Released</option>
                          <option value="archived">Archived</option>
                          <option value="obsolete">Obsolete</option>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === 0}
                          onClick={() =>
                            onLifecycleChange(
                              moveWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                -1,
                              ),
                            )
                          }
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === orderedStatuses.length - 1}
                          onClick={() =>
                            onLifecycleChange(
                              moveWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                1,
                              ),
                            )
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={orderedStatuses.length <= 1}
                          onClick={() =>
                            onLifecycleChange(
                              removeWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                              ),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <label className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
                        <input
                          checked={status.requiresReleasedDate}
                          className="mt-1"
                          type="checkbox"
                          onChange={(event) =>
                            onLifecycleChange(
                              updateWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                (current) => ({
                                  ...current,
                                  requiresReleasedDate: event.target.checked,
                                }),
                              ),
                            )
                          }
                        />
                        <span>Require Released Date</span>
                      </label>
                      <label className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
                        <input
                          checked={status.requiresReviewedBy}
                          className="mt-1"
                          type="checkbox"
                          onChange={(event) =>
                            onLifecycleChange(
                              updateWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                (current) => ({
                                  ...current,
                                  requiresReviewedBy: event.target.checked,
                                }),
                              ),
                            )
                          }
                        />
                        <span>Require Reviewed By</span>
                      </label>
                      <label className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
                        <input
                          checked={status.requiresApprovedBy}
                          className="mt-1"
                          type="checkbox"
                          onChange={(event) =>
                            onLifecycleChange(
                              updateWorkspaceLifecycleStatus(
                                lifecycle,
                                status.key,
                                (current) => ({
                                  ...current,
                                  requiresApprovedBy: event.target.checked,
                                }),
                              ),
                            )
                          }
                        />
                        <span>Require Approved By</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {orderedStatuses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Initial Version Status">
                  <Select
                    value={lifecycle.initialStatusKey}
                    onChange={(event) =>
                      onLifecycleChange({
                        ...lifecycle,
                        initialStatusKey: event.target.value,
                      })
                    }
                  >
                    {orderedStatuses.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Previous Version Auto-Status">
                  <Select
                    value={lifecycle.autoPreviousVersionStatusKey ?? ""}
                    onChange={(event) =>
                      onLifecycleChange({
                        ...lifecycle,
                        autoPreviousVersionStatusKey:
                          event.target.value || null,
                      })
                    }
                  >
                    <option value="">No automatic status</option>
                    {orderedStatuses.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}

            {orderedStatuses.length > 1 ? (
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-medium">Allowed Transitions</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Choose which status changes are allowed when users update the
                  latest version.
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-2 text-[13px]">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          From / To
                        </th>
                        {orderedStatuses.map((status) => (
                          <th
                            key={status.key}
                            className="min-w-[112px] px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                          >
                            {status.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderedStatuses.map((fromStatus) => (
                        <tr key={fromStatus.key}>
                          <td className="rounded-lg border border-border bg-background px-3 py-2 font-medium">
                            {fromStatus.name}
                          </td>
                          {orderedStatuses.map((toStatus) => {
                            const checked = lifecycle.allowedTransitions.some(
                              (transition) =>
                                transition.fromStatusKey === fromStatus.key &&
                                transition.toStatusKey === toStatus.key,
                            );

                            return (
                              <td
                                key={`${fromStatus.key}:${toStatus.key}`}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                              >
                                {fromStatus.key === toStatus.key ? (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                ) : (
                                  <label className="flex items-center gap-2">
                                    <input
                                      checked={checked}
                                      type="checkbox"
                                      onChange={(event) =>
                                        onLifecycleChange(
                                          toggleWorkspaceLifecycleTransition(
                                            lifecycle,
                                            fromStatus.key,
                                            toStatus.key,
                                            event.target.checked,
                                          ),
                                        )
                                      }
                                    />
                                    <span>
                                      {checked ? "Allowed" : "Blocked"}
                                    </span>
                                  </label>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {removedStatuses.length > 0 &&
            statusRemaps &&
            onStatusRemapsChange &&
            orderedStatuses.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-medium">Removed Status Mapping</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Choose replacements for removed statuses. DocTrack will use
                  these mappings if existing versions or saved views still
                  reference them.
                </div>

                <div className="mt-3 grid gap-3">
                  {removedStatuses.map((status) => (
                    <Field key={status.key} label={status.name}>
                      <Select
                        value={statusRemaps[status.key] ?? ""}
                        onChange={(event) =>
                          onStatusRemapsChange({
                            ...statusRemaps,
                            [status.key]: event.target.value,
                          })
                        }
                      >
                        <option value="">No replacement selected</option>
                        {orderedStatuses.map((nextStatus) => (
                          <option key={nextStatus.key} value={nextStatus.key}>
                            {nextStatus.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Field>
  );
}

function WorkspaceStorageSettingsFields({
  workspaceName,
  settings,
  lifecycle,
  validationErrors,
  showAdvancedSettings = false,
  isAdvancedSettingsOpen = false,
  showBrandingControls = true,
  originalLifecycle,
  statusRemaps,
  companyLogoSourceFilePath,
  clearCompanyLogo,
  onSettingsChange,
  onLifecycleChange,
  onStatusRemapsChange,
  onAdvancedSettingsOpenChange,
  onLogoSelect,
  onLogoRemove,
}: {
  workspaceName: string;
  settings: WorkspaceSettings;
  lifecycle: WorkspaceLifecycle;
  validationErrors: ValidationErrors;
  showAdvancedSettings?: boolean;
  isAdvancedSettingsOpen?: boolean;
  showBrandingControls?: boolean;
  originalLifecycle?: WorkspaceLifecycle;
  statusRemaps?: Record<string, string>;
  companyLogoSourceFilePath: string | null;
  clearCompanyLogo: boolean;
  onSettingsChange: (settings: WorkspaceSettings) => void;
  onLifecycleChange: (lifecycle: WorkspaceLifecycle) => void;
  onStatusRemapsChange?: (statusRemaps: Record<string, string>) => void;
  onAdvancedSettingsOpenChange?: (open: boolean) => void;
  onLogoSelect: (filePath: string) => void;
  onLogoRemove: () => void;
}) {
  const [showDocumentIdPlaceholders, setShowDocumentIdPlaceholders] =
    useState(false);
  const [showWorkspaceSetupPreview, setShowWorkspaceSetupPreview] =
    useState(false);
  const selectedStorageOption =
    WORKSPACE_STORAGE_LAYOUT_OPTIONS.find(
      (option) => option.value === settings.storageLayoutPreset,
    ) ?? WORKSPACE_STORAGE_LAYOUT_OPTIONS[0];
  const selectedFileOrganizationOption =
    WORKSPACE_FILE_ORGANIZATION_OPTIONS.find(
      (option) => option.value === settings.fileOrganizationMode,
    ) ?? WORKSPACE_FILE_ORGANIZATION_OPTIONS[0];
  const selectedVersionManagementOption =
    WORKSPACE_VERSION_MANAGEMENT_OPTIONS.find(
      (option) => option.value === settings.versionManagementMode,
    ) ?? WORKSPACE_VERSION_MANAGEMENT_OPTIONS[0];
  const selectedDocumentIdOption =
    DOCUMENT_ID_FORMAT_OPTIONS.find(
      (option) => option.value === settings.documentIdFormatPreset,
    ) ?? DOCUMENT_ID_FORMAT_OPTIONS[0];
  const activeDocumentIdTemplate = resolveDocumentIdFormatTemplate(settings);
  const previewWorkspaceName = workspaceName.trim() || "Quality Operations";
  const previewDocumentIds = [
    buildDocumentIdPreview(settings, 1),
    buildDocumentIdPreview(settings, 2),
    buildDocumentIdPreview(settings, 3),
  ];
  const previewVersionFolderPath = buildDocumentVersionRelativePath(
    buildDocumentFolderRelativePath(
      settings,
      "Procedure",
      previewDocumentIds[0],
      "Operating Procedure",
    ),
    "001",
  );
  const previewRelativePath = buildVersionFileRelativePath(
    settings,
    previewVersionFolderPath,
    "working",
    "procedure.docx",
  );
  const previewVersionIds =
    settings.versionManagementMode === "version-specific-document-id"
      ? previewDocumentIds
      : [previewDocumentIds[0], previewDocumentIds[0], previewDocumentIds[0]];
  const showDefaultCompany =
    settings.visibleDocumentColumns.includes("company");
  const showDefaultDepartment =
    settings.visibleDocumentColumns.includes("department");
  const logoPreviewLabel = clearCompanyLogo
    ? "Logo will be removed when you save these settings."
    : companyLogoSourceFilePath
      ? `New logo selected: ${getPathFileName(companyLogoSourceFilePath)}`
      : settings.companyLogoPath
        ? `Saved logo: ${getPathFileName(settings.companyLogoPath)}`
        : "No company logo selected.";

  return (
    <div className="grid gap-4">
      <Field label="Document Storage Layout">
        <Select
          value={settings.storageLayoutPreset}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              storageLayoutPreset: event.target
                .value as WorkspaceSettings["storageLayoutPreset"],
            })
          }
        >
          {WORKSPACE_STORAGE_LAYOUT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Version File Organization">
        <Select
          value={settings.fileOrganizationMode}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              fileOrganizationMode: event.target
                .value as WorkspaceSettings["fileOrganizationMode"],
            })
          }
        >
          {WORKSPACE_FILE_ORGANIZATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Version Document ID Management">
        <Select
          value={settings.versionManagementMode}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              versionManagementMode: event.target
                .value as WorkspaceSettings["versionManagementMode"],
            })
          }
        >
          {WORKSPACE_VERSION_MANAGEMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Document ID Format">
        <Select
          value={settings.documentIdFormatPreset}
          onChange={(event) => {
            const nextPreset = event.target
              .value as WorkspaceSettings["documentIdFormatPreset"];
            onSettingsChange({
              ...settings,
              documentIdFormatPreset: nextPreset,
              documentIdFormatTemplate:
                nextPreset === "custom"
                  ? normalizeDocumentIdFormatTemplate(
                      settings.documentIdFormatTemplate,
                    )
                  : getDocumentIdFormatTemplateForPreset(nextPreset),
            });
          }}
        >
          {DOCUMENT_ID_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div className="text-xs text-muted-foreground">
          {selectedDocumentIdOption.description}
        </div>
      </Field>

      <Field
        label="Document ID Template"
        error={validationErrors.documentIdFormatTemplate}
      >
        <Textarea
          aria-invalid={Boolean(validationErrors.documentIdFormatTemplate)}
          rows={2}
          placeholder="<docTypePrefix><year><sequence:5>"
          value={settings.documentIdFormatTemplate}
          disabled={settings.documentIdFormatPreset !== "custom"}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              documentIdFormatPreset: "custom",
              documentIdFormatTemplate: event.target.value,
            })
          }
        />
        <div className="text-xs text-muted-foreground">
          Use one <code>{"<sequence>"}</code> placeholder. Placeholder names are
          case-insensitive, so <code>{"<Language>"}</code> works the same as{" "}
          <code>{"<language>"}</code>.
        </div>
        {settings.documentIdFormatPreset === "custom" ? (
          <div className="rounded-lg bg-card px-2.5 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Live Preview
            </div>
            <div className="copyable-text mt-1.5 font-mono text-xs text-primary">
              {buildDocumentIdPreview(settings, 1)}
            </div>
          </div>
        ) : null}
      </Field>

      {settings.documentIdFormatPreset === "custom" ? (
        <div className="rounded-xl border border-border bg-background px-3 py-3 text-[13px]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowDocumentIdPlaceholders((current) => !current)}
          >
            <span className="font-medium">Document ID placeholders</span>
            <span className="text-xs text-muted-foreground">
              {showDocumentIdPlaceholders ? "Hide" : "Show"}
            </span>
          </button>

          {showDocumentIdPlaceholders ? (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {DOCUMENT_ID_TEMPLATE_PLACEHOLDER_OPTIONS.map((option) => (
                <div
                  key={option.placeholder}
                  className="rounded-lg bg-card px-2.5 py-2"
                >
                  <div className="copyable-text font-mono text-xs text-primary">
                    {option.placeholder}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {option.label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Example: {option.example}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-background text-[13px]">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
          onClick={() => setShowWorkspaceSetupPreview((current) => !current)}
        >
          <div>
            <div className="font-medium">Preview Workspace Setup</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Expand to inspect the active storage layout, ID examples, and
              folder structure.
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              showWorkspaceSetupPreview && "rotate-180",
            )}
          />
        </button>

        {showWorkspaceSetupPreview ? (
          <div className="border-t border-border px-3 py-3">
            <div className="font-medium">{selectedStorageOption.label}</div>
            <div className="mt-1 text-muted-foreground">
              {selectedStorageOption.description}
            </div>
            <div className="mt-2 font-medium">
              {selectedFileOrganizationOption.label}
            </div>
            <div className="mt-1 text-muted-foreground">
              {selectedFileOrganizationOption.description}
            </div>
            <div className="mt-2 font-medium">
              {selectedVersionManagementOption.label}
            </div>
            <div className="mt-1 text-muted-foreground">
              {selectedVersionManagementOption.description}
            </div>
            <div className="mt-2 font-medium">
              {selectedDocumentIdOption.label}
            </div>
            <div className="mt-1 text-muted-foreground">
              {selectedDocumentIdOption.description}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Active Template
            </div>
            <div className="copyable-text mt-2 rounded-lg bg-card px-2.5 py-2 font-mono text-xs text-primary">
              {activeDocumentIdTemplate}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Example Document IDs
            </div>
            <div className="copyable-text mt-2 grid gap-1 rounded-lg bg-card px-2.5 py-2 font-mono text-xs text-primary">
              <div>Create -&gt; {previewDocumentIds[0]}</div>
              <div>Next -&gt; {previewDocumentIds[1]}</div>
              <div>Then -&gt; {previewDocumentIds[2]}</div>
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Example Path
            </div>
            <div className="copyable-text mt-2 rounded-lg bg-card px-2.5 py-2 font-mono text-xs text-primary">
              {previewWorkspaceName}/{previewRelativePath}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Example Version IDs
            </div>
            <div className="copyable-text mt-2 grid gap-1 rounded-lg bg-card px-2.5 py-2 font-mono text-xs text-primary">
              <div>001 -&gt; {previewVersionIds[0]}</div>
              <div>002 -&gt; {previewVersionIds[1]}</div>
              <div>003 -&gt; {previewVersionIds[2]}</div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Saving storage layout changes migrates managed document folders
              and version files. Version document ID changes apply to new
              versions going forward.
            </div>
          </div>
        ) : null}
      </div>

      {showDefaultCompany || showDefaultDepartment ? (
        <div className="grid gap-4 md:grid-cols-2">
          {showDefaultCompany ? (
            <Field label="Default Company">
              <Input
                placeholder="Acme Manufacturing"
                value={settings.defaultCompany}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    defaultCompany: event.target.value,
                  })
                }
              />
            </Field>
          ) : null}

          {showDefaultDepartment ? (
            <Field label="Default Department">
              <Input
                placeholder="Quality Assurance"
                value={settings.defaultDepartment}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    defaultDepartment: event.target.value,
                  })
                }
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <WorkspaceLifecycleSettingsFields
        lifecycle={lifecycle}
        validationErrors={validationErrors}
        originalLifecycle={originalLifecycle}
        statusRemaps={statusRemaps}
        onLifecycleChange={onLifecycleChange}
        onStatusRemapsChange={onStatusRemapsChange}
      />

      {showBrandingControls ? (
        <Field label="Company Logo">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void window.docTrack.dialogs
                    .pickWorkspaceLogoFile()
                    .then((filePath) => {
                      if (filePath) {
                        onLogoSelect(filePath);
                      }
                    });
                }}
              >
                <Upload className="h-4 w-4" />
                {settings.companyLogoPath || companyLogoSourceFilePath
                  ? "Replace Logo"
                  : "Upload Logo"}
              </Button>
              {(settings.companyLogoPath || companyLogoSourceFilePath) &&
              !clearCompanyLogo ? (
                <Button variant="ghost" onClick={onLogoRemove}>
                  <X className="h-4 w-4" />
                  Remove Logo
                </Button>
              ) : null}
            </div>
            <div className="mt-2 text-[13px] text-muted-foreground">
              {logoPreviewLabel}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              The selected logo is copied into the workspace and appears in the
              upper-left corner of every PDF export page.
            </div>
          </div>
        </Field>
      ) : null}

      <ToggleSetting
        title="Automatically mark the previous version obsolete"
        description="When a new version is created, the old latest version switches to Obsolete automatically."
        checked={settings.autoMarkPreviousVersionObsolete}
        onChange={(checked) =>
          onSettingsChange({
            ...settings,
            autoMarkPreviousVersionObsolete: checked,
          })
        }
      />

      <Field
        label="Enabled Workspace Fields"
        error={validationErrors.visibleDocumentColumns}
      >
        <div className="grid gap-2 rounded-xl border border-border bg-background p-3 md:grid-cols-2 xl:grid-cols-3">
          {DOCUMENT_TABLE_COLUMN_OPTIONS.map((column) => (
            <label
              key={column.value}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
            >
              <input
                checked={settings.visibleDocumentColumns.includes(column.value)}
                className="mt-1"
                type="checkbox"
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    visibleDocumentColumns: event.target.checked
                      ? [...settings.visibleDocumentColumns, column.value]
                      : settings.visibleDocumentColumns.filter(
                          (item) => item !== column.value,
                        ),
                  })
                }
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Disabled fields disappear from document forms, workspace pages, and
          personal table-view settings.
        </div>
      </Field>

      {showAdvancedSettings ? (
        <>
          <div>
            <button
              type="button"
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              onClick={() => onAdvancedSettingsOpenChange?.(true)}
            >
              Advanced Settings
            </button>
          </div>

          <WorkspaceAdvancedSettingsDialog
            open={isAdvancedSettingsOpen}
            settings={settings}
            validationErrors={validationErrors}
            onOpenChange={(open) => onAdvancedSettingsOpenChange?.(open)}
            onSettingsChange={onSettingsChange}
          />
        </>
      ) : null}
    </div>
  );
}

function WorkspaceAdvancedSettingsDialog({
  open,
  settings,
  validationErrors,
  onOpenChange,
  onSettingsChange,
}: {
  open: boolean;
  settings: WorkspaceSettings;
  validationErrors: ValidationErrors;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: WorkspaceSettings) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Advanced Settings</DialogTitle>
          <DialogDescription>
            Configure workspace internals like folder naming and activity log
            retention.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <ToggleSetting
            title="Enable activity log"
            description="Record workspace and document events for the dashboard activity feed."
            checked={settings.activityLogEnabled}
            onChange={(checked) =>
              onSettingsChange({
                ...settings,
                activityLogEnabled: checked,
              })
            }
          />

          <Field
            label="Activity Log Max Rows"
            error={validationErrors.activityLogMaxRows}
          >
            <Input
              aria-invalid={Boolean(validationErrors.activityLogMaxRows)}
              min={1}
              step={1}
              type="number"
              value={
                Number.isFinite(settings.activityLogMaxRows)
                  ? String(settings.activityLogMaxRows)
                  : ""
              }
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  activityLogMaxRows: event.target.value.trim()
                    ? Number(event.target.value)
                    : Number.NaN,
                })
              }
            />
            <div className="text-xs text-muted-foreground">
              Older activity rows are pruned automatically after new activity is
              recorded.
            </div>
          </Field>

          {WORKSPACE_ROOT_DIRECTORY_SETTING_KEYS.map((key) => {
            const fieldKey = `rootDirectory.${key}`;

            return (
              <Field
                key={key}
                label={`${ROOT_DIRECTORY_FIELD_LABELS[key]} Folder`}
                error={validationErrors[fieldKey]}
              >
                <Input
                  aria-invalid={Boolean(validationErrors[fieldKey])}
                  placeholder={getDefaultWorkspaceRootDirectoryName(key)}
                  value={settings[key]}
                  onChange={(event) =>
                    onSettingsChange({
                      ...settings,
                      [key]: event.target.value,
                    })
                  }
                />
              </Field>
            );
          })}

          <div className="rounded-xl border border-border bg-background px-3 py-3 text-[13px] text-muted-foreground">
            Folder names must be non-empty, filesystem-safe, and unique within
            the workspace root. Activity log retention applies per workspace
            database.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceUsersDialog({
  state,
  currentUserId,
  currentPermissions,
  onOpenChange,
  onStateChange,
  onSelectUser,
  onSave,
  onResetPassword,
  onToggleAccess,
  onDelete,
  onUnarchive,
}: {
  state: WorkspaceUsersDialogState;
  currentUserId?: number;
  currentPermissions?: NonNullable<
    ReturnType<typeof useAppStore.getState>["openWorkspaces"][string]["session"]
  >["permissions"];
  onOpenChange: (open: boolean) => void;
  onStateChange: React.Dispatch<
    React.SetStateAction<WorkspaceUsersDialogState>
  >;
  onSelectUser: (userId: number) => void;
  onSave: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  onToggleAccess: (user: WorkspaceUser) => Promise<void>;
  onDelete: (user: WorkspaceUser) => void;
  onUnarchive: (user: WorkspaceUser) => Promise<void>;
}) {
  const selectedUser =
    state.users.find((user) => user.id === state.selectedUserId) ?? null;
  const isCurrentSignedInUser = selectedUser?.id === currentUserId;
  const canManageUsers = Boolean(currentPermissions?.canManageUsers);
  const activeUsers = state.users.filter((user) => !user.archived);
  const archivedUsers = state.users.filter((user) => user.archived);
  const currentSignedInUser =
    activeUsers.find((user) => user.id === currentUserId) ?? null;
  const otherUsers = activeUsers.filter((user) => user.id !== currentUserId);
  const visibleUsers = currentSignedInUser
    ? [currentSignedInUser, ...otherUsers]
    : activeUsers;
  const isSelectedArchivedUser = Boolean(selectedUser?.archived);
  const roleOptions = [...state.roleSettings.roles].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const userFieldsDisabled = isSelectedArchivedUser || !canManageUsers;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,980px)] max-h-[84vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Workspace Users</DialogTitle>
          <DialogDescription>
            Manage local accounts, roles, and passwords stored inside this
            workspace database.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-background p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Users</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onStateChange((current) => ({
                    ...current,
                    selectedUserId: undefined,
                    username: "",
                    displayName: "",
                    role:
                      current.roleSettings.roles[0]?.key ??
                      BUILT_IN_WORKSPACE_ROLE_KEYS[2],
                    password: "",
                    formMessage: "",
                    formTone: "warning",
                    validationErrors: {},
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {state.isLoading ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Loading users...
                </div>
              ) : (
                <>
                  {visibleUsers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      No active users.
                    </div>
                  ) : (
                    visibleUsers.map((user, index) => {
                      const isCurrentUser = user.id === currentUserId;
                      const showOtherUsersDivider =
                        Boolean(currentSignedInUser) &&
                        otherUsers.length > 0 &&
                        index === 1;

                      return (
                        <Fragment key={user.id}>
                          {showOtherUsersDivider ? (
                            <div className="border-t border-border px-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                              Other users
                            </div>
                          ) : null}
                          <button
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                              state.selectedUserId === user.id
                                ? "border-primary/40 bg-accent"
                                : "border-border bg-card",
                            )}
                            onClick={() => onSelectUser(user.id)}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">
                                  {user.displayName}
                                </div>
                                {isCurrentUser ? (
                                  <Badge
                                    variant="outline"
                                    className="px-1.5 py-0.5 text-[10px]"
                                  >
                                    You
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @{user.username} • {user.roleName}
                              </div>
                            </div>
                            <Badge
                              variant={
                                user.signInEnabled ? "success" : "destructive"
                              }
                            >
                              {user.signInEnabled ? "Active" : "Inactive"}
                            </Badge>
                          </button>
                        </Fragment>
                      );
                    })
                  )}
                  {archivedUsers.length > 0 ? (
                    <div className="border-t border-border pt-2">
                      <button
                        className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left"
                        onClick={() =>
                          onStateChange((current) => ({
                            ...current,
                            showArchivedUsers: !current.showArchivedUsers,
                          }))
                        }
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {state.showArchivedUsers ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Archived users
                        </div>
                        <Badge variant="muted">{archivedUsers.length}</Badge>
                      </button>
                      {state.showArchivedUsers ? (
                        <div className="mt-2 space-y-2">
                          {archivedUsers.map((user) => (
                            <button
                              key={user.id}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                                state.selectedUserId === user.id
                                  ? "border-primary/40 bg-accent"
                                  : "border-border bg-card",
                              )}
                              onClick={() => onSelectUser(user.id)}
                            >
                              <div>
                                <div className="text-sm font-semibold">
                                  {user.displayName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  @{user.username} • {user.roleName} •{" "}
                                  {user.linkedRecordCount} linked
                                </div>
                              </div>
                              <Badge variant="muted">Archived</Badge>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-background p-4">
            <div className="grid gap-4">
              {state.formMessage ? (
                <InlineAlert
                  tone={state.formTone}
                  message={state.formMessage}
                />
              ) : null}

              <Field
                label="Display Name"
                error={state.validationErrors.displayName}
              >
                <Input
                  disabled={userFieldsDisabled}
                  value={state.displayName}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "displayName", {
                        displayName: event.target.value,
                      }),
                    )
                  }
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Username" error={state.validationErrors.username}>
                  <Input
                    disabled={userFieldsDisabled}
                    value={state.username}
                    onChange={(event) =>
                      onStateChange((current) =>
                        applyInputChange(current, "username", {
                          username: event.target.value,
                        }),
                      )
                    }
                  />
                </Field>

                <Field label="Role">
                  <Select
                    disabled={userFieldsDisabled}
                    value={state.role}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        formMessage: "",
                        role: event.target.value as WorkspaceRole,
                      }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Password / PIN"
                error={state.validationErrors.password}
              >
                <Input
                  disabled={userFieldsDisabled}
                  type="password"
                  value={state.password}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "password", {
                        password: event.target.value,
                      }),
                    )
                  }
                />
                <div className="text-xs text-muted-foreground">
                  Required for new users. For existing users, enter a new value
                  only when resetting.
                </div>
              </Field>

              {state.selectedUserId && !isSelectedArchivedUser ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={state.isSubmitting || !canManageUsers}
                    onClick={() => void onResetPassword()}
                  >
                    Reset Password
                  </Button>
                  {selectedUser ? (
                    <Button
                      variant="outline"
                      disabled={
                        state.isSubmitting ||
                        !canManageUsers ||
                        (Boolean(selectedUser.signInEnabled) &&
                          isCurrentSignedInUser)
                      }
                      onClick={() => void onToggleAccess(selectedUser)}
                    >
                      {selectedUser.signInEnabled ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                  {selectedUser ? (
                    <Button
                      variant="outline"
                      disabled={
                        state.isSubmitting ||
                        !canManageUsers ||
                        isCurrentSignedInUser
                      }
                      onClick={() => onDelete(selectedUser)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {selectedUser.linkedRecordCount > 0
                        ? "Archive User"
                        : "Delete User"}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {selectedUser?.archived ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={state.isSubmitting || !canManageUsers}
                    onClick={() => void onUnarchive(selectedUser)}
                  >
                    Restore User
                  </Button>
                </div>
              ) : null}

              {selectedUser?.archived ? (
                <div className="text-xs text-muted-foreground">
                  Archived users are preserved because they are linked to
                  existing records. Restore the account first if you want to
                  edit it or allow sign-in again.
                </div>
              ) : null}

              {state.selectedUserId && isCurrentSignedInUser ? (
                <div className="text-xs text-muted-foreground">
                  The account currently signed in to this window cannot be set
                  to inactive.
                </div>
              ) : null}
              {!canManageUsers ? (
                <div className="text-xs text-muted-foreground">
                  Your account can view workspace users but cannot edit them.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={
              state.isSubmitting || isSelectedArchivedUser || !canManageUsers
            }
            onClick={() => void onSave()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {state.selectedUserId ? "Save User" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceRoleSettingsDialog({
  state,
  currentRoleSettings,
  assignedCustomRoles,
  canManageRoles,
  onOpenChange,
  onStateChange,
  onSave,
}: {
  state: WorkspaceRoleSettingsDialogState;
  currentRoleSettings: WorkspaceRoleSettings;
  assignedCustomRoles: Array<[roleKey: string, roleName: string]>;
  canManageRoles: boolean;
  onOpenChange: (open: boolean) => void;
  onStateChange: React.Dispatch<
    React.SetStateAction<WorkspaceRoleSettingsDialogState>
  >;
  onSave: () => Promise<void>;
}) {
  const orderedRoles = [...state.draft.roles].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,900px)] max-h-[82vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Role Designer</DialogTitle>
          <DialogDescription>
            Switch between the built-in role model and a custom workspace role
            designer.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
            {state.message ? (
              <InlineAlert tone={state.tone} message={state.message} />
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant={state.draft.mode === "default" ? "default" : "outline"}
                disabled={state.isSubmitting}
                onClick={() =>
                  onStateChange((current) => ({
                    ...current,
                    message: "",
                    draft:
                      current.draft.mode === "default"
                        ? current.draft
                        : createDefaultWorkspaceRoleSettings("default"),
                  }))
                }
              >
                Default
              </Button>
              <Button
                variant={state.draft.mode === "custom" ? "default" : "outline"}
                disabled={state.isSubmitting}
                onClick={() =>
                  onStateChange((current) => ({
                    ...current,
                    message: "",
                    draft:
                      current.draft.mode === "custom"
                        ? current.draft
                        : currentRoleSettings.mode === "custom"
                          ? cloneWorkspaceRoleSettings(currentRoleSettings)
                          : createDefaultWorkspaceRoleSettings("custom"),
                  }))
                }
              >
                Custom
              </Button>
            </div>

            {state.draft.mode === "default" ? (
              <div className="grid gap-3">
                <div className="rounded-xl border border-border bg-card p-3 text-[13px] text-muted-foreground">
                  Uses the current built-in `admin`, `editor`, and `viewer`
                  rules. Switch to custom mode to design workspace-specific
                  roles.
                </div>
                {orderedRoles.map((role) => (
                  <div
                    key={role.key}
                    className="rounded-xl border border-border bg-background p-3"
                  >
                    <div className="font-medium">{role.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {WORKSPACE_ROLE_PERMISSION_KEYS.filter(
                        (permissionKey) => role.permissions[permissionKey],
                      ).map((permissionKey) => (
                        <Badge key={permissionKey} variant="outline">
                          {WORKSPACE_ROLE_PERMISSION_LABELS[permissionKey]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                {assignedCustomRoles.length > 0 ? (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="font-medium">Custom Role Remapping</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reassign users on custom roles before switching back to the
                      built-in model.
                    </div>
                    <div className="mt-3 grid gap-3">
                      {assignedCustomRoles.map(([roleKey, roleName]) => (
                        <Field key={roleKey} label={roleName}>
                          <Select
                            disabled={!canManageRoles || state.isSubmitting}
                            value={state.remaps[roleKey] ?? ""}
                            onChange={(event) =>
                              onStateChange((current) => ({
                                ...current,
                                remaps: {
                                  ...current.remaps,
                                  [roleKey]: event.target.value,
                                },
                                message: "",
                              }))
                            }
                          >
                            <option value="">Choose a built-in role</option>
                            {BUILT_IN_WORKSPACE_ROLE_KEYS.map((builtInRoleKey) => {
                              const role = orderedRoles.find(
                                (candidate) => candidate.key === builtInRoleKey,
                              );
                              return role ? (
                                <option key={builtInRoleKey} value={builtInRoleKey}>
                                  {role.name}
                                </option>
                              ) : null;
                            })}
                          </Select>
                        </Field>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                  <div>
                    <div className="font-medium">Custom Roles</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Define role names, order, and permission combinations for
                      this workspace.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManageRoles || state.isSubmitting}
                    onClick={() =>
                      onStateChange((current) => ({
                        ...current,
                        message: "",
                        draft: addWorkspaceRoleDefinition(current.draft),
                      }))
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Role
                  </Button>
                </div>

                {orderedRoles.map((role, index) => {
                  const isAssigned = assignedCustomRoles.some(
                    ([roleKey]) => roleKey === role.key,
                  );
                  return (
                    <div
                      key={role.key}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-[220px] flex-1">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Role Name
                          </div>
                          <Input
                            disabled={!canManageRoles || state.isSubmitting}
                            value={role.name}
                            onChange={(event) =>
                              onStateChange((current) => ({
                                ...current,
                                message: "",
                                draft: updateWorkspaceRoleDefinition(
                                  current.draft,
                                  role.key,
                                  (existing) => ({
                                    ...existing,
                                    name: event.target.value,
                                  }),
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              !canManageRoles ||
                              state.isSubmitting ||
                              index === 0
                            }
                            onClick={() =>
                              onStateChange((current) => ({
                                ...current,
                                draft: moveWorkspaceRoleDefinition(
                                  current.draft,
                                  role.key,
                                  -1,
                                ),
                              }))
                            }
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              !canManageRoles ||
                              state.isSubmitting ||
                              index === orderedRoles.length - 1
                            }
                            onClick={() =>
                              onStateChange((current) => ({
                                ...current,
                                draft: moveWorkspaceRoleDefinition(
                                  current.draft,
                                  role.key,
                                  1,
                                ),
                              }))
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              !canManageRoles ||
                              state.isSubmitting ||
                              orderedRoles.length <= 1 ||
                              isAssigned
                            }
                            onClick={() =>
                              onStateChange((current) => ({
                                ...current,
                                message: "",
                                draft: removeWorkspaceRoleDefinition(
                                  current.draft,
                                  role.key,
                                ),
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {WORKSPACE_ROLE_PERMISSION_KEYS.map((permissionKey) => (
                          <label
                            key={permissionKey}
                            className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
                          >
                            <input
                              checked={role.permissions[permissionKey]}
                              className="mt-1"
                              disabled={!canManageRoles || state.isSubmitting}
                              type="checkbox"
                              onChange={(event) =>
                                onStateChange((current) => ({
                                  ...current,
                                  message: "",
                                  draft: updateWorkspaceRoleDefinition(
                                    current.draft,
                                    role.key,
                                    (existing) => ({
                                      ...existing,
                                      permissions: {
                                        ...existing.permissions,
                                        [permissionKey]: event.target.checked,
                                      },
                                    }),
                                  ),
                                }))
                              }
                            />
                            <span>
                              {WORKSPACE_ROLE_PERMISSION_LABELS[permissionKey]}
                            </span>
                          </label>
                        ))}
                      </div>

                      {isAssigned ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                          This role is still assigned to one or more users and
                          cannot be removed.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!canManageRoles || state.isSubmitting}
            onClick={() => void onSave()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            Save Role Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentTypes,
  userSystemEnabled,
  workspaceUsers,
  templates,
  groups,
  projects,
  confidentialityClasses,
  languages,
  availableColumns,
  onCreateProject,
  onEditProject,
  onDeleteProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DocumentDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<DocumentDialogState>>;
  onSubmit: () => Promise<void>;
  documentTypes: DocumentType[];
  userSystemEnabled: boolean;
  workspaceUsers: WorkspaceUser[];
  templates: TemplateSummary[];
  groups: Group[];
  projects: Project[];
  confidentialityClasses: ConfidentialityClass[];
  languages: WorkspaceLanguage[];
  availableColumns: DocumentTableColumn[];
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}) {
  const showAuthor = availableColumns.includes("author");
  const showLanguage = availableColumns.includes("language");
  const showConfidentialityClass = availableColumns.includes(
    "confidentialityClass",
  );
  const showGroup = availableColumns.includes("group");
  const showProject = availableColumns.includes("project");
  const showCompany = availableColumns.includes("company");
  const showDepartment = availableColumns.includes("department");
  const showStartDate = availableColumns.includes("startDate");
  const showRevisionInterval = availableColumns.includes(
    "revisionIntervalMonths",
  );
  const showMetadataFields =
    showLanguage || showConfidentialityClass || showGroup || showProject;
  const showClassificationFields = showLanguage || showConfidentialityClass;
  const showAssignmentFields = showGroup || showProject;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1040px)] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "create" ? "Create Document" : "Edit Document"}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "create"
              ? "Create the document shell first. DocTrack will generate the document ID and physical folder immediately, and you can add versions and files afterward."
              : "Update the document metadata used in the table, detail view, and group/project assignments."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div
            className={cn(
              "grid gap-4",
              showAuthor || showStartDate ? "xl:grid-cols-3" : "md:grid-cols-1",
            )}
          >
            <Field label="Title" error={state.validationErrors.title}>
              <Input
                aria-invalid={Boolean(state.validationErrors.title)}
                placeholder="Internal Audit Procedure"
                value={state.title}
                onChange={(event) =>
                  onStateChange((current) =>
                    applyInputChange(current, "title", {
                      title: event.target.value,
                    }),
                  )
                }
              />
            </Field>
            {showAuthor && userSystemEnabled ? (
              <Field label="Author" error={state.validationErrors.author}>
                <Select
                  aria-invalid={Boolean(state.validationErrors.author)}
                  value={state.authorUserId}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "author", {
                        authorUserId: event.target.value,
                        author:
                          workspaceUsers.find(
                            (user: WorkspaceUser) =>
                              String(user.id) === event.target.value,
                          )?.displayName ?? "",
                      }),
                    )
                  }
                >
                  <option value="">Select an author</option>
                  {workspaceUsers.map((user: WorkspaceUser) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.displayName} ({user.roleName})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {showAuthor && !userSystemEnabled ? (
              <Field label="Author" error={state.validationErrors.author}>
                <Input
                  aria-invalid={Boolean(state.validationErrors.author)}
                  value={state.author}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "author", {
                        author: event.target.value,
                        authorUserId: "",
                      }),
                    )
                  }
                />
              </Field>
            ) : null}
            {showStartDate ? (
              <Field label="Start Date">
                <Input
                  type="date"
                  value={state.startDate}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}
          </div>

          {state.mode === "create" ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <Field
                label="Document Type"
                error={state.validationErrors.documentTypeId}
              >
                <Select
                  aria-invalid={Boolean(state.validationErrors.documentTypeId)}
                  value={state.documentTypeId}
                  onChange={(event) =>
                    onStateChange((current) =>
                      applyInputChange(current, "documentTypeId", {
                        documentTypeId: event.target.value,
                      }),
                    )
                  }
                >
                  <option value="">Select a document type</option>
                  {documentTypes.map((type) => (
                    <option key={type.id} value={String(type.id)}>
                      {type.numberPrefix} • {type.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Version Scheme">
                <Select
                  value={state.versionScheme}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      versionScheme: event.target
                        .value as DocumentVersionScheme,
                    }))
                  }
                >
                  {Object.entries(DOCUMENT_VERSION_SCHEME_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
                <div className="text-xs text-muted-foreground">
                  This controls how version folders are labeled for this
                  document.
                </div>
              </Field>

              <Field label="Template">
                <Select
                  value={state.templateId}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      templateId: event.target.value,
                    }))
                  }
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  {state.templateId
                    ? "Choosing a template creates the initial version immediately and imports the template files as tracked files."
                    : "Leave this empty to create a metadata-only document shell first."}
                </div>
              </Field>
            </div>
          ) : null}

          {showMetadataFields ? (
            <div className="grid gap-4">
              {showClassificationFields ? (
                <div
                  className={cn(
                    "grid gap-4",
                    showLanguage && showConfidentialityClass
                      ? "md:grid-cols-2"
                      : "grid-cols-1",
                  )}
                >
                  {showLanguage ? (
                    <Field label="Language">
                      <Select
                        value={state.languageId}
                        onChange={(event) =>
                          onStateChange((current) => ({
                            ...current,
                            languageId: event.target.value,
                          }))
                        }
                      >
                        <option value="">No language</option>
                        {languages.map((language) => (
                          <option key={language.id} value={String(language.id)}>
                            {language.code}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}

                  {showConfidentialityClass ? (
                    <Field label="Confidentiality Class">
                      <Select
                        value={state.confidentialityClassId}
                        onChange={(event) =>
                          onStateChange((current) => ({
                            ...current,
                            confidentialityClassId: event.target.value,
                          }))
                        }
                      >
                        <option value="">No class</option>
                        {confidentialityClasses.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                </div>
              ) : null}

              {showAssignmentFields ? (
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Assignments
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Use groups for internal organization and projects for reusable metadata.
                    </div>
                  </div>

                  <div
                    className={cn(
                      "grid gap-4",
                      showGroup && showProject ? "xl:grid-cols-2" : "grid-cols-1",
                    )}
                  >
                    {showGroup ? (
                      <Field label="Group">
                        <Select
                          value={state.groupId}
                          onChange={(event) =>
                            onStateChange((current) => ({
                              ...current,
                              groupId: event.target.value,
                            }))
                          }
                        >
                          <option value="">No group</option>
                          {groups.map((group) => (
                            <option key={group.id} value={String(group.id)}>
                              {group.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : null}

                    {showProject ? (
                      <Field label="Project">
                        <div className="space-y-3">
                          <Select
                            value={state.projectId}
                            onChange={(event) =>
                              onStateChange((current) => ({
                                ...current,
                                projectId: event.target.value,
                              }))
                            }
                          >
                            <option value="">No project</option>
                            {projects.map((project) => (
                              <option key={project.id} value={String(project.id)}>
                                {project.name}
                              </option>
                            ))}
                          </Select>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-center"
                              onClick={onCreateProject}
                            >
                              <Plus className="h-4 w-4" />
                              New
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-center"
                              disabled={!state.projectId}
                              onClick={() => {
                                const selectedProject = projects.find(
                                  (project) => String(project.id) === state.projectId,
                                );
                                if (selectedProject) {
                                  onEditProject(selectedProject);
                                }
                              }}
                            >
                              <PencilLine className="h-4 w-4" />
                              Rename
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-center"
                              disabled={!state.projectId}
                              onClick={() => {
                                const selectedProject = projects.find(
                                  (project) => String(project.id) === state.projectId,
                                );
                                if (selectedProject) {
                                  onDeleteProject(selectedProject);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </Field>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showCompany || showDepartment || showRevisionInterval ? (
            <div className="grid gap-4 md:grid-cols-3">
              {showCompany ? (
                <Field label="Company">
                  <Input
                    placeholder="Acme Manufacturing"
                    value={state.company}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        company: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}

              {showDepartment ? (
                <Field label="Department">
                  <Input
                    placeholder="Quality Assurance"
                    value={state.department}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                  />
                </Field>
              ) : null}

              {showRevisionInterval ? (
                <Field
                  label="Revision Interval (months)"
                  error={state.validationErrors.revisionIntervalMonths}
                >
                  <Input
                    aria-invalid={Boolean(
                      state.validationErrors.revisionIntervalMonths,
                    )}
                    inputMode="numeric"
                    placeholder="12"
                    value={state.revisionIntervalMonths}
                    onChange={(event) =>
                      onStateChange((current) =>
                        applyInputChange(current, "revisionIntervalMonths", {
                          revisionIntervalMonths: event.target.value.replace(
                            /[^\d]/g,
                            "",
                          ),
                        }),
                      )
                    }
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={state.isSubmitting}
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            {state.mode === "create" ? "Create Document" : "Save Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentDetail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: VersionDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<VersionDialogState>>;
  onSubmit: () => Promise<void>;
  documentDetail: DocumentDetail | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Version</DialogTitle>
          <DialogDescription>
            Create the next version folder first, then manage the actual files
            from Show Files.
          </DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-xl border border-border bg-background p-3 text-[13px]">
            <div className="copyable-text font-mono text-xs text-primary">
              {documentDetail.documentId}
            </div>
            <div className="copyable-text mt-1.5 text-base font-semibold">
              {documentDetail.title}
            </div>
            <div className="mt-1 text-muted-foreground">
              Next version:{" "}
              {getNextVersionLabelPreview(documentDetail, state.bumpType)}
            </div>
          </div>
        ) : null}

        <Field label="Version Notes">
          <Textarea
            placeholder="What changed in this version?"
            value={state.revisionDescription}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                revisionDescription: event.target.value,
              }))
            }
          />
        </Field>

        {documentDetail?.versionScheme === "major-minor" &&
        documentDetail.versions.length > 0 ? (
          <Field label="Version Bump">
            <Select
              value={state.bumpType}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  bumpType: event.target.value as VersionBumpType,
                }))
              }
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
            </Select>
          </Field>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="h-4 w-4" />
            )}
            Save Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LatestVersionDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentDetail,
  userSystemEnabled,
  workspaceUsers,
  lifecycle,
  availableColumns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LatestVersionDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<LatestVersionDialogState>>;
  onSubmit: () => Promise<void>;
  documentDetail: DocumentDetail | null;
  userSystemEnabled: boolean;
  workspaceUsers: WorkspaceUser[];
  lifecycle: WorkspaceLifecycle;
  availableColumns: DocumentTableColumn[];
}) {
  const showReleasedDate = availableColumns.includes("releasedDate");
  const showReviewedBy = availableColumns.includes("reviewedBy");
  const showApprovedBy = availableColumns.includes("approvedBy");
  const showRevisionDescription = availableColumns.includes(
    "revisionDescription",
  );
  const detailFieldCount =
    Number(showReleasedDate) + Number(showReviewedBy) + Number(showApprovedBy);
  const title =
    state.mode === "latest"
      ? "Edit Latest Version"
      : `Edit Version ${state.versionLabel}`;
  const description =
    state.mode === "latest"
      ? "Update the current latest version without creating a new version entry."
      : "Adjust the metadata stored for this specific version.";
  const selectedStatus = getWorkspaceStatusByName(lifecycle, state.status);
  const missingMetadata = selectedStatus
    ? getMissingLifecycleMetadata(selectedStatus, {
        releasedDate: state.releasedDate || null,
        reviewedBy: state.reviewedBy,
        approvedBy: state.approvedBy,
      })
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="copyable-text font-mono text-xs text-primary">
              {documentDetail.documentId}
            </div>
            <div className="copyable-text mt-1.5 text-base font-semibold">
              {documentDetail.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Version {state.versionLabel}
            </div>
          </div>
        ) : null}

        <Field label="Status">
          <Select
            value={state.status}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                status: event.target.value as DocumentStatus,
              }))
            }
          >
            {getWorkspaceLifecycleStatuses(lifecycle).map((status) => (
              <option key={status.key} value={status.name}>
                {status.name}
              </option>
            ))}
          </Select>
          {missingMetadata.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              This status requires{" "}
              {missingMetadata
                .map((field) => {
                  switch (field) {
                    case "releasedDate":
                      return "Released Date";
                    case "reviewedBy":
                      return "Reviewed By";
                    case "approvedBy":
                      return "Approved By";
                    default:
                      return field;
                  }
                })
                .join(", ")}
              .
            </div>
          ) : null}
        </Field>

        {detailFieldCount > 0 ? (
          <div
            className={cn(
              "grid gap-4",
              detailFieldCount > 1 ? "md:grid-cols-2" : "md:grid-cols-1",
            )}
          >
            {showReleasedDate ? (
              <Field label="Released Date">
                <Input
                  type="date"
                  value={state.releasedDate}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      releasedDate: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}

            {showReviewedBy && userSystemEnabled ? (
              <Field label="Reviewed By">
                <Select
                  value={state.reviewedByUserId}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      reviewedByUserId: event.target.value,
                      reviewedBy:
                        workspaceUsers.find(
                          (user: WorkspaceUser) =>
                            String(user.id) === event.target.value,
                        )?.displayName ?? "",
                    }))
                  }
                >
                  <option value="">No reviewer</option>
                  {workspaceUsers.map((user: WorkspaceUser) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.displayName} ({user.roleName})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {showReviewedBy && !userSystemEnabled ? (
              <Field label="Reviewed By">
                <Input
                  value={state.reviewedBy}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      reviewedByUserId: "",
                      reviewedBy: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}

            {showApprovedBy && userSystemEnabled ? (
              <Field label="Approved By">
                <Select
                  value={state.approvedByUserId}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      approvedByUserId: event.target.value,
                      approvedBy:
                        workspaceUsers.find(
                          (user: WorkspaceUser) =>
                            String(user.id) === event.target.value,
                        )?.displayName ?? "",
                    }))
                  }
                >
                  <option value="">No approver</option>
                  {workspaceUsers.map((user: WorkspaceUser) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.displayName} ({user.roleName})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {showApprovedBy && !userSystemEnabled ? (
              <Field label="Approved By">
                <Input
                  value={state.approvedBy}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      approvedByUserId: "",
                      approvedBy: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {showRevisionDescription ? (
          <Field label="Revision Description">
            <Textarea
              placeholder="What changed in this version?"
              value={state.revisionDescription}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  revisionDescription: event.target.value,
                }))
              }
            />
          </Field>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CircleDot className="h-4 w-4" />
            )}
            {state.mode === "latest" ? "Save Latest Version" : "Save Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentTypeDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TypeDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<TypeDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {state.id ? "Edit Document Type" : "Create Document Type"}
          </DialogTitle>
          <DialogDescription>
            Each type needs a unique 2-digit prefix for automatic document ID
            generation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Type Name" error={state.validationErrors.name}>
            <Input
              aria-invalid={Boolean(state.validationErrors.name)}
              placeholder="Specification"
              value={state.name}
              onChange={(event) =>
                onStateChange((current) =>
                  applyInputChange(current, "name", {
                    name: event.target.value,
                  }),
                )
              }
            />
          </Field>
          <Field
            label="Number Prefix"
            error={state.validationErrors.numberPrefix}
          >
            <Input
              aria-invalid={Boolean(state.validationErrors.numberPrefix)}
              maxLength={2}
              placeholder="01"
              value={state.numberPrefix}
              onChange={(event) =>
                onStateChange((current) =>
                  applyInputChange(current, "numberPrefix", {
                    numberPrefix: event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 2),
                  }),
                )
              }
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ProjectDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<ProjectDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  const entityLabel = state.entity === "group" ? "Group" : "Project";
  const entityDescription =
    state.entity === "group"
      ? "Groups let multiple documents be grouped inside the workspace."
      : "Projects are reusable document metadata values available in this workspace.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {state.id ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
          </DialogTitle>
          <DialogDescription>{entityDescription}</DialogDescription>
        </DialogHeader>

        <Field label={`${entityLabel} Name`} error={state.validationErrors.name}>
          <Input
            aria-invalid={Boolean(state.validationErrors.name)}
            placeholder={
              state.entity === "group" ? "QMS Rollout" : "ERP Modernization"
            }
            value={state.name}
            onChange={(event) =>
              onStateChange((current) =>
                applyInputChange(current, "name", {
                  name: event.target.value,
                }),
              )
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {`Save ${entityLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TemplateDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<TemplateDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Templates are stored as folders in the workspace Templates
            directory.
          </DialogDescription>
        </DialogHeader>

        <Field label="Template Name" error={state.validationErrors.name}>
          <Input
            aria-invalid={Boolean(state.validationErrors.name)}
            placeholder="Procedure Starter"
            value={state.name}
            onChange={(event) =>
              onStateChange((current) =>
                applyInputChange(current, "name", {
                  name: event.target.value,
                }),
              )
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateFilesDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onPickFiles,
  onDropFiles,
  onRemoveFile,
  onClearFiles,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TemplateFilesDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<TemplateFilesDialogState>>;
  onPickFiles: () => Promise<void>;
  onDropFiles: (files: FileList | File[]) => Promise<void>;
  onRemoveFile: (filePath: string) => void;
  onClearFiles: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add Template Files</DialogTitle>
          <DialogDescription>
            Files added here become reusable starter content for new documents
            created from this template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-sm font-semibold">{state.templateName}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Imported files are stored directly inside this template folder in
              the workspace Templates directory.
            </div>
          </div>

          <div
            className={cn(
              "rounded-2xl border-2 border-dashed px-4 py-6 transition",
              state.isDragActive
                ? "border-blue-500 bg-blue-50/70 dark:border-blue-300 dark:bg-blue-500/10"
                : state.validationErrors.pendingSourceFilePaths
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-border bg-background",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onStateChange((current) => ({ ...current, isDragActive: true }));
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!state.isDragActive) {
                onStateChange((current) => ({
                  ...current,
                  isDragActive: true,
                }));
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const nextTarget = event.relatedTarget as Node | null;
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                onStateChange((current) => ({
                  ...current,
                  isDragActive: false,
                }));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onDropFiles(event.dataTransfer.files);
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm font-medium">
                Drag and drop files here
              </div>
              <div className="text-[13px] text-muted-foreground">
                or choose files from disk to stage them for import.
              </div>
              <Button
                variant="outline"
                onClick={() => void onPickFiles()}
                disabled={state.isSubmitting}
              >
                <FolderOpen className="h-4 w-4" />
                Browse Files
              </Button>
            </div>
          </div>

          {state.validationErrors.pendingSourceFilePaths ? (
            <div className="text-xs text-destructive">
              {state.validationErrors.pendingSourceFilePaths}
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">
                Staged Files ({state.pendingSourceFilePaths.length})
              </div>
              {state.pendingSourceFilePaths.length > 0 ? (
                <Button
                  variant="ghost"
                  onClick={onClearFiles}
                  disabled={state.isSubmitting}
                >
                  Clear All
                </Button>
              ) : null}
            </div>

            {state.pendingSourceFilePaths.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                No files staged yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {state.pendingSourceFilePaths.map((filePath) => (
                  <div
                    key={filePath}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {getPathFileName(filePath)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {filePath}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => onRemoveFile(filePath)}
                      disabled={state.isSubmitting}
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import Template Files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfidentialityClassDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ClassificationDialogState;
  onStateChange: React.Dispatch<
    React.SetStateAction<ClassificationDialogState>
  >;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {state.id
              ? "Edit Confidentiality Class"
              : "Create Confidentiality Class"}
          </DialogTitle>
          <DialogDescription>
            Confidentiality classes are selectable values managed per workspace.
          </DialogDescription>
        </DialogHeader>

        <Field label="Class Name" error={state.validationErrors.name}>
          <Input
            aria-invalid={Boolean(state.validationErrors.name)}
            placeholder="Internal"
            value={state.name}
            onChange={(event) =>
              onStateChange((current) =>
                applyInputChange(current, "name", {
                  name: event.target.value,
                }),
              )
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LanguageDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LanguageDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<LanguageDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {state.id ? "Edit Language" : "Create Language"}
          </DialogTitle>
          <DialogDescription>
            Use short codes such as `NL`, `EN`, or `DE` for workspace languages.
          </DialogDescription>
        </DialogHeader>

        <Field label="Language Code" error={state.validationErrors.code}>
          <Input
            aria-invalid={Boolean(state.validationErrors.code)}
            maxLength={8}
            placeholder="EN"
            value={state.code}
            onChange={(event) =>
              onStateChange((current) =>
                applyInputChange(current, "code", {
                  code: event.target.value.toUpperCase(),
                }),
              )
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save Language
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionFilesDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  lifecycle,
  version,
  affectedVersions,
  canEdit,
  onSelectVersion,
  onRefresh,
  onAddFiles,
  onOpenFile,
  onOpenFolder,
  onRenameFile,
  onDeleteFile,
  onChangeRole,
  onPreviewFile,
  onCompareVersion,
  onDropFiles,
  onUploadStagedFiles,
  onOpenStoredPath,
  onIgnoreUnmanagedPath,
  onReconcileUnmanagedPath,
  onApplyFilesystemChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: FilesDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<FilesDialogState>>;
  lifecycle: WorkspaceLifecycle;
  version: DocumentVersion | null;
  affectedVersions: DocumentVersion[];
  canEdit: boolean;
  onSelectVersion: (documentVersionId: number) => void;
  onRefresh: (documentVersionId: number) => Promise<void>;
  onAddFiles: (documentVersionId: number) => Promise<void>;
  onOpenFile: (fileId: number) => void;
  onOpenFolder: (documentVersionId: number) => void;
  onRenameFile: (file: DocumentVersionFile) => Promise<void>;
  onDeleteFile: (file: DocumentVersionFile) => Promise<void>;
  onChangeRole: (
    file: DocumentVersionFile,
    role: DocumentVersionFileRole,
  ) => Promise<void>;
  onPreviewFile: (fileId: number) => Promise<void>;
  onCompareVersion: (documentVersionId: number) => Promise<void>;
  onDropFiles: (
    documentVersionId: number,
    sourceFilePaths: string[],
  ) => Promise<void>;
  onUploadStagedFiles: (documentVersionId: number) => Promise<void>;
  onOpenStoredPath: (relativePath: string) => void;
  onIgnoreUnmanagedPath: (
    documentVersionId: number,
    relativePath: string,
  ) => Promise<void>;
  onReconcileUnmanagedPath: (
    documentVersionId: number,
    relativePath: string,
  ) => Promise<void>;
  onApplyFilesystemChange: (
    documentVersionId: number,
    changeIndex: number,
    change: VersionFilesystemChange,
  ) => Promise<void>;
}) {
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentVersionNeedsReview = version
    ? affectedVersions.some(
        (affectedVersion) => affectedVersion.id === version.id,
      )
    : false;
  const showAffectedVersionSwitcher =
    affectedVersions.length > 1 ||
    (affectedVersions.length === 1 && !currentVersionNeedsReview);
  const groupedFiles = DOCUMENT_VERSION_FILE_ROLES.map((role) => ({
    role,
    files: version?.files.filter((file) => file.role === role) ?? [],
  })).filter((group) => group.files.length > 0);

  useEffect(() => {
    if (!open) {
      setIsExpanded(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid-rows-[auto_minmax(0,1fr)] overflow-hidden",
          isExpanded
            ? "h-[92vh] w-[min(96vw,1380px)]"
            : "max-h-[88vh] w-[min(94vw,920px)]",
        )}
      >
        <button
          type="button"
          className="absolute left-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label={isExpanded ? "Restore modal size" : "Expand modal"}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <DialogHeader className="pl-9">
          <DialogTitle>Show Files</DialogTitle>
          <DialogDescription>
            Browse the physical files for one version, open them directly, or
            open the version folder.
          </DialogDescription>
        </DialogHeader>

        {version ? (
          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4">
              <div className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">
                      Version {version.versionLabel}
                    </div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      {version.files.length} files tracked in this version
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupedFiles.map((group) => (
                        <Badge key={group.role} variant="outline">
                          {DOCUMENT_VERSION_FILE_ROLE_LABELS[group.role]}{" "}
                          {group.files.length}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DocumentProgressBadge
                      status={version.status}
                      lifecycle={lifecycle}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!version.files.length}
                      onClick={() => void onCompareVersion(version.id)}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Compare
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onRefresh(version.id)}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenFolder(version.id)}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Open Folder
                    </Button>
                  </div>
                </div>
              </div>

              {affectedVersions.length > 0 ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4" />
                        {affectedVersions.length === 1
                          ? "This version needs review"
                          : `${affectedVersions.length} versions need review`}
                      </div>
                      <div className="mt-1 text-[13px] text-destructive/90">
                        Use the version buttons below to move through each
                        affected version and apply decisions from this dialog.
                      </div>
                    </div>
                    <Badge variant="destructive">
                      {affectedVersions.length} affected version
                      {affectedVersions.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  {showAffectedVersionSwitcher ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {affectedVersions.map((affectedVersion) => (
                        <Button
                          key={affectedVersion.id}
                          size="sm"
                          variant={
                            affectedVersion.id === version.id
                              ? "destructive"
                              : "outline"
                          }
                          className={
                            affectedVersion.id === version.id
                              ? ""
                              : "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          }
                          onClick={() => onSelectVersion(affectedVersion.id)}
                        >
                          Review Version {affectedVersion.versionLabel}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-background p-3">
                <div
                  className={cn(
                    "rounded-xl border border-dashed border-transparent p-1 transition",
                    isDropTargetActive && "border-primary bg-primary/5",
                  )}
                  onDragOver={(event) => {
                    if (!canEdit) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                    setIsDropTargetActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDropTargetActive(false);
                  }}
                  onDrop={(event) => {
                    if (!canEdit) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    setIsDropTargetActive(false);
                    void (async () => {
                      try {
                        onStateChange((current) => ({
                          ...current,
                          isSubmitting: true,
                          submitLabel: "Reading dropped files...",
                        }));

                        const sourceFilePaths = await resolveDroppedFilePaths(
                          event.dataTransfer.files,
                        );
                        if (sourceFilePaths.length === 0) {
                          onStateChange((current) => ({
                            ...current,
                            isSubmitting: false,
                            submitLabel: "",
                          }));
                          return;
                        }

                        await onDropFiles(version.id, sourceFilePaths);
                      } catch {
                        onStateChange((current) => ({
                          ...current,
                          isSubmitting: false,
                          submitLabel: "",
                        }));
                      }
                    })();
                  }}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="New File Role">
                      <Select
                        value={state.addRole}
                        onChange={(event) =>
                          onStateChange((current) => ({
                            ...current,
                            addRole: event.target
                              .value as DocumentVersionFileRole,
                          }))
                        }
                      >
                        {DOCUMENT_VERSION_FILE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {DOCUMENT_VERSION_FILE_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      variant="outline"
                      disabled={!canEdit || state.isSubmitting}
                      onClick={() => void onAddFiles(version.id)}
                    >
                      {state.isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Select Files
                    </Button>
                    <Button
                      disabled={
                        !canEdit ||
                        state.isSubmitting ||
                        state.pendingSourceFilePaths.length === 0
                      }
                      onClick={() => void onUploadStagedFiles(version.id)}
                    >
                      {state.isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload Files
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={
                        !canEdit || state.pendingSourceFilePaths.length === 0
                      }
                      onClick={() =>
                        onStateChange((current) => ({
                          ...current,
                          pendingSourceFilePaths: [],
                          pendingDuplicateWarnings: [],
                        }))
                      }
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Drag files into this panel or use Select Files to stage
                    them. DocTrack will show the pending list first, then upload
                    only after you confirm.
                  </div>
                </div>
                {state.isSubmitting ? (
                  <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {state.submitLabel || "Working..."}
                    </div>
                  </div>
                ) : null}
                {state.pendingSourceFilePaths.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Staged Files
                    </div>
                    <div className="mt-3 space-y-2">
                      {state.pendingSourceFilePaths.map((filePath) => (
                        <div
                          key={filePath}
                          className="rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="break-all text-xs text-primary">
                            {filePath}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {state.pendingDuplicateWarnings.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    <div className="font-semibold">Upload blocked</div>
                    <div className="mt-2 space-y-1">
                      {state.pendingDuplicateWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {version.filesystemChanges.length > 0 ? (
                <div
                  className={cn(
                    "rounded-xl border p-3",
                    version.filesystemState === "ambiguous"
                      ? "border-destructive/60 bg-destructive/10"
                      : "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-full bg-destructive/15 p-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-destructive">
                          Action Required
                        </div>
                        <div className="mt-1 text-sm font-semibold text-destructive">
                          Files were changed outside DocTrack
                        </div>
                        <div className="mt-1 text-xs text-destructive/90">
                          {canEdit
                            ? "Review and resolve each item below before relying on this version."
                            : "Review the filesystem drift before relying on this version."}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">
                        {version.filesystemChanges.length} change
                        {version.filesystemChanges.length === 1 ? "" : "s"}
                      </Badge>
                      <Badge
                        variant={
                          version.filesystemState === "ambiguous"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {version.filesystemState === "ambiguous"
                          ? "Unsafe to auto-match"
                          : "Review pending"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {version.filesystemChanges.map((change, changeIndex) => {
                      const pathLabel =
                        change.discoveredPath ??
                        change.trackedPath ??
                        "Unknown path";
                      const discoveredPath = change.discoveredPath;
                      const requiresManualAttention =
                        change.kind === "collision" ||
                        change.kind === "missingTracked" ||
                        change.kind === "nestedUnmanaged";
                      const canApply =
                        canEdit &&
                        change.kind !== "collision" &&
                        change.kind !== "nestedUnmanaged" &&
                        change.kind !== "newUnmanaged";
                      const canImportUnmanaged =
                        canEdit &&
                        (change.kind === "newUnmanaged" ||
                          change.kind === "nestedUnmanaged");

                      return (
                        <div
                          key={`${change.kind}-${changeIndex}-${pathLabel}`}
                          className={cn(
                            "rounded-xl border p-3",
                            requiresManualAttention
                              ? "border-destructive/35 bg-background"
                              : "border-destructive/20 bg-background",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{change.kind}</Badge>
                                <Badge
                                  variant={
                                    requiresManualAttention
                                      ? "destructive"
                                      : "warning"
                                  }
                                >
                                  {requiresManualAttention
                                    ? "Needs decision"
                                    : "Review"}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-foreground">
                                {change.message}
                              </div>
                              <div className="mt-2 copyable-text font-mono text-xs text-primary">
                                {pathLabel}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenStoredPath(pathLabel)}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Open Path
                            </Button>
                            {discoveredPath && canImportUnmanaged ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void onReconcileUnmanagedPath(
                                    version.id,
                                    discoveredPath,
                                  )
                                }
                              >
                                <Upload className="h-4 w-4" />
                                Import Into Managed Files
                              </Button>
                            ) : null}
                            {discoveredPath && canImportUnmanaged ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  void onIgnoreUnmanagedPath(
                                    version.id,
                                    discoveredPath,
                                  )
                                }
                              >
                                Ignore
                              </Button>
                            ) : null}
                            {canApply ? (
                              <Button
                                variant={
                                  change.kind === "missingTracked"
                                    ? "destructive"
                                    : "default"
                                }
                                size="sm"
                                onClick={() =>
                                  void onApplyFilesystemChange(
                                    version.id,
                                    changeIndex,
                                    change,
                                  )
                                }
                              >
                                Apply
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="max-h-[420px] space-y-4 overflow-auto rounded-xl border border-border bg-background p-3">
                {version.files.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    No files in this version yet.
                  </div>
                ) : (
                  groupedFiles.map((group) => (
                    <section key={group.role} className="space-y-2">
                      <div className="sticky top-0 z-10 rounded-lg border border-border bg-card px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">
                            {DOCUMENT_VERSION_FILE_ROLE_LABELS[group.role]}
                          </div>
                          <Badge variant="outline">{group.files.length}</Badge>
                        </div>
                      </div>
                      {group.files.map((file) => (
                        <div
                          key={file.id}
                          className="rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {file.fileName}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)} • Modified{" "}
                                {formatDateTime(file.modifiedDate)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {canEdit ? (
                                <Select
                                  value={file.role}
                                  onChange={(event) =>
                                    void onChangeRole(
                                      file,
                                      event.target
                                        .value as DocumentVersionFileRole,
                                    )
                                  }
                                >
                                  {DOCUMENT_VERSION_FILE_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                      {DOCUMENT_VERSION_FILE_ROLE_LABELS[role]}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <Badge variant="outline">
                                  {DOCUMENT_VERSION_FILE_ROLE_LABELS[file.role]}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenFile(file.id)}
                              >
                                Open
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void onPreviewFile(file.id)}
                              >
                                <Search className="h-4 w-4" />
                                Preview
                              </Button>
                              {canEdit ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void onRenameFile(file)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Rename
                                </Button>
                              ) : null}
                              {canEdit ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void onDeleteFile(file)}
                                >
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg bg-background px-2.5 py-2 text-xs text-primary">
                            {file.filePath}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
            Select a version to view its files.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteRecordsDialog({
  state,
  onOpenChange,
  onConfirm,
}: {
  state: DeleteRecordsDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const isDocument = state.mode === "document";
  const title = isDocument
    ? "Delete Document"
    : `Delete Version ${state.versionLabel}`;
  const description = isDocument
    ? `This will permanently delete "${state.documentTitle}" and all managed files for every version.`
    : `This will permanently delete version ${state.versionLabel} from "${state.documentTitle}" and its managed files.`;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-destructive">
                  Physical files will be deleted
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  DocTrack will remove the selected record and delete the files
                  listed below from the workspace.
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
            <section className="rounded-xl border border-border bg-background p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Managed Files
              </div>
              {state.filePaths.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {state.filePaths.map((filePath) => (
                    <div
                      key={filePath}
                      className="rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="break-all text-xs text-primary">
                        {filePath}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-[13px] text-muted-foreground">
                  No managed files were found for this selection.
                </div>
              )}
            </section>

            {state.unmanagedPaths.length > 0 ? (
              <section className="rounded-xl border border-border bg-background p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Unmanaged Paths In Scope
                </div>
                <div className="mt-3 space-y-2">
                  {state.unmanagedPaths.map((relativePath) => (
                    <div
                      key={relativePath}
                      className="rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="break-all text-xs text-primary">
                        {relativePath}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={state.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={state.isSubmitting}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isDocument ? "Delete Document" : "Delete Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmationDialog({
  appUpdateState,
  state,
  onOpenChange,
  onConfirm,
}: {
  appUpdateState: AppUpdateState | null;
  state: ConfirmationDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const isDownloadingUpdate =
    state.kind === "app-update-download" &&
    state.isSubmitting &&
    appUpdateState?.status === "downloading";
  const confirmLabel =
    state.kind === "app-update-download" && state.isSubmitting
      ? appUpdateState?.progress
        ? `Downloading ${Math.round(
            getAppUpdateProgressPercent(appUpdateState.progress),
          )}%`
        : "Preparing Download..."
      : state.kind === "app-update-install" && state.isSubmitting
        ? "Restarting..."
        : state.confirmLabel;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div
            className={cn(
              "rounded-xl border p-4",
              state.tone === "destructive"
                ? "border-destructive/40 bg-destructive/5"
                : "border-border bg-background",
            )}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-4 w-4",
                  state.tone === "destructive"
                    ? "text-destructive"
                    : "text-foreground",
                )}
              />
              <div className="text-[13px] text-muted-foreground">
                Review the details below before continuing.
              </div>
            </div>
          </div>

          {state.detailLines.length > 0 ? (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Details
              </div>
              <div className="mt-3 space-y-2">
                {state.detailLines.map((line) => (
                  <div
                    key={line}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-primary"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isDownloadingUpdate ? (
            <AppUpdateDownloadProgress progress={appUpdateState?.progress ?? null} />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={state.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={state.tone === "destructive" ? "destructive" : "default"}
            onClick={() => void onConfirm()}
            disabled={state.isSubmitting}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state.tone === "destructive" ? (
              <Trash2 className="h-4 w-4" />
            ) : (
              <CircleDot className="h-4 w-4" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisionDescriptionDialog({
  state,
  onOpenChange,
}: {
  state: RevisionDescriptionDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,760px)] max-h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>
            Full revision description for this version.
          </DialogDescription>
        </DialogHeader>

        <div className="copyable-text min-h-0 overflow-y-auto rounded-xl border border-border bg-background p-4 text-[13px] leading-6">
          {state.content.trim() || "No revision description."}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RenameFileDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RenameFileDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<RenameFileDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  const nextFileName = state.nextFileName.trim();
  const isUnchanged = nextFileName === (state.file?.fileName ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>
            Renaming here also renames the managed file on disk.
          </DialogDescription>
        </DialogHeader>

        {state.file ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Current File
              </div>
              <div className="mt-2 text-sm font-medium">
                {state.file.fileName}
              </div>
              <div className="mt-2 break-all text-xs text-primary">
                {state.file.filePath}
              </div>
            </div>

            <Field
              label="New File Name"
              error={state.validationErrors.nextFileName}
            >
              <Input
                autoFocus
                aria-invalid={Boolean(state.validationErrors.nextFileName)}
                value={state.nextFileName}
                onChange={(event) =>
                  onStateChange((current) =>
                    applyInputChange(current, "nextFileName", {
                      nextFileName: event.target.value,
                    }),
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !state.isSubmitting &&
                    nextFileName
                  ) {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </Field>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={state.isSubmitting}
          >
            Cancel
          </Button>
          <Button
            disabled={state.isSubmitting || !nextFileName || isUnchanged}
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            Rename File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const getRestoreDiffBadgeClasses = (
  changeType: RestoreBackupDiffChangeType,
): string =>
  cn(
    changeType === "added" &&
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    changeType === "changed" &&
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
    changeType === "removed" &&
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200",
  );

const getRestoreDiffCellClasses = (
  changeType: RestoreBackupDiffChangeType,
  side: "live" | "backup",
): string =>
  cn(
    "rounded-md border px-3 py-2 text-[12px] leading-5",
    side === "live" &&
      changeType === "removed" &&
      "border-rose-200 bg-rose-50/80 dark:border-rose-400/20 dark:bg-rose-500/10",
    side === "backup" &&
      changeType === "added" &&
      "border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-emerald-500/10",
    changeType === "changed" &&
      "border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/10",
    !(
      (side === "live" && changeType === "removed") ||
      (side === "backup" && changeType === "added") ||
      changeType === "changed"
    ) && "border-border bg-background",
  );

function RestoreDiffFileCard({ item }: { item: RestoreBackupDiffItem }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="text-sm font-semibold">{item.label}</div>
        <Badge
          variant="outline"
          className={getRestoreDiffBadgeClasses(item.changeType)}
        >
          {item.changeType}
        </Badge>
      </div>

      <div className="grid grid-cols-[minmax(140px,180px)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-card/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <div>Field</div>
        <div className="border-l border-border pl-4">Current Live Database</div>
        <div className="border-l border-border pl-4">Snapshot</div>
      </div>

      <div className="divide-y divide-border">
        {item.fields.map((field) => (
          <div
            key={`${item.id}-${field.label}`}
            className="grid grid-cols-[minmax(140px,180px)_minmax(0,1fr)_minmax(0,1fr)] px-4 py-3"
          >
            <div className="pr-4 text-[12px] font-medium text-foreground/85">
              {field.label}
            </div>
            <div className="border-l border-border pl-4">
              <div
                className={getRestoreDiffCellClasses(item.changeType, "live")}
              >
                <div className="whitespace-pre-wrap break-words font-mono">
                  {field.liveValue ?? "Not present"}
                </div>
              </div>
            </div>
            <div className="border-l border-border pl-4">
              <div
                className={getRestoreDiffCellClasses(item.changeType, "backup")}
              >
                <div className="whitespace-pre-wrap break-words font-mono">
                  {field.backupValue ?? "Not present"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackupDialog({
  state,
  onOpenChange,
  onCreateBackup,
  onPreviewRestore,
  onOverwriteRestore,
  onExportRestore,
  onRefresh,
}: {
  state: BackupDialogState;
  onOpenChange: (open: boolean) => void;
  onCreateBackup: () => Promise<void>;
  onPreviewRestore: (backupId: string) => Promise<void>;
  onOverwriteRestore: () => Promise<void>;
  onExportRestore: () => Promise<void>;
  onRefresh: () => void;
}) {
  const selectedBackup =
    state.backups.find((backup) => backup.id === state.selectedBackupId) ??
    null;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1280px)] max-h-[88vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Backups & Recovery</DialogTitle>
          <DialogDescription>
            Create manual snapshots, inspect a detailed database diff, then
            overwrite the live database or export a restored copy.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Snapshots</div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    Workspace-scoped manual and safety snapshots.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => void onCreateBackup()}>
                    {state.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <History className="h-4 w-4" />
                    )}
                    Create Snapshot
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {state.isLoading ? (
                  <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    Loading snapshot details...
                  </div>
                ) : state.backups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    No workspace snapshots yet.
                  </div>
                ) : (
                  state.backups.map((backup) => (
                    <div
                      key={backup.id}
                      className={cn(
                        "rounded-xl border p-3 transition",
                        backup.id === state.selectedBackupId
                          ? "border-blue-500/50 bg-blue-50/60 dark:border-blue-300/40 dark:bg-blue-500/10"
                          : "border-border bg-background",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {backup.label}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(backup.createdDate)} •{" "}
                            {backup.reason === "manual"
                              ? "Manual snapshot"
                              : "Safety snapshot"}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {backup.documentCount} docs • {backup.versionCount}{" "}
                            versions • {formatFileSize(backup.sizeBytes)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onPreviewRestore(backup.id)}
                        >
                          {backup.id === state.selectedBackupId &&
                          state.restoreDiff
                            ? "Refresh Diff"
                            : "Preview Restore"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="text-sm font-semibold">Integrity Check</div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Broken links and missing paths inside the current workspace.
                </div>
                <div className="mt-4 space-y-2">
                  {state.integrityCheck?.issues.length ? (
                    state.integrityCheck.issues.map((issue) => (
                      <div
                        key={`${issue.code}-${issue.path}`}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="text-[13px] font-semibold">
                          {issue.message}
                        </div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {issue.path}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                      No integrity issues detected.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Preview Restore</div>
                    <div className="mt-1 text-[13px] text-muted-foreground">
                      Review the live database against the selected snapshot
                      before choosing how to restore it.
                    </div>
                  </div>
                  {selectedBackup ? (
                    <div className="rounded-xl border border-border bg-card px-3 py-2">
                      <div className="text-sm font-semibold">
                        {selectedBackup.label}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(selectedBackup.createdDate)}
                      </div>
                    </div>
                  ) : null}
                </div>

                {state.restoreDiff ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/30 dark:bg-emerald-500/10">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                          Added
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-100">
                          {state.restoreDiff.totals.addedCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-500/10">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
                          Changed
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-100">
                          {state.restoreDiff.totals.changedCount}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-400/30 dark:bg-rose-500/10">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-200">
                          Removed
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-rose-700 dark:text-rose-100">
                          {state.restoreDiff.totals.removedCount}
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                      {state.restoreDiff.sections.map((section) => (
                        <div
                          key={section.id}
                          className="rounded-2xl border border-border bg-card p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">
                                {section.label}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {section.addedCount} added,{" "}
                                {section.changedCount} changed,{" "}
                                {section.removedCount} removed
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">
                                +{section.addedCount}
                              </Badge>
                              <Badge variant="outline">
                                ~{section.changedCount}
                              </Badge>
                              <Badge variant="outline">
                                -{section.removedCount}
                              </Badge>
                            </div>
                          </div>

                          {section.items.length === 0 ? (
                            <div className="mt-3 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-[13px] text-muted-foreground">
                              No differences in this section.
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {section.items.map((item) => (
                                <RestoreDiffFileCard
                                  key={`${section.id}-${item.id}`}
                                  item={item}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        disabled={state.isSubmitting}
                        onClick={() => void onOverwriteRestore()}
                      >
                        {state.isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <History className="h-4 w-4" />
                        )}
                        Overwrite Live Database
                      </Button>
                      <Button
                        disabled={state.isSubmitting}
                        onClick={() => void onExportRestore()}
                      >
                        {state.isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FolderOpen className="h-4 w-4" />
                        )}
                        Export To New Workspace
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    Choose a snapshot and click Preview Restore to open the
                    detailed diff.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilePreviewDialog({
  state,
  onOpenChange,
}: {
  state: FilePreviewDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,980px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>File Preview</DialogTitle>
          <DialogDescription>
            Preview supported local files without leaving DocTrack.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto rounded-xl border border-border bg-background p-4">
          {state.isLoading ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading preview...
            </div>
          ) : state.preview?.kind === "pdf" && state.preview.previewUrl ? (
            <embed
              className="h-[70vh] w-full rounded-lg border border-border bg-card"
              src={state.preview.previewUrl}
              type="application/pdf"
              title={state.preview.fileName}
            />
          ) : state.preview?.kind === "image" && state.preview.previewUrl ? (
            <img
              alt={state.preview.fileName}
              className="mx-auto max-h-[70vh] rounded-lg border border-border bg-card object-contain"
              src={state.preview.previewUrl}
            />
          ) : state.preview?.textContent ? (
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-xs">
              {state.preview.textContent}
            </pre>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
              {state.preview?.warning ?? "No preview available."}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityLogDialog({
  state,
  onOpenChange,
  onOpenDocument,
}: {
  state: ActivityLogDialogState;
  onOpenChange: (open: boolean) => void;
  onOpenDocument: (documentRecordId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const eventTypeOptions = useMemo(
    () =>
      [...new Set(state.items.map((item) => item.eventType))]
        .sort((left, right) => left.localeCompare(right))
        .map((eventType) => ({
          value: eventType,
          label: formatActivityEventTypeLabel(eventType),
        })),
    [state.items],
  );
  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return state.items.filter((item) => {
      if (eventTypeFilter !== "all" && item.eventType !== eventTypeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        item.message,
        item.eventType,
        formatActivityEventTypeLabel(item.eventType),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [deferredSearch, eventTypeFilter, state.items]);

  useEffect(() => {
    if (!state.open) {
      setSearch("");
      setEventTypeFilter("all");
    }
  }, [state.open]);

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,1040px)] max-h-[85vh] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Activity Log</DialogTitle>
          <DialogDescription>
            Browse the full workspace activity history and filter it by event or
            text.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Field label="Search">
            <Input
              placeholder="Filter by message or event type"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>

          <Field label="Event Type">
            <Select
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
            >
              <option value="all">All activity</option>
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="md:col-span-2 text-xs text-muted-foreground">
            {state.isLoading
              ? "Loading activity log..."
              : `Showing ${filteredItems.length} of ${state.items.length} activity record${state.items.length === 1 ? "" : "s"}.`}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          {state.isLoading ? (
            <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading activity log...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              {state.items.length === 0
                ? "No activity has been recorded yet."
                : "No activity matches the current filters."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-accent"
                  onClick={() =>
                    item.documentRecordId &&
                    onOpenDocument(item.documentRecordId)
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {formatActivityEventTypeLabel(item.eventType)}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdDate)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium">{item.message}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionComparisonDialog({
  state,
  onOpenChange,
}: {
  state: VersionComparisonDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,860px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Version Comparison</DialogTitle>
          <DialogDescription>
            Compare adjacent versions by tracked files, paths, roles, and
            content hashes.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-auto rounded-xl border border-border bg-background p-4">
          {state.isLoading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading comparison...
            </div>
          ) : state.result ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm font-semibold">
                  {state.result.previousVersionLabel} →{" "}
                  {state.result.currentVersionLabel}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {state.result.deltas.length} changes •{" "}
                  {state.result.unchangedCount} unchanged
                </div>
              </div>

              {state.result.deltas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                  No file-level differences detected between these versions.
                </div>
              ) : (
                state.result.deltas.map((delta, index) => (
                  <div
                    key={`${delta.changeType}-${index}`}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">
                        {delta.summary}
                      </div>
                      <Badge variant="outline">{delta.changeType}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Previous
                        </div>
                        <div className="mt-2 text-xs">
                          {delta.before?.filePath ?? "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Current
                        </div>
                        <div className="mt-2 text-xs">
                          {delta.after?.filePath ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
              Choose a version to compare.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span
        className={cn(
          "text-[13px] font-medium text-foreground/90",
          error && "text-destructive",
        )}
      >
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

function DocumentStatusSelect({
  document,
  lifecycle,
  onRequestStatusChange,
}: {
  document: DocumentListItem;
  lifecycle: WorkspaceLifecycle;
  onRequestStatusChange: (
    document: DocumentListItem,
    nextStatus: DocumentStatus,
  ) => void;
}) {
  if (!document.status || !document.latestVersionLabel) {
    return (
      <DocumentProgressBadge status={document.status} lifecycle={lifecycle} />
    );
  }

  const statuses = [
    document.status,
    ...getAllowedLifecycleTransitionTargets(lifecycle, document.status).map(
      (status) => status.name,
    ),
  ].filter((status, index, values) => values.indexOf(status) === index);
  const currentVariant = getStatusVariant(document.status, lifecycle);

  if (statuses.length === 0) {
    return (
      <DocumentProgressBadge status={document.status} lifecycle={lifecycle} />
    );
  }

  return (
    <div
      className="w-[168px] min-w-[168px]"
      onClick={stopRowAction}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <Select
        aria-label={`Status for ${document.documentId}`}
        data-status-select={String(document.id)}
        className={cn(
          "h-8 rounded-full border-transparent pr-8 text-[12px] font-medium shadow-none",
          currentVariant === "success" &&
            "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200",
          currentVariant === "warning" &&
            "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200",
          currentVariant === "default" &&
            "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200",
          currentVariant === "muted" &&
            "bg-muted text-foreground hover:bg-accent",
        )}
        value={document.status}
        onChange={(event) => {
          onRequestStatusChange(document, event.target.value as DocumentStatus);
          event.currentTarget.blur();
        }}
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </Select>
    </div>
  );
}

function StatusChangeDialog({
  state,
  onOpenChange,
  onSubmit,
  lifecycle,
}: {
  state: StatusChangeDialogState;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
  lifecycle: WorkspaceLifecycle;
}) {
  const document = state.document;

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Status Change</DialogTitle>
          <DialogDescription>
            Review the new status before DocTrack updates the latest version for
            this document.
          </DialogDescription>
        </DialogHeader>

        {document ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="copyable-text font-mono text-xs text-primary">
              {document.documentId}
            </div>
            <div className="copyable-text mt-1.5 text-base font-semibold">
              {document.title}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>Current</span>
              <StatusBadge status={document.status!} lifecycle={lifecycle} />
              <span>Next</span>
              <StatusBadge status={state.nextStatus} lifecycle={lifecycle} />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CircleDot className="h-4 w-4" />
            )}
            Apply Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="copyable-text mt-1.5 text-[13px]">{value}</div>
    </div>
  );
}

function ExpandableInfoCard({
  label,
  value,
  emptyValue,
  onShowMore,
}: {
  label: string;
  value: string;
  emptyValue: string;
  onShowMore: () => void;
}) {
  const trimmedValue = value.trim();
  const hasValue = trimmedValue.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      {hasValue ? (
        <>
          <div
            className="copyable-text mt-1.5 overflow-hidden text-[13px]"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {trimmedValue}
          </div>
          <button
            type="button"
            className="mt-2 text-[13px] font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            onClick={onShowMore}
          >
            Show More
          </button>
        </>
      ) : (
        <div className="copyable-text mt-1.5 text-[13px]">{emptyValue}</div>
      )}
    </div>
  );
}

function DocumentProgressBadge({
  status,
  lifecycle = DEFAULT_WORKSPACE_LIFECYCLE_STATE,
}: {
  status: DocumentStatus | null;
  lifecycle?: WorkspaceLifecycle;
}) {
  if (!status) {
    return <Badge variant="outline">Not started</Badge>;
  }

  return <StatusBadge status={status} lifecycle={lifecycle} />;
}

function StatusBadge({
  status,
  lifecycle = DEFAULT_WORKSPACE_LIFECYCLE_STATE,
}: {
  status: DocumentStatus;
  lifecycle?: WorkspaceLifecycle;
}) {
  return <Badge variant={getStatusVariant(status, lifecycle)}>{status}</Badge>;
}

function getNextVersionLabelPreview(
  documentDetail: DocumentDetail,
  bumpType: VersionBumpType,
): string {
  const latestVersion = documentDetail.versions[0];
  const nextSequenceNumber = (latestVersion?.sequenceNumber ?? 0) + 1;

  if (documentDetail.versionScheme === "numeric-3") {
    return String(nextSequenceNumber).padStart(3, "0");
  }

  if (documentDetail.versionScheme === "v-prefix") {
    return `v${nextSequenceNumber}`;
  }

  if (documentDetail.versionScheme === "alpha-uppercase") {
    try {
      return getAlphaUppercaseVersionLabel(nextSequenceNumber);
    } catch {
      return "Unavailable (A-Z limit reached)";
    }
  }

  if (!latestVersion) {
    return "1.0";
  }

  const match = latestVersion.versionLabel.match(/^(\d+)\.(\d+)$/);
  if (!match) {
    return "1.0";
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return bumpType === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }

  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function getAppUpdateProgressPercent(
  progress: AppUpdateProgress | null | undefined,
): number {
  if (!progress || !Number.isFinite(progress.percent)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress.percent));
}

function formatAppUpdateTransferRate(bytesPerSecond: number): string {
  return bytesPerSecond > 0
    ? `${formatFileSize(bytesPerSecond)}/s`
    : "Calculating speed...";
}

function formatAppUpdateRemainingTime(
  progress: AppUpdateProgress | null | undefined,
): string | null {
  if (!progress || progress.bytesPerSecond <= 0) {
    return null;
  }

  const remainingBytes = Math.max(progress.total - progress.transferred, 0);
  if (remainingBytes <= 0) {
    return null;
  }

  const totalSeconds = Math.ceil(remainingBytes / progress.bytesPerSecond);
  if (totalSeconds < 60) {
    return `${totalSeconds}s remaining`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0
      ? `${minutes}m ${seconds}s remaining`
      : `${minutes}m remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m remaining`
    : `${hours}h remaining`;
}

function getAppUpdateStatusMeta(
  status: AppUpdateState["status"] | undefined,
): {
  label: string;
  icon: typeof RefreshCcw;
  className: string;
  iconClassName?: string;
} {
  switch (status) {
    case "checking":
      return {
        label: "Checking",
        icon: RefreshCcw,
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
        iconClassName: "animate-spin",
      };
    case "available":
      return {
        label: "Ready to Download",
        icon: Download,
        className:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
      };
    case "downloading":
      return {
        label: "Downloading",
        icon: Download,
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
      };
    case "downloaded":
      return {
        label: "Ready to Install",
        icon: Sparkles,
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
      };
    case "not-available":
      return {
        label: "Up to Date",
        icon: Sparkles,
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
      };
    case "error":
      return {
        label: "Attention Needed",
        icon: AlertTriangle,
        className:
          "border-[#F0D5D3] bg-[#FFF7F6] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21]/60 dark:text-[#FFB7B2]",
      };
    case "unsupported":
      return {
        label: "Unavailable",
        icon: AlertTriangle,
        className:
          "border-border bg-muted text-muted-foreground dark:border-border dark:bg-muted/60 dark:text-muted-foreground",
      };
    case "idle":
    case "disabled":
    default:
      return {
        label: "Ready",
        icon: RefreshCcw,
        className:
          "border-border bg-muted text-muted-foreground dark:border-border dark:bg-muted/60 dark:text-muted-foreground",
      };
  }
}

function AppUpdateProgressBar({
  progress,
  label = "Update download progress",
}: {
  progress: AppUpdateProgress | null;
  label?: string;
}) {
  const percent = getAppUpdateProgressPercent(progress);
  const isDeterminate = Boolean(progress && progress.total > 0);

  return (
    <div
      aria-label={label}
      aria-valuemax={isDeterminate ? 100 : undefined}
      aria-valuemin={isDeterminate ? 0 : undefined}
      aria-valuenow={isDeterminate ? Math.round(percent) : undefined}
      aria-valuetext={
        isDeterminate ? `${Math.round(percent)} percent` : "Preparing download"
      }
      className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300 ease-out",
          isDeterminate ? "w-0" : "w-1/3 animate-pulse",
        )}
        style={isDeterminate ? { width: `${percent}%` } : undefined}
      />
    </div>
  );
}

function AppUpdateDownloadProgress({
  progress,
  className,
}: {
  progress: AppUpdateProgress | null;
  className?: string;
}) {
  const percent = getAppUpdateProgressPercent(progress);
  const remainingTime = formatAppUpdateRemainingTime(progress);

  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-xl border border-border bg-background/80 p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Download progress
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {progress ? `${Math.round(percent)}%` : "Starting..."}
          </div>
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <div>
            {progress && progress.total > 0
              ? `${formatFileSize(progress.transferred)} of ${formatFileSize(progress.total)}`
              : "Waiting for the first progress update"}
          </div>
          <div className="mt-1">
            {progress
              ? formatAppUpdateTransferRate(progress.bytesPerSecond)
              : "Preparing files..."}
            {remainingTime ? ` - ${remainingTime}` : ""}
          </div>
        </div>
      </div>

      <AppUpdateProgressBar progress={progress} />
    </div>
  );
}

function columnHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (desc?: boolean) => void;
    };
  }) => {
    const sortDirection = column.getIsSorted();
    const SortIcon =
      sortDirection === "asc"
        ? ArrowUp
        : sortDirection === "desc"
          ? ArrowDown
          : ArrowUpDown;

    return (
      <button
        type="button"
        data-sort-direction={sortDirection || "none"}
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] transition hover:text-foreground",
          sortDirection
            ? "font-bold text-foreground"
            : "font-semibold text-muted-foreground",
        )}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <SortIcon
          className={cn(
            "h-3.5 w-3.5",
            sortDirection ? "text-foreground" : "text-muted-foreground",
          )}
        />
      </button>
    );
  };
}

export default App;



