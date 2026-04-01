import {
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
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  CircleDot,
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
  DOCUMENT_TABLE_DENSITY_OPTIONS,
  KEYBOARD_SHORTCUT_ACTIONS,
  KEYBOARD_SHORTCUT_ACTION_DETAILS,
  THEME_MODE_OPTIONS,
  WORKSPACE_TAB_DENSITY_OPTIONS,
  WORKSPACE_VIEW_OPTIONS,
  type ApplicationSettings,
  type DocumentDetailViewMode,
  type DocumentTableDensity,
  type KeyboardShortcutAction,
  type KeyboardShortcutMap,
  type KeyboardShortcutValue,
  type ThemeMode,
} from "@shared/applicationSettings";
import {
  DOCUMENT_VERSION_FILE_ROLE_LABELS,
  DOCUMENT_VERSION_FILE_ROLES,
  DOCUMENT_VERSION_SCHEME_LABELS,
  type DocumentVersionFileRole,
  type DocumentVersionScheme,
  type VersionBumpType,
} from "@shared/documentModel";
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
  WORKSPACE_STORAGE_LAYOUT_OPTIONS,
  WORKSPACE_VERSION_MANAGEMENT_OPTIONS,
  getDocumentTableColumnLabel,
  getDocumentIdFormatTemplateForPreset,
  getWorkspaceTemplatesRelativePath,
  normalizeDocumentIdFormatTemplate,
  resolveDocumentIdFormatTemplate,
  type DocumentTableColumn,
  type WorkspaceSettings,
} from "@shared/workspaceLayout";
import type {
  ConfidentialityClass,
  CreateDocumentInput,
  CreateVersionInput,
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
  IntegrityCheckResult,
  Project,
  RestoreBackupPreview,
  TemplateSummary,
  UpdateDocumentInput,
  UpdateDocumentVersionInput,
  UpdateLatestVersionInput,
  VersionComparisonResult,
  VersionFilesystemChange,
  WorkspaceBackupSummary,
  WorkspaceLanguage,
  WorkspaceSettingsUpdateInput,
} from "@shared/types";

type NotificationTone = "success" | "error";

const STATUS_VARIANTS: Record<
  DocumentStatus,
  "success" | "warning" | "muted" | "default"
> = {
  Draft: "warning",
  "In Review": "default",
  Released: "success",
  Archived: "muted",
  Obsolete: "muted",
};

const THEME_MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
};

const SUCCESS_NOTIFICATION_TIMEOUT_MS = 3500;

const getSystemTheme = (): ThemeMode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (themeMode: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = themeMode === "system" ? getSystemTheme() : themeMode;
  root.classList.toggle("dark", effectiveTheme === "dark");
};

const buildWorkspaceDialogState = (
  applicationSettings: ApplicationSettings,
): WorkspaceDialogState => ({
  ...defaultWorkspaceDialogState,
  open: true,
  includeExampleData: applicationSettings.defaultIncludeExampleData,
});

const buildCreateDocumentDialogState = (
  applicationSettings: ApplicationSettings,
  workspaceSettings: WorkspaceSettings,
): DocumentDialogState => ({
  ...defaultDocumentDialogState,
  mode: "create",
  open: true,
  author: applicationSettings.defaultDocumentAuthor,
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
  versionScheme: documentDetail.versionScheme,
  templateId: "",
  languageId: documentDetail.languageId
    ? String(documentDetail.languageId)
    : "",
  confidentialityClassId: documentDetail.confidentialityClassId
    ? String(documentDetail.confidentialityClassId)
    : "",
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
  settings: WorkspaceSettings;
  includeExampleData: boolean;
  isSubmitting: boolean;
}

interface WorkspaceSettingsDialogState {
  open: boolean;
  rootPath?: string;
  workspaceName: string;
  settings: WorkspaceSettings;
  companyLogoSourceFilePath: string | null;
  clearCompanyLogo: boolean;
  isSubmitting: boolean;
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
}

interface DocumentDialogState {
  mode: "create" | "edit";
  documentRecordId?: number;
  open: boolean;
  title: string;
  documentTypeId: string;
  author: string;
  versionScheme: DocumentVersionScheme;
  templateId: string;
  startDate: string;
  languageId: string;
  confidentialityClassId: string;
  projectId: string;
  company: string;
  department: string;
  revisionIntervalMonths: string;
  isSubmitting: boolean;
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
  approvedBy: string;
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
}

interface ProjectDialogState {
  open: boolean;
  id?: number;
  name: string;
  isSubmitting: boolean;
}

interface TemplateDialogState {
  open: boolean;
  name: string;
  isSubmitting: boolean;
}

interface TemplateFilesDialogState {
  open: boolean;
  templateId?: string;
  templateName: string;
  isSubmitting: boolean;
}

interface ClassificationDialogState {
  open: boolean;
  id?: number;
  name: string;
  isSubmitting: boolean;
}

interface LanguageDialogState {
  open: boolean;
  id?: number;
  code: string;
  isSubmitting: boolean;
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
  restorePreview: RestoreBackupPreview | null;
  isLoading: boolean;
  isSubmitting: boolean;
}

interface FilePreviewDialogState {
  open: boolean;
  preview: FilePreviewResult | null;
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
}

interface DashboardDrilldownState {
  workspacePath: string;
  status?: DocumentStatus | "Not started";
  projectFilter?: string;
  healthFlag?: DocumentHealthFlag;
  token: number;
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
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  includeExampleData: true,
  isSubmitting: false,
};

const defaultWorkspaceSettingsDialogState: WorkspaceSettingsDialogState = {
  open: false,
  rootPath: undefined,
  workspaceName: "",
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  companyLogoSourceFilePath: null,
  clearCompanyLogo: false,
  isSubmitting: false,
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
};

const defaultDocumentDialogState: DocumentDialogState = {
  mode: "create",
  documentRecordId: undefined,
  open: false,
  title: "",
  documentTypeId: "",
  author: "",
  versionScheme: "numeric-3",
  templateId: "",
  startDate: "",
  languageId: "",
  confidentialityClassId: "",
  projectId: "",
  company: "",
  department: "",
  revisionIntervalMonths: "",
  isSubmitting: false,
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
  approvedBy: "",
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
};

const defaultProjectDialogState: ProjectDialogState = {
  open: false,
  id: undefined,
  name: "",
  isSubmitting: false,
};

const defaultTemplateDialogState: TemplateDialogState = {
  open: false,
  name: "",
  isSubmitting: false,
};

const defaultTemplateFilesDialogState: TemplateFilesDialogState = {
  open: false,
  templateId: undefined,
  templateName: "",
  isSubmitting: false,
};

const defaultClassificationDialogState: ClassificationDialogState = {
  open: false,
  id: undefined,
  name: "",
  isSubmitting: false,
};

const defaultLanguageDialogState: LanguageDialogState = {
  open: false,
  id: undefined,
  code: "",
  isSubmitting: false,
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
  restorePreview: null,
  isLoading: false,
  isSubmitting: false,
};

const defaultFilePreviewDialogState: FilePreviewDialogState = {
  open: false,
  preview: null,
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
  onConfirm: undefined,
};

const defaultRevisionDescriptionDialogState: RevisionDescriptionDialogState = {
  open: false,
  title: "",
  content: "",
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
    project: normalizeDocumentIdPreviewSegment("QMS Rollout", "NA"),
    projectname: normalizeDocumentIdPreviewSegment("QMS Rollout", "NA"),
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

const getFilePathsFromFileList = (files: FileList | File[]): string[] =>
  Array.from(files)
    .map((file) => file.path ?? "")
    .filter((value): value is string => value.trim().length > 0);

const resolveDroppedFilePaths = async (files: FileList | File[]): Promise<string[]> => {
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

const stopRowAction = (event: React.MouseEvent) => event.stopPropagation();
const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  formatUserFacingError(error, fallbackMessage);

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
    setActiveWorkspace,
    setWorkspaceView,
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
  const [templateDialog, setTemplateDialog] = useState(defaultTemplateDialogState);
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
  const [filePreviewDialog, setFilePreviewDialog] = useState(
    defaultFilePreviewDialogState,
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
  const [dashboardDrilldown, setDashboardDrilldown] =
    useState<DashboardDrilldownState | null>(null);
  const [selectedDocumentDetail, setSelectedDocumentDetail] =
    useState<DocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);

  const workspaceTabs = Object.values(openWorkspaces);
  const activeWorkspace = activeWorkspacePath
    ? openWorkspaces[activeWorkspacePath]
    : undefined;
  const activeWorkspaceFilesystemAttention = activeWorkspace
    ? getWorkspaceFilesystemAttentionCounts(activeWorkspace)
    : null;
  const activeWorkspaceAvailableColumns =
    activeWorkspace?.settings.visibleDocumentColumns ??
    DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns;
  const workspaceSupportsProjects =
    activeWorkspaceAvailableColumns.includes("project");
  const workspaceSupportsConfidentialityClasses =
    activeWorkspaceAvailableColumns.includes("confidentialityClass");
  const workspaceSupportsLanguages =
    activeWorkspaceAvailableColumns.includes("language");
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
  const notifyError = useEffectEvent(
    (error: unknown, fallbackMessage: string): void => {
      setNotification({
        tone: "error",
        message: getErrorMessage(error, fallbackMessage),
      });
    },
  );
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
    (version: DocumentVersion, mode: "latest" | "version" = "version"): void => {
      setLatestVersionDialog({
        open: true,
        mode,
        versionId: version.id,
        versionLabel: version.versionLabel,
        status: version.status,
        releasedDate: toDateInputValue(version.releasedDate),
        reviewedBy: version.reviewedBy,
        approvedBy: version.approvedBy,
        revisionDescription: version.revisionDescription,
        isSubmitting: false,
      });
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
          await loadDocumentDetail(rootPath, activeWorkspace.selectedDocumentRecordId);
        }

        setNotification({
          tone: "success",
          message: `Filesystem changes were detected in "${openWorkspaces[rootPath]?.workspace.name ?? "workspace"}". Review pending file drift before reconciling.`,
        });
      } catch (error) {
        notifyError(error, "Unable to refresh workspace state after filesystem changes.");
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

  const openWorkspaceSettingsDialog = () => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaceSettingsDialog({
      open: true,
      rootPath: activeWorkspace.workspace.rootPath,
      workspaceName: activeWorkspace.workspace.name,
      settings: { ...activeWorkspace.settings },
      companyLogoSourceFilePath: null,
      clearCompanyLogo: false,
      isSubmitting: false,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [activeWorkspace, applicationSettings.keyboardShortcuts]);

  const handleCreateWorkspace = async () => {
    try {
      setWorkspaceDialog((state) => ({ ...state, isSubmitting: true }));
      await createWorkspace({
        name: workspaceDialog.name,
        ...(workspaceDialog.useCustomFolderName
          ? {
              folderName: workspaceDialog.folderName,
            }
          : {}),
        parentPath: workspaceDialog.parentPath,
        settings: workspaceDialog.settings,
        includeExampleData: workspaceDialog.includeExampleData,
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

    try {
      setWorkspaceSettingsDialog((state) => ({ ...state, isSubmitting: true }));
      await updateWorkspaceSettings(workspaceSettingsDialog.rootPath, {
        settings: workspaceSettingsDialog.settings,
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

    try {
      setTableColumnsDialog((state) => ({ ...state, isSubmitting: true }));
      const nextVisibleColumns = tableColumnsDialog.visibleColumns.filter(
        (column) => workspaceAvailableColumns.includes(column),
      );

      if (nextVisibleColumns.length === 0) {
        setNotification({
          tone: "error",
          message: "Select at least one table column.",
        });
        setTableColumnsDialog((state) => ({ ...state, isSubmitting: false }));
        return;
      }

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

  const handleSaveDocument = async () => {
    if (!activeWorkspacePath || !activeWorkspace) {
      return;
    }

    try {
      setDocumentDialog((state) => ({ ...state, isSubmitting: true }));
      const revisionIntervalMonths = parseOptionalPositiveInteger(
        documentDialog.revisionIntervalMonths,
      );
      const availableColumns = activeWorkspace.settings.visibleDocumentColumns;
      const documentInput = {
        title: documentDialog.title,
        author: availableColumns.includes("author")
          ? documentDialog.author
          : "",
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
    if (!activeWorkspacePath || !selectedDocumentDetail || !latestVersionDialog.versionId) {
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
                approvedBy: latestVersionDialog.approvedBy,
                revisionDescription: latestVersionDialog.revisionDescription,
              } satisfies UpdateLatestVersionInput,
            )
          : await window.docTrack.documents.updateVersion(
              activeWorkspacePath,
              {
                documentVersionId: latestVersionDialog.versionId,
                status: latestVersionDialog.status,
                releasedDate: latestVersionDialog.releasedDate || null,
                reviewedBy: latestVersionDialog.reviewedBy,
                approvedBy: latestVersionDialog.approvedBy,
                revisionDescription: latestVersionDialog.revisionDescription,
              } satisfies UpdateDocumentVersionInput,
            );
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
      !document.latestVersionLabel ||
      !document.status ||
      document.status === nextStatus
    ) {
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
          approvedBy: document.approvedBy,
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

    try {
      setTypeDialog((state) => ({ ...state, isSubmitting: true }));

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

    try {
      setProjectDialog((state) => ({ ...state, isSubmitting: true }));

      if (projectDialog.id) {
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
      notifyError(error, "Unable to save project.");
      setProjectDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteProject = async (project: Project) => {
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

    try {
      setTemplateDialog((state) => ({ ...state, isSubmitting: true }));
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

    try {
      setTemplateFilesDialog((state) => ({ ...state, isSubmitting: true }));
      const sourceFilePaths = await window.docTrack.dialogs.pickDocumentFiles();
      if (sourceFilePaths.length === 0) {
        setTemplateFilesDialog((state) => ({ ...state, isSubmitting: false }));
        return;
      }

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
        detailLines: [`${template.fileCount} file${template.fileCount === 1 ? "" : "s"}`],
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

    try {
      setClassificationDialog((state) => ({ ...state, isSubmitting: true }));

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

    try {
      setLanguageDialog((state) => ({ ...state, isSubmitting: true }));

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

  const handleAssignProjectToDocument = async (
    document: DocumentListItem,
    nextProjectId: string,
  ) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail = await window.docTrack.documents.update(
        activeWorkspacePath,
        {
          ...toDocumentUpdateInput(document),
          projectId: parseOptionalSelectNumber(nextProjectId),
        },
      );
      await refreshWorkspace(activeWorkspacePath);
      if (selectedDocumentDetail?.id === detail.id) {
        setSelectedDocumentDetail(detail);
      }
    } catch (error) {
      notifyError(error, "Unable to assign the document to a project.");
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
    if (!activeWorkspacePath || !selectedDocumentDetail) {
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
    if (!activeWorkspacePath || !selectedDocumentDetail) {
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
    if (!nextFileName || nextFileName === renameFileDialog.file.fileName) {
      setRenameFileDialog(defaultRenameFileDialogState);
      return;
    }

    try {
      setRenameFileDialog((state) => ({ ...state, isSubmitting: true }));
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
        message: "This version does not have an adjacent older version to compare.",
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
        restorePreview: null,
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
    if (!activeWorkspacePath || !activeWorkspace) {
      return;
    }

    const destinationParentPath =
      await window.docTrack.dialogs.pickWorkspaceCreatePath(
        `${activeWorkspace.workspace.name} Restored`,
      );
    if (!destinationParentPath) {
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      const preview = await window.docTrack.workspace.getRestorePreview(
        activeWorkspacePath,
        backupId,
        destinationParentPath,
      );
      setBackupDialog((state) => ({
        ...state,
        selectedBackupId: backupId,
        restorePreview: preview,
        isSubmitting: false,
      }));
    } catch (error) {
      setBackupDialog((state) => ({ ...state, isSubmitting: false }));
      notifyError(error, "Unable to build the restore preview.");
    }
  };

  const handleRestoreBackup = async () => {
    if (
      !activeWorkspacePath ||
      !backupDialog.restorePreview ||
      !backupDialog.selectedBackupId
    ) {
      return;
    }

    if (backupDialog.restorePreview.destinationExists) {
      setNotification({
        tone: "error",
        message: "The selected restore destination already exists.",
      });
      return;
    }

    try {
      setBackupDialog((state) => ({ ...state, isSubmitting: true }));
      const restored = await window.docTrack.workspace.restoreBackup(
        activeWorkspacePath,
        {
          backupId: backupDialog.selectedBackupId,
          destinationParentPath: backupDialog.restorePreview.destinationRootPath.replace(
            /[\\/][^\\/]+$/,
            "",
          ),
          destinationFolderName:
            backupDialog.restorePreview.suggestedWorkspaceName,
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
        documentRecordId &&
        selectedDocumentDetail?.id !== documentRecordId
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
        unmanagedPaths: detail.versions.flatMap((version) =>
          version.unmanagedPaths,
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
      const version = detail?.versions.find((item) => item.id === documentVersionId);

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
    if (!confirmationDialog.onConfirm) {
      return;
    }

    try {
      setConfirmationDialog((state) => ({ ...state, isSubmitting: true }));
      await confirmationDialog.onConfirm();
      setConfirmationDialog(defaultConfirmationDialogState);
    } catch (error) {
      notifyError(error, "Unable to complete the requested action.");
      setConfirmationDialog((state) => ({ ...state, isSubmitting: false }));
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
  } else if (activeWorkspace.selectedView === "dashboard") {
    activeWorkspaceContent = (
      <DashboardView
        workspace={activeWorkspace}
        onOpenDocuments={(drilldown) => {
          setDashboardDrilldown({
            workspacePath: activeWorkspace.workspace.rootPath,
            token: Date.now(),
            ...drilldown,
          });
          setWorkspaceView(activeWorkspace.workspace.rootPath, "documents");
        }}
        onOpenDocument={(documentRecordId) => {
          setWorkspaceView(activeWorkspace.workspace.rootPath, "documents");
          setSelectedDocument(activeWorkspace.workspace.rootPath, documentRecordId);
        }}
      />
    );
  } else if (
    activeWorkspace.selectedView === "documents" ||
    (activeWorkspace.selectedView === "projects" &&
      !workspaceSupportsProjects) ||
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
        visibleTableColumns={getEffectiveDocumentTableVisibleColumns(
          applicationSettings.documentTableVisibleColumns,
          activeWorkspace.settings.visibleDocumentColumns,
        )}
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
        onOpenTableSettings={() =>
          setTableColumnsDialog({
            open: true,
            visibleColumns: getEffectiveDocumentTableVisibleColumns(
              applicationSettings.documentTableVisibleColumns,
              activeWorkspace.settings.visibleDocumentColumns,
            ),
            isSubmitting: false,
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
        dashboardDrilldown={
          dashboardDrilldown?.workspacePath === activeWorkspace.workspace.rootPath
            ? dashboardDrilldown
            : null
        }
        onDashboardDrilldownConsumed={() =>
          setDashboardDrilldown((current) =>
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
          })
        }
        onDeleteType={handleDeleteDocumentType}
      />
    );
  } else if (activeWorkspace.selectedView === "projects") {
    activeWorkspaceContent = (
      <ProjectsView
        workspace={activeWorkspace}
        onCreateProject={() =>
          setProjectDialog({ ...defaultProjectDialogState, open: true })
        }
        onEditProject={(project) =>
          setProjectDialog({
            open: true,
            id: project.id,
            name: project.name,
            isSubmitting: false,
          })
        }
        onDeleteProject={handleDeleteProject}
        onAssignProject={handleAssignProjectToDocument}
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
            isSubmitting: false,
          })
        }
        onOpenTemplatesFolder={() => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openStoredPath(
              activeWorkspacePath,
              getWorkspaceTemplatesRelativePath(),
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
              notifyError(error, "Unable to open the selected template folder.");
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
          })
        }
        onDeleteLanguage={handleDeleteLanguage}
      />
    );
  }

  if (!isBootstrapped) {
    return (
      <div className="app-surface flex h-full items-center justify-center">
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
        "app-surface flex h-full flex-col",
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
                    startTransition(() => {
                      setActiveWorkspace(workspaceTab.workspace.rootPath);
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      startTransition(() => {
                        setActiveWorkspace(workspaceTab.workspace.rootPath);
                      });
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
                    {applicationSettings.workspaceTabDensity === "comfortable" ? (
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
              icon={Sparkles}
              label="Dashboard"
              active={activeWorkspace?.selectedView === "dashboard"}
              disabled={!activeWorkspace}
              attentionCount={activeWorkspaceFilesystemAttention?.totalAttentionCount}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "dashboard")
              }
            />
            <SidebarButton
              icon={Table2}
              label="Documents"
              active={activeWorkspace?.selectedView === "documents"}
              disabled={!activeWorkspace}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "documents")
              }
            />
            {workspaceSupportsProjects ? (
              <SidebarButton
                icon={FolderOpen}
                label="Projects"
                active={activeWorkspace?.selectedView === "projects"}
                disabled={!activeWorkspace}
                onClick={() =>
                  activeWorkspacePath &&
                  setWorkspaceView(activeWorkspacePath, "projects")
                }
              />
            ) : null}
            <SidebarButton
              icon={FileStack}
              label="Templates"
              active={activeWorkspace?.selectedView === "templates"}
              disabled={!activeWorkspace}
              onClick={() =>
                activeWorkspacePath &&
                setWorkspaceView(activeWorkspacePath, "templates")
              }
            />
            <SidebarButton
              icon={LayoutPanelLeft}
              label="Document Types"
              active={activeWorkspace?.selectedView === "documentTypes"}
              disabled={!activeWorkspace}
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
                disabled={!activeWorkspace}
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
                disabled={!activeWorkspace}
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
            <SidebarButton
              icon={FilePlus2}
              label="New Document"
              disabled={!activeWorkspace}
              onClick={openCreateDocumentDialog}
            />
            <SidebarButton
              icon={Settings2}
              label="Workspace Settings"
              active={workspaceSettingsDialog.open}
              disabled={!activeWorkspace}
              onClick={openWorkspaceSettingsDialog}
            />
            <SidebarButton
              icon={History}
              label="Backups & Recovery"
              active={backupDialog.open}
              disabled={!activeWorkspace}
              onClick={openBackupDialog}
            />
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-3">
          {activeWorkspaceContent}
        </section>
      </main>

      <WorkspaceDialog
        state={workspaceDialog}
        onStateChange={setWorkspaceDialog}
        onSubmit={handleCreateWorkspace}
      />

      <WorkspaceSettingsDialog
        state={workspaceSettingsDialog}
        onStateChange={setWorkspaceSettingsDialog}
        onSubmit={handleSaveWorkspaceSettings}
      />

      <ApplicationSettingsDialog
        state={applicationSettingsDialog}
        onStateChange={setApplicationSettingsDialog}
        onSubmit={handleSaveApplicationSettings}
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
        templates={activeWorkspace?.templates ?? []}
        projects={activeWorkspace?.projects ?? []}
        confidentialityClasses={activeWorkspace?.confidentialityClasses ?? []}
        languages={activeWorkspace?.languages ?? []}
        availableColumns={activeWorkspaceAvailableColumns}
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
        onRestore={handleRestoreBackup}
        onRefresh={() =>
          activeWorkspacePath && void refreshBackupDialog(activeWorkspacePath)
        }
      />

      <FilePreviewDialog
        state={filePreviewDialog}
        onOpenChange={(open) =>
          setFilePreviewDialog(
            open ? { ...filePreviewDialog, open } : defaultFilePreviewDialogState,
          )
        }
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
  onStateChange,
  onSubmit,
  isMacOs,
}: {
  state: ApplicationSettingsDialogState;
  onStateChange: React.Dispatch<
    React.SetStateAction<ApplicationSettingsDialogState>
  >;
  onSubmit: () => Promise<void>;
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

              <Field label="Default Document Author">
                <Input
                  placeholder="Jordan Singh"
                  value={state.settings.defaultDocumentAuthor}
                  onChange={(event) =>
                    updateSettings({
                      defaultDocumentAuthor: event.target.value,
                    })
                  }
                />
                <div className="text-xs text-muted-foreground">
                  New document dialogs start with this author name pre-filled.
                </div>
              </Field>

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
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px]">
      <input
        checked={checked}
        className="mt-1"
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
        "fixed left-1/2 top-4 z-[80] flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between rounded-xl border px-3 py-2 text-[13px] shadow-lg",
        tone === "success"
          ? "border-[#CFE3D5] bg-[#F6FBF7] text-[#2F6B48] dark:border-[#35503F] dark:bg-[#1F2E25] dark:text-[#8FD9A8]"
          : "border-[#F0D5D3] bg-[#FFF7F6] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21] dark:text-[#FFB7B2]",
      )}
    >
      <div>{message}</div>
      <button
        className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
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
  icon: typeof Table2;
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
        <Badge variant="outline" className="mb-4 w-fit gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Workspace-first document operations
        </Badge>
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
              Fast re-entry into the last offline projects you touched
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
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onOpenDocuments: (drilldown: {
    status?: DocumentStatus | "Not started";
    projectFilter?: string;
    healthFlag?: DocumentHealthFlag;
  }) => void;
  onOpenDocument: (documentRecordId: number) => void;
}) {
  const overdueDocuments = workspace.documents.filter(
    (document) => document.isOverdue,
  );
  const filesystemAttention = getWorkspaceFilesystemAttentionCounts(workspace);
  const hasFilesystemAttention = filesystemAttention.totalAttentionCount > 0;

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="min-h-0 space-y-3">
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
            </div>
          </div>

          {hasFilesystemAttention ? (
            <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Fix filesystem issues before they spread
                  </div>
                  <div className="mt-1 text-[13px] text-destructive/90">
                    {filesystemAttention.totalAttentionCount} document
                    {filesystemAttention.totalAttentionCount === 1 ? "" : "s"}{" "}
                    need attention because files changed outside DocTrack. Open
                    the affected documents table, then use{" "}
                    <span className="font-semibold">Review Files</span> on the
                    highlighted rows.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {workspace.dashboard.countsByStatus.map((item) => (
              <button
                key={item.id}
                className="rounded-xl border border-border bg-background p-3 text-left transition hover:bg-accent"
                onClick={() =>
                  onOpenDocuments({
                    status: item.status,
                  })
                }
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-semibold">{item.count}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Document Health</div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Review the highest-signal issues in this workspace.
                </div>
              </div>
            </div>
            <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {workspace.dashboard.healthInsights.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                  No document health issues detected right now.
                </div>
              ) : (
                workspace.dashboard.healthInsights.map((item) => (
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
                      <div className="text-sm font-semibold">{item.label}</div>
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
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="text-sm font-semibold">Groupings</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Open focused document slices by type or project.
            </div>

            <div className="mt-4 max-h-[320px] space-y-4 overflow-y-auto pr-1">
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

              <div className="space-y-2">
                {workspace.dashboard.countsByProject.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:bg-accent"
                  onClick={() =>
                    onOpenDocuments({
                      projectFilter:
                        item.projectId === null ? "" : String(item.projectId),
                    })
                  }
                >
                  <span className="text-[13px]">{item.label}</span>
                  <Badge variant="outline">{item.count}</Badge>
                </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="min-h-0 space-y-3">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Recent Activity</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Latest tracked changes from the workspace history.
              </div>
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4 max-h-[396px] space-y-2 overflow-y-auto pr-1">
            {workspace.dashboard.recentActivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
                No recent activity has been recorded yet.
              </div>
            ) : (
              workspace.dashboard.recentActivity.map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left transition hover:bg-accent"
                  onClick={() =>
                    item.documentRecordId && onOpenDocument(item.documentRecordId)
                  }
                >
                  <div className="text-[13px] font-medium">{item.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(item.createdDate)}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentsView({
  workspace,
  applicationSettings,
  isMacOs,
  documentTableDensity,
  visibleTableColumns,
  selectedDocumentDetail,
  isDetailLoading,
  onSelectDocument,
  onCloseDocumentDetail,
  onShowFiles,
  onRequestStatusChange,
  onRequestNewDocument,
  onExportDocuments,
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
  dashboardDrilldown,
  onDashboardDrilldownConsumed,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  applicationSettings: ApplicationSettings;
  isMacOs: boolean;
  documentTableDensity: DocumentTableDensity;
  visibleTableColumns: DocumentTableColumn[];
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
  dashboardDrilldown: DashboardDrilldownState | null;
  onDashboardDrilldownConsumed: () => void;
}) {
  const fallbackSortingColumn = visibleTableColumns.includes("modifiedDate")
    ? "modifiedDate"
    : (visibleTableColumns[0] ?? "documentId");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: fallbackSortingColumn,
      desc: fallbackSortingColumn === "modifiedDate",
    },
  ]);
  const [statusFilter, setStatusFilter] = useState<
    DocumentStatus | "All" | "Not started"
  >("All");
  const [projectFilter, setProjectFilter] = useState<string>("All");
  const [healthFilter, setHealthFilter] = useState<DocumentHealthFlag | "All">(
    "All",
  );
  const [exportDialog, setExportDialog] = useState(
    defaultDocumentExportDialogState,
  );
  const [sidebarWidth, setSidebarWidth] = useState(
    applicationSettings.documentDetailSidebarWidth,
  );
  const [isSidebarEntered, setIsSidebarEntered] = useState(false);
  const availableColumns = workspace.settings.visibleDocumentColumns;
  const projectFeatureEnabled = availableColumns.includes("project");
  const deferredSearch = useDeferredValue(search);
  const detailViewMode = applicationSettings.documentDetailViewMode;
  const hasSelectedDocument = Boolean(workspace.selectedDocumentRecordId);
  const isSidebarOpen = detailViewMode === "sidebar" && hasSelectedDocument;
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
    setSorting((current) => {
      if (
        current.every((entry) =>
          visibleTableColumns.includes(entry.id as DocumentTableColumn),
        )
      ) {
        return current;
      }

      return [
        {
          id: fallbackSortingColumn,
          desc: fallbackSortingColumn === "modifiedDate",
        },
      ];
    });
  }, [fallbackSortingColumn, visibleTableColumns]);

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
    if (!dashboardDrilldown) {
      return;
    }

    if (dashboardDrilldown.status) {
      setStatusFilter(dashboardDrilldown.status);
    } else {
      setStatusFilter("All");
    }

    if (dashboardDrilldown.projectFilter !== undefined) {
      setProjectFilter(dashboardDrilldown.projectFilter);
    } else {
      setProjectFilter("All");
    }

    if (dashboardDrilldown.healthFlag) {
      setHealthFilter(dashboardDrilldown.healthFlag);
    } else {
      setHealthFilter("All");
    }

    onDashboardDrilldownConsumed();
  }, [dashboardDrilldown, onDashboardDrilldownConsumed]);

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

  const filteredDocuments = useMemo(
    () =>
      workspace.documents.filter((document) => {
        const matchesStatus =
          statusFilter === "All"
            ? true
            : statusFilter === "Not started"
              ? document.status === null
              : document.status === statusFilter;
        const matchesProject =
          !projectFeatureEnabled ||
          projectFilter === "All" ||
          String(document.projectId ?? "") === projectFilter;
        const matchesHealth =
          healthFilter === "All" ||
          document.healthFlags.includes(healthFilter);
        return matchesStatus && matchesProject && matchesHealth;
      }),
    [
      healthFilter,
      projectFeatureEnabled,
      projectFilter,
      statusFilter,
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
            statuses={workspace.statuses}
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
        id: "project",
        accessorFn: (row) => row.projectName ?? "",
        header: columnHeader("Project"),
        cell: ({ row }) => <span>{row.original.projectName ?? "—"}</span>,
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
        cell: ({ row }) => <span>{formatDateShort(row.original.startDate)}</span>,
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
      globalFilter: deferredSearch,
    },
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => {
      const haystack = [
        row.original.documentId,
        row.original.title,
        row.original.typeName,
        availableColumns.includes("author") ? row.original.author : "",
        row.original.status ?? "",
        availableColumns.includes("language")
          ? (row.original.languageCode ?? "")
          : "",
        availableColumns.includes("confidentialityClass")
          ? (row.original.confidentialityClassName ?? "")
          : "",
        projectFeatureEnabled ? (row.original.projectName ?? "") : "",
        availableColumns.includes("company") ? row.original.company : "",
        availableColumns.includes("department") ? row.original.department : "",
        availableColumns.includes("startDate") ? row.original.startDate : "",
        availableColumns.includes("reviewedBy") ? row.original.reviewedBy : "",
        availableColumns.includes("approvedBy") ? row.original.approvedBy : "",
        availableColumns.includes("revisionDescription")
          ? row.original.revisionDescription
          : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(String(filterValue).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const currentTableRows = table.getRowModel().rows.map((row) => row.original);
  const affectedCurrentRows = currentTableRows.filter((document) =>
    documentNeedsFilesystemReview(document),
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

    return [...workspace.documents].sort((left, right) => {
      for (const entry of sortingToUse) {
        const column = entry.id as DocumentTableColumn;
        const result = compareSortValues(
          getSortValue(left, column),
          getSortValue(right, column),
        );
        if (result !== 0) {
          return entry.desc ? -result : result;
        }
      }

      return 0;
    });
  }, [availableColumns, sorting, workspace.documents]);

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
    const selectedProject =
      exportDialog.scope === "current-table" && projectFeatureEnabled
        ? (workspace.projects.find(
            (project) => String(project.id) === projectFilter,
          )?.name ?? (projectFilter === "" ? "No project" : "All projects"))
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
                status: statusFilter,
                project: selectedProject,
              }
            : {
                search: "",
                status: "All",
                project: "",
              },
      });
      setExportDialog(defaultDocumentExportDialogState);
    } catch (error) {
      setExportDialog((current) => ({ ...current, isSubmitting: false }));
      throw error;
    }
  };

  const renderDetailContent = (layout: "sidebar" | "modal" | "page") => (
    <DocumentDetailSurface
      layout={layout}
      documentDetail={selectedDocumentDetail}
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
            <div className="flex gap-2">
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
              <Button
                aria-label="Table View Settings"
                variant="outline"
                size="icon"
                onClick={onOpenTableSettings}
                title="Table View Settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
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
                  placeholder="ID, title, type, author, project, status, metadata..."
                  value={search}
                  onChange={(event) => {
                    startTransition(() => {
                      setSearch(event.target.value);
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
                      statusFilter === status
                        ? "border-border bg-secondary text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Project filter */}
            {projectFeatureEnabled ? (
              <Field label="Project">
                <Select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
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
                value={healthFilter}
                onChange={(event) =>
                  setHealthFilter(event.target.value as DocumentHealthFlag | "All")
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

          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
            <div className="h-full overflow-auto">
              <table className="min-w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-card/95">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
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
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className={emptyStateClassName}
                      >
                        No documents match the current search and filter
                        settings.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      (() => {
                        const hasFilesystemReviewIssue =
                          documentNeedsFilesystemReview(row.original);

                        return (
                      <tr
                        key={row.id}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition hover:bg-accent/70",
                          hasFilesystemReviewIssue &&
                            "border-destructive/25 bg-destructive/5 hover:bg-destructive/10",
                          workspace.selectedDocumentRecordId ===
                            row.original.id &&
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
                      })()
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                <DocumentProgressBadge status={latestVersion?.status ?? null} />
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
                                <StatusBadge status={version.status} />
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
    </>
  );
}

function DocumentDetailSurface({
  layout,
  documentDetail,
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
                <StatusBadge status={latestVersion.status} />
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
                    <DocumentProgressBadge status={latestVersion.status} />
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
                              <StatusBadge status={version.status} />
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
                        <StatusBadge status={latestVersion.status} />
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

function ProjectsView({
  workspace,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onAssignProject,
}: {
  workspace: ReturnType<typeof useAppStore.getState>["openWorkspaces"][string];
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAssignProject: (document: DocumentListItem, nextProjectId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const totalAssignedDocuments = workspace.documents.filter(
    (document) => document.projectId !== null,
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
            document.projectName ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesAssignment =
          assignmentFilter === "all"
            ? true
            : assignmentFilter === "assigned"
              ? document.projectId !== null
              : document.projectId === null;
        const matchesProject =
          projectFilter === "all"
            ? true
            : String(document.projectId ?? "") === projectFilter;

        return matchesSearch && matchesAssignment && matchesProject;
      })
      .sort((left, right) =>
        left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        }),
      );
  }, [
    assignmentFilter,
    deferredSearch,
    projectFilter,
    workspace.documents,
  ]);

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <div className="text-lg font-semibold">Projects</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Group related documents inside one workspace project.
            </div>
          </div>
          <Button onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total Projects
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {workspace.projects.length}
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
          {workspace.projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No projects yet. Create a project, then assign existing documents
              from the panel on the right.
            </div>
          ) : (
            workspace.projects.map((project) => {
              const documentCount = workspace.documents.filter(
                (document) => document.projectId === project.id,
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
                    <Badge variant="outline">Workspace project</Badge>
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
            Quickly move existing documents into a project or clear the
            assignment.
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_200px]">
          <Field label="Search Documents">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder="Search by title, ID, type, or project"
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
          <Field label="Project Filter">
            <Select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All projects</option>
              <option value="">No project</option>
              {workspace.projects.map((project) => (
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
              project here.
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No documents match the current project filters.
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
                    <span>{document.projectName ?? "No project"}</span>
                    {document.status ? (
                      <>
                        <span>•</span>
                        <span>{document.status}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Field label="Project">
                  <Select
                    value={document.projectId ? String(document.projectId) : ""}
                    onChange={(event) =>
                      void onAssignProject(document, event.target.value)
                    }
                  >
                    <option value="">No project</option>
                    {workspace.projects.map((project) => (
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
          <div className="mt-2 text-2xl font-semibold">{totalTemplateFiles}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
            No templates yet. Create one, add files, and use it when
            creating a new document.
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
            <Field label="Workspace Name">
              <Input
                placeholder="Quality Operations"
                value={state.name}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    name: event.target.value,
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
              <Field label="Folder Name">
                <Input
                  placeholder="quality-operations"
                  value={state.folderName}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      folderName: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}

            <Field label="Workspace Location">
              <div className="flex gap-2">
                <Input
                  placeholder="/Users/you/Documents"
                  value={state.parentPath}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      parentPath: event.target.value,
                    }))
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
                          onStateChange((current) => ({
                            ...current,
                            parentPath,
                          }));
                        }
                      });
                  }}
                >
                  Browse
                </Button>
              </div>
            </Field>

            <WorkspaceStorageSettingsFields
              workspaceName={
                state.useCustomFolderName
                  ? state.folderName || state.name
                  : state.name
              }
              settings={state.settings}
              showBrandingControls={false}
              companyLogoSourceFilePath={null}
              clearCompanyLogo={false}
              onSettingsChange={(settings) =>
                onStateChange((current) => ({
                  ...current,
                  settings,
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
                      }))
                    }
                  />
                  <span>{column.label}</span>
                </label>
              ))
            )}
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
  onStateChange,
  onSubmit,
}: {
  state: WorkspaceSettingsDialogState;
  onStateChange: React.Dispatch<
    React.SetStateAction<WorkspaceSettingsDialogState>
  >;
  onSubmit: () => Promise<void>;
}) {
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
            <WorkspaceStorageSettingsFields
              workspaceName={state.workspaceName}
              settings={state.settings}
              companyLogoSourceFilePath={state.companyLogoSourceFilePath}
              clearCompanyLogo={state.clearCompanyLogo}
              onSettingsChange={(settings) =>
                onStateChange((current) => ({
                  ...current,
                  settings,
                }))
              }
              onLogoSelect={(filePath) =>
                onStateChange((current) => ({
                  ...current,
                  companyLogoSourceFilePath: filePath,
                  clearCompanyLogo: false,
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
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings2 className="h-4 w-4" />
            )}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceStorageSettingsFields({
  workspaceName,
  settings,
  showBrandingControls = true,
  companyLogoSourceFilePath,
  clearCompanyLogo,
  onSettingsChange,
  onLogoSelect,
  onLogoRemove,
}: {
  workspaceName: string;
  settings: WorkspaceSettings;
  showBrandingControls?: boolean;
  companyLogoSourceFilePath: string | null;
  clearCompanyLogo: boolean;
  onSettingsChange: (settings: WorkspaceSettings) => void;
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

      <Field label="Document ID Template">
        <Textarea
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

      <Field label="Enabled Workspace Fields">
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
    </div>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentTypes,
  templates,
  projects,
  confidentialityClasses,
  languages,
  availableColumns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DocumentDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<DocumentDialogState>>;
  onSubmit: () => Promise<void>;
  documentTypes: DocumentType[];
  templates: TemplateSummary[];
  projects: Project[];
  confidentialityClasses: ConfidentialityClass[];
  languages: WorkspaceLanguage[];
  availableColumns: DocumentTableColumn[];
}) {
  const showAuthor = availableColumns.includes("author");
  const showLanguage = availableColumns.includes("language");
  const showConfidentialityClass = availableColumns.includes(
    "confidentialityClass",
  );
  const showProject = availableColumns.includes("project");
  const showCompany = availableColumns.includes("company");
  const showDepartment = availableColumns.includes("department");
  const showStartDate = availableColumns.includes("startDate");
  const showRevisionInterval = availableColumns.includes(
    "revisionIntervalMonths",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state.mode === "create" ? "Create Document" : "Edit Document"}
          </DialogTitle>
          <DialogDescription>
            {state.mode === "create"
              ? "Create the document shell first. DocTrack will generate the document ID and physical folder immediately, and you can add versions and files afterward."
              : "Update the document metadata used in the table, detail view, and project assignments."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div
            className={cn(
              "grid gap-4",
              showAuthor || showStartDate ? "md:grid-cols-3" : "md:grid-cols-1",
            )}
          >
            <Field label="Title">
              <Input
                placeholder="Internal Audit Procedure"
                value={state.title}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </Field>
            {showAuthor ? (
              <Field label="Author">
                <Input
                  placeholder="Jordan Singh"
                  value={state.author}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      author: event.target.value,
                    }))
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
            <>
              <Field label="Document Type">
                <Select
                  value={state.documentTypeId}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      documentTypeId: event.target.value,
                    }))
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
            </>
          ) : null}

          {showLanguage || showConfidentialityClass || showProject ? (
            <div className="grid gap-4 md:grid-cols-3">
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

              {showProject ? (
                <Field label="Project">
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
                </Field>
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
                <Field label="Revision Interval (months)">
                  <Input
                    inputMode="numeric"
                    placeholder="12"
                    value={state.revisionIntervalMonths}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        revisionIntervalMonths: event.target.value.replace(
                          /[^\d]/g,
                          "",
                        ),
                      }))
                    }
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
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
  availableColumns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LatestVersionDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<LatestVersionDialogState>>;
  onSubmit: () => Promise<void>;
  documentDetail: DocumentDetail | null;
  availableColumns: DocumentTableColumn[];
}) {
  const showReleasedDate = availableColumns.includes("releasedDate");
  const showReviewedBy = availableColumns.includes("reviewedBy");
  const showApprovedBy = availableColumns.includes("approvedBy");
  const showRevisionDescription = availableColumns.includes(
    "revisionDescription",
  );
  const detailFieldCount =
    Number(showReleasedDate) +
    Number(showReviewedBy) +
    Number(showApprovedBy);
  const title =
    state.mode === "latest"
      ? "Edit Latest Version"
      : `Edit Version ${state.versionLabel}`;
  const description =
    state.mode === "latest"
      ? "Update the current latest version without creating a new version entry."
      : "Adjust the metadata stored for this specific version.";

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
            {["Draft", "In Review", "Released", "Archived", "Obsolete"].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </Select>
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

            {showReviewedBy ? (
              <Field label="Reviewed By">
                <Input
                  placeholder="Morgan Patel"
                  value={state.reviewedBy}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      reviewedBy: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}

            {showApprovedBy ? (
              <Field label="Approved By">
                <Input
                  placeholder="Taylor Reed"
                  value={state.approvedBy}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
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
          <Field label="Type Name">
            <Input
              placeholder="Specification"
              value={state.name}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Number Prefix">
            <Input
              maxLength={2}
              placeholder="01"
              value={state.numberPrefix}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  numberPrefix: event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 2),
                }))
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {state.id ? "Edit Project" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            Projects let multiple documents be grouped inside the workspace.
          </DialogDescription>
        </DialogHeader>

        <Field label="Project Name">
          <Input
            placeholder="QMS Rollout"
            value={state.name}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                name: event.target.value,
              }))
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
            Save Project
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

        <Field label="Template Name">
          <Input
            placeholder="Procedure Starter"
            value={state.name}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                name: event.target.value,
              }))
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
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TemplateFilesDialogState;
  onStateChange: React.Dispatch<
    React.SetStateAction<TemplateFilesDialogState>
  >;
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
            Select and Add Files
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

        <Field label="Class Name">
          <Input
            placeholder="Internal"
            value={state.name}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                name: event.target.value,
              }))
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

        <Field label="Language Code">
          <Input
            maxLength={8}
            placeholder="EN"
            value={state.code}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                code: event.target.value.toUpperCase(),
              }))
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
    ? affectedVersions.some((affectedVersion) => affectedVersion.id === version.id)
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
                  <DocumentProgressBadge status={version.status} />
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
                      Use the version buttons below to move through each affected
                      version and apply decisions from this dialog.
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
                          addRole: event.target.value as DocumentVersionFileRole,
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
                    disabled={!canEdit || state.pendingSourceFilePaths.length === 0}
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
                  Drag files into this panel or use Select Files to stage them.
                  DocTrack will show the pending list first, then upload only
                  after you confirm.
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
                      change.discoveredPath ?? change.trackedPath ?? "Unknown path";
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
                                    event.target.value as DocumentVersionFileRole,
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
  state,
  onOpenChange,
  onConfirm,
}: {
  state: ConfirmationDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
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
            {state.confirmLabel}
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
              <div className="mt-2 text-sm font-medium">{state.file.fileName}</div>
              <div className="mt-2 break-all text-xs text-primary">
                {state.file.filePath}
              </div>
            </div>

            <Field label="New File Name">
              <Input
                autoFocus
                value={state.nextFileName}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    nextFileName: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !state.isSubmitting && nextFileName) {
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

function BackupDialog({
  state,
  onOpenChange,
  onCreateBackup,
  onPreviewRestore,
  onRestore,
  onRefresh,
}: {
  state: BackupDialogState;
  onOpenChange: (open: boolean) => void;
  onCreateBackup: () => Promise<void>;
  onPreviewRestore: (backupId: string) => Promise<void>;
  onRestore: () => Promise<void>;
  onRefresh: () => void;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,960px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Backups & Recovery</DialogTitle>
          <DialogDescription>
            Create manual snapshots, review integrity warnings, and restore a
            backup into a new folder.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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
                        "rounded-xl border p-3",
                        backup.id === state.selectedBackupId
                          ? "border-border bg-card"
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
                            {backup.documentCount} docs • {backup.versionCount} versions •{" "}
                            {formatFileSize(backup.sizeBytes)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onPreviewRestore(backup.id)}
                        >
                          Preview Restore
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
                <div className="text-sm font-semibold">Restore Preview</div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Restores always create a new workspace folder. In-place
                  overwrite is intentionally disabled.
                </div>

                {state.restorePreview ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <div className="text-sm font-semibold">
                        {state.restorePreview.backup.label}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Target: {state.restorePreview.destinationRootPath}
                      </div>
                      {state.restorePreview.destinationExists ? (
                        <div className="mt-2 text-xs text-[#C4554D] dark:text-[#FFB7B2]">
                          The target folder already exists and must be changed.
                        </div>
                      ) : null}
                    </div>
                    <Button
                      disabled={state.isSubmitting || state.restorePreview.destinationExists}
                      onClick={() => void onRestore()}
                    >
                      {state.isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <History className="h-4 w-4" />
                      )}
                      Restore Into New Folder
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                    Choose a snapshot and preview a destination to enable
                    restore.
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
                  {state.result.previousVersionLabel} → {state.result.currentVersionLabel}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {state.result.deltas.length} changes • {state.result.unchangedCount} unchanged
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[13px] font-medium text-foreground/90">
        {label}
      </span>
      {children}
    </label>
  );
}

function DocumentStatusSelect({
  document,
  statuses,
  onRequestStatusChange,
}: {
  document: DocumentListItem;
  statuses: DocumentStatus[];
  onRequestStatusChange: (
    document: DocumentListItem,
    nextStatus: DocumentStatus,
  ) => void;
}) {
  if (!document.status || !document.latestVersionLabel) {
    return <DocumentProgressBadge status={document.status} />;
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
          STATUS_VARIANTS[document.status] === "success" &&
            "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200",
          STATUS_VARIANTS[document.status] === "warning" &&
            "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200",
          STATUS_VARIANTS[document.status] === "default" &&
            "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200",
          STATUS_VARIANTS[document.status] === "muted" &&
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
}: {
  state: StatusChangeDialogState;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
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
              <StatusBadge status={document.status!} />
              <span>Next</span>
              <StatusBadge status={state.nextStatus} />
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

function DocumentProgressBadge({ status }: { status: DocumentStatus | null }) {
  if (!status) {
    return <Badge variant="outline">Not started</Badge>;
  }

  return <StatusBadge status={status} />;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>;
}

function getNextVersionLabelPreview(
  documentDetail: DocumentDetail,
  bumpType: VersionBumpType,
): string {
  const latestVersion = documentDetail.versions[0];

  if (documentDetail.versionScheme === "numeric-3") {
    return String((latestVersion?.sequenceNumber ?? 0) + 1).padStart(3, "0");
  }

  if (documentDetail.versionScheme === "v-prefix") {
    return `v${(latestVersion?.sequenceNumber ?? 0) + 1}`;
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

function columnHeader(label: string) {
  return ({
    column,
  }: {
    column: {
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (desc?: boolean) => void;
    };
  }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

export default App;
