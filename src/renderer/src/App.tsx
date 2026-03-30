import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  ArrowUpDown,
  CircleDot,
  FilePlus2,
  FileStack,
  FolderOpen,
  History,
  LayoutPanelLeft,
  Loader2,
  Moon,
  Pencil,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  Sun,
  SunMoon,
  Table2,
  Upload,
  X
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog';
import { Input } from '@renderer/components/ui/input';
import { Select } from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { cn, formatDateShort, formatDateTime } from '@renderer/lib/utils';
import { useAppStore } from '@renderer/store/useAppStore';
import {
  APPLICATION_LAUNCH_BEHAVIOR_OPTIONS,
  DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS,
  DEFAULT_APPLICATION_SETTINGS,
  DOCUMENT_TABLE_DENSITY_OPTIONS,
  THEME_MODE_OPTIONS,
  WORKSPACE_VIEW_OPTIONS,
  type ApplicationSettings,
  type DocumentTableDensity,
  type ThemeMode
} from '@shared/applicationSettings';
import {
  DOCUMENT_VERSION_FILE_ROLE_LABELS,
  DOCUMENT_VERSION_FILE_ROLES,
  DOCUMENT_VERSION_SCHEME_LABELS,
  type DocumentVersionFileRole,
  type DocumentVersionScheme,
  type VersionBumpType
} from '@shared/documentModel';
import {
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  buildVersionFileRelativePath,
  DEFAULT_WORKSPACE_SETTINGS,
  DOCUMENT_TABLE_COLUMN_OPTIONS,
  WORKSPACE_FILE_ORGANIZATION_OPTIONS,
  WORKSPACE_STORAGE_LAYOUT_OPTIONS,
  type DocumentTableColumn,
  type WorkspaceSettings
} from '@shared/workspaceLayout';
import type {
  ConfidentialityClass,
  CreateDocumentInput,
  CreateVersionInput,
  DocumentDetail,
  DocumentListItem,
  DocumentStatus,
  DocumentVersion,
  DocumentVersionFile,
  DocumentType,
  Project,
  UpdateDocumentInput,
  UpdateLatestVersionInput,
  WorkspaceLanguage
} from '@shared/types';

type NotificationTone = 'success' | 'error';

const STATUS_VARIANTS: Record<DocumentStatus, 'success' | 'warning' | 'muted' | 'default'> = {
  Draft: 'warning',
  'In Review': 'default',
  Released: 'success',
  Archived: 'muted',
  Obsolete: 'muted'
};

const THEME_MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: SunMoon
};

const SUCCESS_NOTIFICATION_TIMEOUT_MS = 3500;

const getSystemTheme = (): ThemeMode =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (themeMode: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
  root.classList.toggle('dark', effectiveTheme === 'dark');
};

const buildWorkspaceDialogState = (
  applicationSettings: ApplicationSettings
): WorkspaceDialogState => ({
  ...defaultWorkspaceDialogState,
  open: true,
  includeExampleData: applicationSettings.defaultIncludeExampleData
});

const buildCreateDocumentDialogState = (
  applicationSettings: ApplicationSettings,
  workspaceSettings: WorkspaceSettings
): DocumentDialogState => ({
  ...defaultDocumentDialogState,
  mode: 'create',
  open: true,
  author: applicationSettings.defaultDocumentAuthor,
  versionScheme: applicationSettings.defaultDocumentVersionScheme,
  company: workspaceSettings.defaultCompany,
  department: workspaceSettings.defaultDepartment
});

const buildEditDocumentDialogState = (documentDetail: DocumentDetail): DocumentDialogState => ({
  ...defaultDocumentDialogState,
  mode: 'edit',
  open: true,
  documentRecordId: documentDetail.id,
  title: documentDetail.title,
  documentTypeId: String(documentDetail.typeId),
  author: documentDetail.author,
  versionScheme: documentDetail.versionScheme,
  languageId: documentDetail.languageId ? String(documentDetail.languageId) : '',
  confidentialityClassId: documentDetail.confidentialityClassId
    ? String(documentDetail.confidentialityClassId)
    : '',
  projectId: documentDetail.projectId ? String(documentDetail.projectId) : '',
  company: documentDetail.company,
  department: documentDetail.department,
  revisionIntervalMonths:
    documentDetail.revisionIntervalMonths !== null
      ? String(documentDetail.revisionIntervalMonths)
      : ''
});

const buildApplicationSettingsDialogState = (
  applicationSettings: ApplicationSettings
): ApplicationSettingsDialogState => ({
  open: true,
  settings: { ...applicationSettings },
  isSubmitting: false
});

interface WorkspaceDialogState {
  open: boolean;
  name: string;
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
  mode: 'create' | 'edit';
  documentRecordId?: number;
  open: boolean;
  title: string;
  documentTypeId: string;
  author: string;
  versionScheme: DocumentVersionScheme;
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
  addRole: DocumentVersionFileRole;
  isSubmitting: boolean;
}

interface LatestVersionDialogState {
  open: boolean;
  status: DocumentStatus;
  releasedDate: string;
  approvedBy: string;
  revisionDescription: string;
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

const defaultWorkspaceDialogState: WorkspaceDialogState = {
  open: false,
  name: '',
  parentPath: '',
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  includeExampleData: true,
  isSubmitting: false
};

const defaultWorkspaceSettingsDialogState: WorkspaceSettingsDialogState = {
  open: false,
  rootPath: undefined,
  workspaceName: '',
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  isSubmitting: false
};

const defaultApplicationSettingsDialogState: ApplicationSettingsDialogState = {
  open: false,
  settings: { ...DEFAULT_APPLICATION_SETTINGS },
  isSubmitting: false
};

const defaultTableColumnsDialogState: TableColumnsDialogState = {
  open: false,
  visibleColumns: [...DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS],
  isSubmitting: false
};

const defaultDocumentDialogState: DocumentDialogState = {
  mode: 'create',
  documentRecordId: undefined,
  open: false,
  title: '',
  documentTypeId: '',
  author: '',
  versionScheme: 'numeric-3',
  languageId: '',
  confidentialityClassId: '',
  projectId: '',
  company: '',
  department: '',
  revisionIntervalMonths: '',
  isSubmitting: false
};

const defaultVersionDialogState: VersionDialogState = {
  open: false,
  revisionDescription: '',
  bumpType: 'minor',
  isSubmitting: false
};

const defaultFilesDialogState: FilesDialogState = {
  open: false,
  versionId: undefined,
  addRole: 'working',
  isSubmitting: false
};

const defaultLatestVersionDialogState: LatestVersionDialogState = {
  open: false,
  status: 'Draft',
  releasedDate: '',
  approvedBy: '',
  revisionDescription: '',
  isSubmitting: false
};

const defaultTypeDialogState: TypeDialogState = {
  open: false,
  name: '',
  numberPrefix: '',
  isSubmitting: false
};

const defaultProjectDialogState: ProjectDialogState = {
  open: false,
  id: undefined,
  name: '',
  isSubmitting: false
};

const defaultClassificationDialogState: ClassificationDialogState = {
  open: false,
  id: undefined,
  name: '',
  isSubmitting: false
};

const defaultLanguageDialogState: LanguageDialogState = {
  open: false,
  id: undefined,
  code: '',
  isSubmitting: false
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

const toDateInputValue = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '');

const toDocumentUpdateInput = (
  document: Pick<
    DocumentListItem,
    | 'id'
    | 'title'
    | 'author'
    | 'languageId'
    | 'confidentialityClassId'
    | 'projectId'
    | 'company'
    | 'department'
    | 'revisionIntervalMonths'
  >
): UpdateDocumentInput => ({
  documentRecordId: document.id,
  title: document.title,
  author: document.author,
  languageId: document.languageId,
  confidentialityClassId: document.confidentialityClassId,
  projectId: document.projectId,
  company: document.company,
  department: document.department,
  revisionIntervalMonths: document.revisionIntervalMonths
});

const getEffectiveDocumentTableVisibleColumns = (
  appVisibleColumns: DocumentTableColumn[],
  workspaceAvailableColumns: DocumentTableColumn[]
): DocumentTableColumn[] => {
  const filtered = appVisibleColumns.filter((column) => workspaceAvailableColumns.includes(column));
  if (filtered.length > 0) {
    return filtered;
  }

  const defaultFiltered = DEFAULT_DOCUMENT_TABLE_VISIBLE_COLUMNS.filter((column) =>
    workspaceAvailableColumns.includes(column)
  );
  return defaultFiltered.length > 0 ? defaultFiltered : [...workspaceAvailableColumns];
};

const stopRowAction = (event: React.MouseEvent) => event.stopPropagation();

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
    updateWorkspaceSettings,
    setActiveWorkspace,
    setWorkspaceView,
    setSelectedDocument,
    updateApplicationSettings,
    setNotification
  } = useAppStore();

  const [workspaceDialog, setWorkspaceDialog] = useState(defaultWorkspaceDialogState);
  const [workspaceSettingsDialog, setWorkspaceSettingsDialog] = useState(
    defaultWorkspaceSettingsDialogState
  );
  const [applicationSettingsDialog, setApplicationSettingsDialog] = useState(
    defaultApplicationSettingsDialogState
  );
  const [tableColumnsDialog, setTableColumnsDialog] = useState(defaultTableColumnsDialogState);
  const [documentDialog, setDocumentDialog] = useState(defaultDocumentDialogState);
  const [versionDialog, setVersionDialog] = useState(defaultVersionDialogState);
  const [filesDialog, setFilesDialog] = useState(defaultFilesDialogState);
  const [latestVersionDialog, setLatestVersionDialog] = useState(defaultLatestVersionDialogState);
  const [typeDialog, setTypeDialog] = useState(defaultTypeDialogState);
  const [projectDialog, setProjectDialog] = useState(defaultProjectDialogState);
  const [classificationDialog, setClassificationDialog] = useState(defaultClassificationDialogState);
  const [languageDialog, setLanguageDialog] = useState(defaultLanguageDialogState);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const workspaceTabs = Object.values(openWorkspaces);
  const activeWorkspace = activeWorkspacePath ? openWorkspaces[activeWorkspacePath] : undefined;
  const activeWorkspaceAvailableColumns =
    activeWorkspace?.settings.visibleDocumentColumns ?? DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns;
  const workspaceSupportsProjects = activeWorkspaceAvailableColumns.includes('project');
  const workspaceSupportsConfidentialityClasses =
    activeWorkspaceAvailableColumns.includes('confidentialityClass');
  const workspaceSupportsLanguages = activeWorkspaceAvailableColumns.includes('language');
  const activeFilesVersion =
    selectedDocumentDetail?.versions.find((version) => version.id === filesDialog.versionId) ?? null;
  const previewThemeMode = applicationSettingsDialog.open
    ? applicationSettingsDialog.settings.themeMode
    : applicationSettings.themeMode;
  const isMacOs = useMemo(
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent),
    []
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

        const message =
          error instanceof Error ? error.message : 'DocTrack failed to initialize the desktop shell.';
        setBootError(message);
        setNotification({
          tone: 'error',
          message
        });
      }
    };

    void initializeShell();

    return () => {
      isMounted = false;
    };
  }, [bootstrap, setNotification]);

  useEffect(() => {
    applyTheme(previewThemeMode);
  }, [previewThemeMode]);

  useEffect(() => {
    if (previewThemeMode !== 'system') {
      return undefined;
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    query.addEventListener('change', listener);

    return () => {
      query.removeEventListener('change', listener);
    };
  }, [previewThemeMode]);

  useEffect(() => {
    if (
      !notification ||
      notification.tone !== 'success' ||
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
  }, [applicationSettings.autoDismissSuccessNotifications, notification, setNotification]);

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
          activeWorkspace.selectedDocumentRecordId
        );
        setSelectedDocumentDetail(detail);
      } catch (error) {
        setNotification({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Unable to load the selected document.'
        });
      } finally {
        setIsDetailLoading(false);
      }
    };

    void loadSelectedDocumentDetail();
  }, [activeWorkspace?.selectedDocumentRecordId, activeWorkspacePath, setNotification]);

  const loadDocumentDetail = async (rootPath: string, documentRecordId: number): Promise<DocumentDetail> => {
    const detail = await window.docTrack.documents.detail(rootPath, documentRecordId);
    setSelectedDocument(rootPath, documentRecordId);
    setSelectedDocumentDetail(detail);
    return detail;
  };

  const refreshSelectedDocument = async (rootPath: string, documentRecordId: number): Promise<DocumentDetail> => {
    const [detail] = await Promise.all([loadDocumentDetail(rootPath, documentRecordId), refreshWorkspace(rootPath)]);
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
      !selectedDocumentDetail.versions.some((version) => version.id === filesDialog.versionId)
    ) {
      setFilesDialog(defaultFilesDialogState);
    }
  }, [activeWorkspace?.selectedDocumentRecordId, activeWorkspacePath, filesDialog.versionId, selectedDocumentDetail]);

  const openWorkspacePicker = async () => {
    const rootPath = await window.docTrack.dialogs.pickWorkspaceOpenPath();
    if (!rootPath) {
      return;
    }

    try {
      await openWorkspace(rootPath);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to open workspace.'
      });
    }
  };

  const openCreateWorkspaceDialog = () => {
    setWorkspaceDialog(buildWorkspaceDialogState(applicationSettings));
  };

  const openCreateDocumentDialog = () => {
    if (!activeWorkspace) {
      return;
    }

    setDocumentDialog(buildCreateDocumentDialogState(applicationSettings, activeWorkspace.settings));
  };

  const openEditDocumentDialog = async (documentRecordId?: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    const detail =
      documentRecordId && selectedDocumentDetail?.id !== documentRecordId
        ? await loadDocumentDetail(activeWorkspacePath, documentRecordId)
        : selectedDocumentDetail;

    if (!detail) {
      return;
    }

    setDocumentDialog(buildEditDocumentDialogState(detail));
  };

  const openApplicationSettingsDialog = () => {
    setApplicationSettingsDialog(buildApplicationSettingsDialogState(applicationSettings));
  };

  const openWorkspaceSettingsDialog = () => {
    if (!activeWorkspace) {
      return;
    }

    setWorkspaceSettingsDialog({
      open: true,
      rootPath: activeWorkspace.workspace.rootPath,
      workspaceName: activeWorkspace.workspace.name,
      settings: { ...activeWorkspace.settings },
      isSubmitting: false
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) {
        return;
      }

      if (!event.shiftKey && event.key === ',') {
        event.preventDefault();
        openApplicationSettingsDialog();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCreateWorkspaceDialog();
        return;
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openWorkspacePicker();
        return;
      }

      if (event.key.toLowerCase() === 'n' && activeWorkspace) {
        event.preventDefault();
        openCreateDocumentDialog();
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        const searchInput = document.querySelector<HTMLInputElement>('[data-doc-search="true"]');
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeWorkspace, applicationSettings, openWorkspacePicker]);

  const handleCreateWorkspace = async () => {
    try {
      setWorkspaceDialog((state) => ({ ...state, isSubmitting: true }));
      await createWorkspace({
        name: workspaceDialog.name,
        parentPath: workspaceDialog.parentPath,
        settings: workspaceDialog.settings,
        includeExampleData: workspaceDialog.includeExampleData
      });
      setWorkspaceDialog(defaultWorkspaceDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to create workspace.'
      });
      setWorkspaceDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveWorkspaceSettings = async () => {
    if (!workspaceSettingsDialog.rootPath) {
      return;
    }

    try {
      setWorkspaceSettingsDialog((state) => ({ ...state, isSubmitting: true }));
      await updateWorkspaceSettings(workspaceSettingsDialog.rootPath, workspaceSettingsDialog.settings);
      setWorkspaceSettingsDialog(defaultWorkspaceSettingsDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save workspace settings.'
      });
      setWorkspaceSettingsDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveApplicationSettings = async () => {
    try {
      setApplicationSettingsDialog((state) => ({ ...state, isSubmitting: true }));
      await updateApplicationSettings(applicationSettingsDialog.settings);
      setApplicationSettingsDialog(defaultApplicationSettingsDialogState);
      setNotification({
        tone: 'success',
        message: 'Application settings saved.'
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save application settings.'
      });
      setApplicationSettingsDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveTableColumns = async () => {
    const workspaceAvailableColumns =
      activeWorkspace?.settings.visibleDocumentColumns ?? DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns;

    try {
      setTableColumnsDialog((state) => ({ ...state, isSubmitting: true }));
      const nextVisibleColumns = tableColumnsDialog.visibleColumns.filter((column) =>
        workspaceAvailableColumns.includes(column)
      );

      if (nextVisibleColumns.length === 0) {
        setNotification({
          tone: 'error',
          message: 'Select at least one table column.'
        });
        setTableColumnsDialog((state) => ({ ...state, isSubmitting: false }));
        return;
      }

      await updateApplicationSettings({
        ...applicationSettings,
        documentTableVisibleColumns: nextVisibleColumns
      });
      setTableColumnsDialog(defaultTableColumnsDialogState);
      setNotification({
        tone: 'success',
        message: 'Table view settings saved.'
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save table view settings.'
      });
      setTableColumnsDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveDocument = async () => {
    if (!activeWorkspacePath || !activeWorkspace) {
      return;
    }

    try {
      setDocumentDialog((state) => ({ ...state, isSubmitting: true }));
      const revisionIntervalMonths = parseOptionalPositiveInteger(documentDialog.revisionIntervalMonths);
      const availableColumns = activeWorkspace.settings.visibleDocumentColumns;
      const documentInput = {
        title: documentDialog.title,
        author: availableColumns.includes('author') ? documentDialog.author : '',
        languageId: availableColumns.includes('language')
          ? parseOptionalSelectNumber(documentDialog.languageId)
          : null,
        confidentialityClassId: availableColumns.includes('confidentialityClass')
          ? parseOptionalSelectNumber(documentDialog.confidentialityClassId)
          : null,
        projectId: availableColumns.includes('project')
          ? parseOptionalSelectNumber(documentDialog.projectId)
          : null,
        company: availableColumns.includes('company') ? documentDialog.company : '',
        department: availableColumns.includes('department') ? documentDialog.department : '',
        revisionIntervalMonths: availableColumns.includes('revisionIntervalMonths')
          ? revisionIntervalMonths
          : null
      };

      const detail =
        documentDialog.mode === 'create'
          ? await window.docTrack.documents.create(activeWorkspacePath, {
              ...documentInput,
              documentTypeId: Number(documentDialog.documentTypeId),
              versionScheme: documentDialog.versionScheme
            } satisfies CreateDocumentInput)
          : await window.docTrack.documents.update(activeWorkspacePath, {
              documentRecordId: documentDialog.documentRecordId!,
              ...documentInput
            } satisfies UpdateDocumentInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setDocumentDialog(defaultDocumentDialogState);
      setNotification({
        tone: 'success',
        message:
          documentDialog.mode === 'create'
            ? `Created ${detail.documentId}.`
            : `Updated ${detail.documentId}.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : documentDialog.mode === 'create'
              ? 'Unable to create document.'
              : 'Unable to update document.'
      });
      setDocumentDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleCreateVersion = async () => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setVersionDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.createVersion(activeWorkspacePath, {
        documentRecordId: selectedDocumentDetail.id,
        revisionDescription: versionDialog.revisionDescription,
        bumpType: versionDialog.bumpType
      } satisfies CreateVersionInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setVersionDialog(defaultVersionDialogState);
      setNotification({
        tone: 'success',
        message: `Version ${detail.versions[0]?.versionLabel ?? ''} created for ${detail.documentId}.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to create document version.'
      });
      setVersionDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveLatestVersion = async () => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setLatestVersionDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.updateLatestVersion(activeWorkspacePath, {
        documentRecordId: selectedDocumentDetail.id,
        status: latestVersionDialog.status,
        releasedDate: latestVersionDialog.releasedDate || null,
        approvedBy: latestVersionDialog.approvedBy,
        revisionDescription: latestVersionDialog.revisionDescription
      } satisfies UpdateLatestVersionInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setLatestVersionDialog(defaultLatestVersionDialogState);
      setNotification({
        tone: 'success',
        message: `Updated latest version for ${detail.documentId}.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update the latest version.'
      });
      setLatestVersionDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleSaveDocumentType = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setTypeDialog((state) => ({ ...state, isSubmitting: true }));

      if (typeDialog.id) {
        await window.docTrack.documentTypes.update(activeWorkspacePath, typeDialog.id, {
          name: typeDialog.name,
          numberPrefix: typeDialog.numberPrefix
        });
      } else {
        await window.docTrack.documentTypes.create(activeWorkspacePath, {
          name: typeDialog.name,
          numberPrefix: typeDialog.numberPrefix
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setTypeDialog(defaultTypeDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save document type.'
      });
      setTypeDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteDocumentType = async (type: DocumentType) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (
      applicationSettings.confirmDestructiveActions &&
      !window.confirm(`Delete document type "${type.name}"?`)
    ) {
      return;
    }

    try {
      await window.docTrack.documentTypes.delete(activeWorkspacePath, type.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: 'success',
        message: `"${type.name}" removed from this workspace.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete document type.'
      });
    }
  };

  const handleSaveProject = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setProjectDialog((state) => ({ ...state, isSubmitting: true }));

      if (projectDialog.id) {
        await window.docTrack.projects.update(activeWorkspacePath, projectDialog.id, {
          name: projectDialog.name
        });
      } else {
        await window.docTrack.projects.create(activeWorkspacePath, {
          name: projectDialog.name
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setProjectDialog(defaultProjectDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save project.'
      });
      setProjectDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (
      applicationSettings.confirmDestructiveActions &&
      !window.confirm(`Delete project "${project.name}"?`)
    ) {
      return;
    }

    try {
      await window.docTrack.projects.delete(activeWorkspacePath, project.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: 'success',
        message: `"${project.name}" removed from this workspace.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete project.'
      });
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
            name: classificationDialog.name
          }
        );
      } else {
        await window.docTrack.confidentialityClasses.create(activeWorkspacePath, {
          name: classificationDialog.name
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setClassificationDialog(defaultClassificationDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save confidentiality class.'
      });
      setClassificationDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteConfidentialityClass = async (item: ConfidentialityClass) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (
      applicationSettings.confirmDestructiveActions &&
      !window.confirm(`Delete confidentiality class "${item.name}"?`)
    ) {
      return;
    }

    try {
      await window.docTrack.confidentialityClasses.delete(activeWorkspacePath, item.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: 'success',
        message: `"${item.name}" removed from this workspace.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete confidentiality class.'
      });
    }
  };

  const handleSaveLanguage = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setLanguageDialog((state) => ({ ...state, isSubmitting: true }));

      if (languageDialog.id) {
        await window.docTrack.languages.update(activeWorkspacePath, languageDialog.id, {
          code: languageDialog.code
        });
      } else {
        await window.docTrack.languages.create(activeWorkspacePath, {
          code: languageDialog.code
        });
      }

      await refreshWorkspace(activeWorkspacePath);
      setLanguageDialog(defaultLanguageDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save language.'
      });
      setLanguageDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteLanguage = async (item: WorkspaceLanguage) => {
    if (!activeWorkspacePath) {
      return;
    }

    if (
      applicationSettings.confirmDestructiveActions &&
      !window.confirm(`Delete language "${item.code}"?`)
    ) {
      return;
    }

    try {
      await window.docTrack.languages.delete(activeWorkspacePath, item.id);
      await refreshWorkspace(activeWorkspacePath);
      setNotification({
        tone: 'success',
        message: `"${item.code}" removed from this workspace.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete language.'
      });
    }
  };

  const handleAssignProjectToDocument = async (document: DocumentListItem, nextProjectId: string) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail = await window.docTrack.documents.update(activeWorkspacePath, {
        ...toDocumentUpdateInput(document),
        projectId: parseOptionalSelectNumber(nextProjectId)
      });
      await refreshWorkspace(activeWorkspacePath);
      if (selectedDocumentDetail?.id === detail.id) {
        setSelectedDocumentDetail(detail);
      }
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to assign the document to a project.'
      });
    }
  };

  const handleShowFilesForDocument = async (documentRecordId: number) => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      const detail =
        selectedDocumentDetail?.id === documentRecordId
          ? selectedDocumentDetail
          : await loadDocumentDetail(activeWorkspacePath, documentRecordId);
      const latestVersion = detail?.versions[0];

      if (!latestVersion) {
        setNotification({
          tone: 'error',
          message: 'Create a version before showing version files.'
        });
        return;
      }

      setFilesDialog({
        open: true,
        versionId: latestVersion.id,
        addRole: 'working',
        isSubmitting: false
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to load version files.'
      });
    }
  };

  const handleRefreshVersionFiles = async (documentVersionId: number) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.syncVersionFiles(activeWorkspacePath, documentVersionId);
      await refreshSelectedDocument(activeWorkspacePath, selectedDocumentDetail.id);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to refresh version files.'
      });
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
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

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.addVersionFiles(activeWorkspacePath, {
        documentVersionId,
        role: filesDialog.addRole,
        sourceFilePaths
      });
      await refreshSelectedDocument(activeWorkspacePath, selectedDocumentDetail.id);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to add files to this version.'
      });
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleRenameVersionFile = async (file: DocumentVersionFile) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    const nextFileName = window.prompt('Rename file', file.fileName)?.trim();
    if (!nextFileName || nextFileName === file.fileName) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.renameVersionFile(activeWorkspacePath, {
        fileId: file.id,
        nextFileName
      });
      await refreshSelectedDocument(activeWorkspacePath, selectedDocumentDetail.id);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to rename the selected file.'
      });
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleDeleteVersionFile = async (file: DocumentVersionFile) => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    if (
      applicationSettings.confirmDestructiveActions &&
      !window.confirm(`Delete "${file.fileName}"?`)
    ) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.deleteVersionFile(activeWorkspacePath, {
        fileId: file.id
      });
      await refreshSelectedDocument(activeWorkspacePath, selectedDocumentDetail.id);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to delete the selected file.'
      });
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleChangeVersionFileRole = async (
    file: DocumentVersionFile,
    role: DocumentVersionFileRole
  ) => {
    if (!activeWorkspacePath || !selectedDocumentDetail || role === file.role) {
      return;
    }

    try {
      setFilesDialog((state) => ({ ...state, isSubmitting: true }));
      await window.docTrack.documents.changeVersionFileRole(activeWorkspacePath, {
        fileId: file.id,
        role
      });
      await refreshSelectedDocument(activeWorkspacePath, selectedDocumentDetail.id);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to change the selected file role.'
      });
    } finally {
      setFilesDialog((state) => ({ ...state, isSubmitting: false }));
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
            setNotification({
              tone: 'error',
              message: error.message
            });
          });
        }}
      />
    );
  } else if (
    activeWorkspace.selectedView === 'documents' ||
    (activeWorkspace.selectedView === 'projects' && !workspaceSupportsProjects) ||
    (activeWorkspace.selectedView === 'classifications' && !workspaceSupportsConfidentialityClasses) ||
    (activeWorkspace.selectedView === 'languages' && !workspaceSupportsLanguages)
  ) {
    activeWorkspaceContent = (
      <DocumentsView
        workspace={activeWorkspace}
        documentTableDensity={applicationSettings.documentTableDensity}
        visibleTableColumns={getEffectiveDocumentTableVisibleColumns(
          applicationSettings.documentTableVisibleColumns,
          activeWorkspace.settings.visibleDocumentColumns
        )}
        selectedDocumentDetail={selectedDocumentDetail}
        isDetailLoading={isDetailLoading}
        onSelectDocument={(documentRecordId) =>
          setSelectedDocument(activeWorkspace.workspace.rootPath, documentRecordId)
        }
        onShowFiles={handleShowFilesForDocument}
        onRequestNewDocument={openCreateDocumentDialog}
        onOpenTableSettings={() =>
          setTableColumnsDialog({
            open: true,
            visibleColumns: getEffectiveDocumentTableVisibleColumns(
              applicationSettings.documentTableVisibleColumns,
              activeWorkspace.settings.visibleDocumentColumns
            ),
            isSubmitting: false
          })
        }
        onRequestEditDocument={(documentRecordId) => {
          void openEditDocumentDialog(documentRecordId).catch((error: Error) => {
            setNotification({
              tone: 'error',
              message: error.message
            });
          });
        }}
        onRequestNewVersion={() => {
          if (selectedDocumentDetail) {
            setVersionDialog((state) => ({
              ...state,
              open: true
            }));
          }
        }}
        onRequestLatestVersionEdit={(documentRecordId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void (async () => {
            const detail =
              documentRecordId && selectedDocumentDetail?.id !== documentRecordId
                ? await loadDocumentDetail(activeWorkspacePath, documentRecordId)
                : selectedDocumentDetail;

            const latestVersion = detail?.versions[0];
            if (!latestVersion) {
              return;
            }

            setLatestVersionDialog({
              open: true,
              status: latestVersion.status,
              releasedDate: toDateInputValue(latestVersion.releasedDate),
              approvedBy: latestVersion.approvedBy,
              revisionDescription: latestVersion.revisionDescription,
              isSubmitting: false
            });
          })().catch((error: Error) => {
            setNotification({
              tone: 'error',
              message: error.message
            });
          });
        }}
        onShowDocumentFolder={() => {
          if (!activeWorkspacePath || !selectedDocumentDetail) {
            return;
          }

          void window.docTrack.documents
            .openDocumentFolder(activeWorkspacePath, selectedDocumentDetail.id)
            .catch((error: Error) => {
              setNotification({
                tone: 'error',
                message: error.message
              });
            });
        }}
        onShowVersionFiles={(documentVersionId) =>
          setFilesDialog({
            open: true,
            versionId: documentVersionId,
            addRole: 'working',
            isSubmitting: false
          })
        }
      />
    );
  } else if (activeWorkspace.selectedView === 'documentTypes') {
    activeWorkspaceContent = (
      <DocumentTypesView
        workspace={activeWorkspace}
        onCreateType={() =>
          setTypeDialog({
            ...defaultTypeDialogState,
            open: true
          })
        }
        onEditType={(type) =>
          setTypeDialog({
            open: true,
            id: type.id,
            name: type.name,
            numberPrefix: type.numberPrefix,
            isSubmitting: false
          })
        }
        onDeleteType={handleDeleteDocumentType}
      />
    );
  } else if (activeWorkspace.selectedView === 'projects') {
    activeWorkspaceContent = (
      <ProjectsView
        workspace={activeWorkspace}
        onCreateProject={() => setProjectDialog({ ...defaultProjectDialogState, open: true })}
        onEditProject={(project) =>
          setProjectDialog({
            open: true,
            id: project.id,
            name: project.name,
            isSubmitting: false
          })
        }
        onDeleteProject={handleDeleteProject}
        onAssignProject={handleAssignProjectToDocument}
      />
    );
  } else if (activeWorkspace.selectedView === 'classifications') {
    activeWorkspaceContent = (
      <ClassificationsView
        workspace={activeWorkspace}
        onCreateConfidentialityClass={() =>
          setClassificationDialog({
            ...defaultClassificationDialogState,
            open: true
          })
        }
        onEditConfidentialityClass={(item) =>
          setClassificationDialog({
            open: true,
            id: item.id,
            name: item.name,
            isSubmitting: false
          })
        }
        onDeleteConfidentialityClass={handleDeleteConfidentialityClass}
      />
    );
  } else if (activeWorkspace.selectedView === 'languages') {
    activeWorkspaceContent = (
      <LanguagesView
        workspace={activeWorkspace}
        onCreateLanguage={() => setLanguageDialog({ ...defaultLanguageDialogState, open: true })}
        onEditLanguage={(item) =>
          setLanguageDialog({
            open: true,
            id: item.id,
            code: item.code,
            isSubmitting: false
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
            <div className="mt-2 text-sm text-muted-foreground">{bootError}</div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  setBootError(null);
                  void bootstrap().catch((error) => {
                    const message =
                      error instanceof Error
                        ? error.message
                        : 'DocTrack failed to initialize the desktop shell.';
                    setBootError(message);
                    setNotification({
                      tone: 'error',
                      message
                    });
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
    <div className={cn('app-surface flex h-full flex-col', isMacOs && 'platform-macos')}>
      <header className="app-header window-drag-region border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-md">
        <div className="app-header-row flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-workspace text-workspace-contrast shadow-sm">
              <FileStack className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">DocTrack</div>
              <div className="text-[13px] text-muted-foreground">
                Offline document workspaces with version control
              </div>
            </div>
          </div>

	          <div className="window-no-drag flex flex-wrap items-center gap-1.5">
	            <Button variant="outline" onClick={openApplicationSettingsDialog}>
	              <SunMoon className="h-4 w-4" />
	              Application Settings
            </Button>
            <Button variant="outline" onClick={openCreateWorkspaceDialog}>
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
            <Button variant="secondary" onClick={() => void openWorkspacePicker()}>
              <FolderOpen className="h-4 w-4" />
              Open Workspace
            </Button>
	            <Button
	              onClick={openCreateDocumentDialog}
	              disabled={!activeWorkspace}
            >
              <FilePlus2 className="h-4 w-4" />
              New Document
            </Button>
          </div>
        </div>

        <div className="window-no-drag mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {workspaceTabs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-[13px] text-muted-foreground">
              No workspace open yet. Create one or open an existing workspace folder.
            </div>
          ) : (
            workspaceTabs.map((workspaceTab) => (
              <div
                key={workspaceTab.workspace.rootPath}
                role="button"
                tabIndex={0}
                className={cn(
                  'group flex min-w-[190px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                  activeWorkspacePath === workspaceTab.workspace.rootPath
                    ? 'border-border bg-secondary text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                )}
                onClick={() => {
                  startTransition(() => {
                    setActiveWorkspace(workspaceTab.workspace.rootPath);
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startTransition(() => {
                      setActiveWorkspace(workspaceTab.workspace.rootPath);
                    });
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{workspaceTab.workspace.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {workspaceTab.documents.length} docs
                  </div>
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
            ))
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
              label="Documents"
              active={activeWorkspace?.selectedView === 'documents'}
              disabled={!activeWorkspace}
              onClick={() => activeWorkspacePath && setWorkspaceView(activeWorkspacePath, 'documents')}
            />
            <SidebarButton
              icon={LayoutPanelLeft}
              label="Document Types"
              active={activeWorkspace?.selectedView === 'documentTypes'}
              disabled={!activeWorkspace}
              onClick={() => activeWorkspacePath && setWorkspaceView(activeWorkspacePath, 'documentTypes')}
            />
	            {workspaceSupportsProjects ? (
	              <SidebarButton
	                icon={FolderOpen}
	                label="Projects"
	                active={activeWorkspace?.selectedView === 'projects'}
	                disabled={!activeWorkspace}
	                onClick={() => activeWorkspacePath && setWorkspaceView(activeWorkspacePath, 'projects')}
	              />
	            ) : null}
	            {workspaceSupportsConfidentialityClasses ? (
	              <SidebarButton
	                icon={Settings2}
	                label="Classifications"
	                active={activeWorkspace?.selectedView === 'classifications'}
	                disabled={!activeWorkspace}
	                onClick={() => activeWorkspacePath && setWorkspaceView(activeWorkspacePath, 'classifications')}
	              />
	            ) : null}
	            {workspaceSupportsLanguages ? (
	              <SidebarButton
	                icon={Pencil}
	                label="Languages"
	                active={activeWorkspace?.selectedView === 'languages'}
	                disabled={!activeWorkspace}
	                onClick={() => activeWorkspacePath && setWorkspaceView(activeWorkspacePath, 'languages')}
	              />
	            ) : null}
	          </div>

	          <div className="mt-3 rounded-xl border border-border bg-background p-2.5 shadow-sm">
	            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
	              Workspace Control
	            </div>
	            <SidebarButton
	              icon={Settings2}
	              label="Workspace Settings"
	              active={workspaceSettingsDialog.open}
	              disabled={!activeWorkspace}
	              onClick={openWorkspaceSettingsDialog}
	            />
	          </div>

          <div className="mt-3 rounded-xl border border-border bg-workspace px-3.5 py-4 text-workspace-contrast shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Sparkles className="h-4 w-4 text-workspace-accent" />
              Keyboard Shortcuts
            </div>
            <div className="mt-3 space-y-2.5 text-[13px] text-slate-200/80">
              <Shortcut hint="Ctrl/Cmd + ," label="Application settings" />
              <Shortcut hint="Ctrl/Cmd + Shift + N" label="New workspace" />
              <Shortcut hint="Ctrl/Cmd + O" label="Open workspace" />
              <Shortcut hint="Ctrl/Cmd + N" label="New document" />
              <Shortcut hint="Ctrl/Cmd + F" label="Focus search" />
            </div>
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
      />

      <TableColumnsDialog
        state={tableColumnsDialog}
        availableColumns={activeWorkspace?.settings.visibleDocumentColumns ?? []}
        onStateChange={setTableColumnsDialog}
        onSubmit={handleSaveTableColumns}
      />

      <DocumentDialog
        open={documentDialog.open}
        onOpenChange={(open) =>
          setDocumentDialog(open ? { ...documentDialog, open } : defaultDocumentDialogState)
        }
        state={documentDialog}
        onStateChange={setDocumentDialog}
        onSubmit={handleSaveDocument}
        documentTypes={activeWorkspace?.documentTypes ?? []}
        projects={activeWorkspace?.projects ?? []}
        confidentialityClasses={activeWorkspace?.confidentialityClasses ?? []}
        languages={activeWorkspace?.languages ?? []}
        availableColumns={activeWorkspaceAvailableColumns}
      />

      <VersionDialog
        open={versionDialog.open}
        onOpenChange={(open) =>
          setVersionDialog(open ? { ...versionDialog, open } : defaultVersionDialogState)
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
            open ? { ...latestVersionDialog, open } : defaultLatestVersionDialogState
          )
        }
        state={latestVersionDialog}
        onStateChange={setLatestVersionDialog}
        onSubmit={handleSaveLatestVersion}
        documentDetail={selectedDocumentDetail}
      />

      <DocumentTypeDialog
        open={typeDialog.open}
        onOpenChange={(open) => setTypeDialog(open ? { ...typeDialog, open } : defaultTypeDialogState)}
        state={typeDialog}
        onStateChange={setTypeDialog}
        onSubmit={handleSaveDocumentType}
      />

      <ProjectDialog
        open={projectDialog.open}
        onOpenChange={(open) => setProjectDialog(open ? { ...projectDialog, open } : defaultProjectDialogState)}
        state={projectDialog}
        onStateChange={setProjectDialog}
        onSubmit={handleSaveProject}
      />

      <ConfidentialityClassDialog
        open={classificationDialog.open}
        onOpenChange={(open) =>
          setClassificationDialog(open ? { ...classificationDialog, open } : defaultClassificationDialogState)
        }
        state={classificationDialog}
        onStateChange={setClassificationDialog}
        onSubmit={handleSaveConfidentialityClass}
      />

      <LanguageDialog
        open={languageDialog.open}
        onOpenChange={(open) =>
          setLanguageDialog(open ? { ...languageDialog, open } : defaultLanguageDialogState)
        }
        state={languageDialog}
        onStateChange={setLanguageDialog}
        onSubmit={handleSaveLanguage}
      />

      <VersionFilesDialog
        open={filesDialog.open}
        onOpenChange={(open) => setFilesDialog(open ? { ...filesDialog, open } : defaultFilesDialogState)}
        state={filesDialog}
        onStateChange={setFilesDialog}
        version={activeFilesVersion}
        canEdit={Boolean(
          selectedDocumentDetail &&
            activeFilesVersion &&
            selectedDocumentDetail.versions[0]?.id === activeFilesVersion.id
        )}
        onRefresh={handleRefreshVersionFiles}
        onAddFiles={handleAddFilesToVersion}
        onOpenFile={(fileId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents.openVersionFile(activeWorkspacePath, fileId).catch((error: Error) => {
            setNotification({
              tone: 'error',
              message: error.message
            });
          });
        }}
        onOpenFolder={(documentVersionId) => {
          if (!activeWorkspacePath) {
            return;
          }

          void window.docTrack.documents
            .openVersionFolder(activeWorkspacePath, documentVersionId)
            .catch((error: Error) => {
              setNotification({
                tone: 'error',
                message: error.message
              });
            });
        }}
        onRenameFile={handleRenameVersionFile}
        onDeleteFile={handleDeleteVersionFile}
        onChangeRole={handleChangeVersionFileRole}
      />
    </div>
  );
}

function ThemeToggle({
  themeMode,
  onChange
}: {
  themeMode: ThemeMode;
  onChange: (value: ThemeMode) => void;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-background p-0.5 shadow-sm">
      {THEME_MODE_OPTIONS.map((option) => {
        const Icon = THEME_MODE_ICONS[option.value];
        return (
          <button
            key={option.value}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition',
              themeMode === option.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ApplicationSettingsDialog({
  state,
  onStateChange,
  onSubmit
}: {
  state: ApplicationSettingsDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<ApplicationSettingsDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  const selectedLaunchBehavior =
    APPLICATION_LAUNCH_BEHAVIOR_OPTIONS.find(
      (option) => option.value === state.settings.launchBehavior
    ) ?? APPLICATION_LAUNCH_BEHAVIOR_OPTIONS[0];
  const selectedWorkspaceView =
    WORKSPACE_VIEW_OPTIONS.find((option) => option.value === state.settings.defaultWorkspaceView) ??
    WORKSPACE_VIEW_OPTIONS[0];
  const selectedDensity =
    DOCUMENT_TABLE_DENSITY_OPTIONS.find(
      (option) => option.value === state.settings.documentTableDensity
    ) ?? DOCUMENT_TABLE_DENSITY_OPTIONS[0];

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(open ? { ...state, open } : defaultApplicationSettingsDialogState)
      }
    >
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>
            Customize how DocTrack looks, launches, and behaves across every workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-4">
          <SettingsSection
            title="Appearance"
            description="Set the look and feel for the whole app."
          >
            <Field label="Theme">
              <ThemeToggle
                themeMode={state.settings.themeMode}
                onChange={(themeMode) =>
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      themeMode
                    }
                  }))
                }
              />
              <div className="text-xs text-muted-foreground">
                Theme changes preview immediately while this modal is open. Save to keep them.
              </div>
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Startup & Navigation"
            description="Choose where DocTrack starts and which workspace view opens first."
          >
            <Field label="Launch Behavior">
              <Select
                value={state.settings.launchBehavior}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      launchBehavior: event.target.value as ApplicationSettings['launchBehavior']
                    }
                  }))
                }
              >
                {APPLICATION_LAUNCH_BEHAVIOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">{selectedLaunchBehavior.description}</div>
            </Field>

            <Field label="Default Workspace View">
              <Select
                value={state.settings.defaultWorkspaceView}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      defaultWorkspaceView: event.target.value as ApplicationSettings['defaultWorkspaceView']
                    }
                  }))
                }
              >
                {WORKSPACE_VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">{selectedWorkspaceView.description}</div>
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
                onStateChange((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    defaultIncludeExampleData: checked
                  }
                }))
              }
            />

            <Field label="Default Document Author">
              <Input
                placeholder="Jordan Singh"
                value={state.settings.defaultDocumentAuthor}
                onChange={(event) =>
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      defaultDocumentAuthor: event.target.value
                    }
                  }))
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
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      defaultDocumentVersionScheme:
                        event.target.value as ApplicationSettings['defaultDocumentVersionScheme']
                    }
                  }))
                }
              >
                {Object.entries(DOCUMENT_VERSION_SCHEME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
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
                  onStateChange((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      documentTableDensity:
                        event.target.value as ApplicationSettings['documentTableDensity']
                    }
                  }))
                }
              >
                {DOCUMENT_TABLE_DENSITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="text-xs text-muted-foreground">{selectedDensity.description}</div>
            </Field>
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
                onStateChange((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    confirmDestructiveActions: checked
                  }
                }))
              }
            />

            <ToggleSetting
              title="Auto-dismiss success notifications"
              description="Success messages fade away automatically while error messages stay visible."
              checked={state.settings.autoDismissSuccessNotifications}
              onChange={(checked) =>
                onStateChange((current) => ({
                  ...current,
                  settings: {
                    ...current.settings,
                    autoDismissSuccessNotifications: checked
                  }
                }))
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
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SunMoon className="h-4 w-4" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="pb-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">{description}</div>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange
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
  onClose
}: {
  tone: NotificationTone;
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'mx-3 mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-[13px] shadow-sm',
        tone === 'success'
          ? 'border-[#CFE3D5] bg-[#F6FBF7] text-[#2F6B48] dark:border-[#35503F] dark:bg-[#1F2E25] dark:text-[#8FD9A8]'
          : 'border-[#F0D5D3] bg-[#FFF7F6] text-[#C4554D] dark:border-[#5A2D2F] dark:bg-[#3B1F21] dark:text-[#FFB7B2]'
      )}
    >
      <div>{message}</div>
      <button className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose}>
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
  onClick
}: {
  icon: typeof Table2;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
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
  onOpenRecent
}: {
  recentWorkspaces: Array<{ rootPath: string; name: string; lastOpenedDate: string }>;
  onCreateWorkspace: () => void;
  onOpenWorkspace: () => void;
  onOpenRecent: (rootPath: string) => void;
}) {
  return (
    <div className="grid h-full gap-3 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Badge variant="outline" className="mb-4 w-fit gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Workspace-first document operations
        </Badge>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
          Keep every document, version, and status inside a portable offline workspace.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Create a new workspace folder or reopen an existing one. Each workspace opens in its own
          tab, with document tables, version history, and type configuration ready to go.
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
              No recent workspaces yet. Your newly created workspaces will appear here.
            </div>
          ) : (
            recentWorkspaces.map((workspace) => (
              <button
                key={workspace.rootPath}
                className="w-full rounded-xl border border-border bg-background p-3 text-left transition hover:bg-accent"
                onClick={() => onOpenRecent(workspace.rootPath)}
              >
                <div className="truncate text-[13px] font-semibold">{workspace.name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{workspace.rootPath}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Last opened {formatDateTime(workspace.lastOpenedDate)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentsView({
  workspace,
  documentTableDensity,
  visibleTableColumns,
  selectedDocumentDetail,
  isDetailLoading,
  onSelectDocument,
  onShowFiles,
  onRequestNewDocument,
  onOpenTableSettings,
  onRequestEditDocument,
  onRequestNewVersion,
  onRequestLatestVersionEdit,
  onShowDocumentFolder,
  onShowVersionFiles
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
  documentTableDensity: DocumentTableDensity;
  visibleTableColumns: DocumentTableColumn[];
  selectedDocumentDetail: DocumentDetail | null;
  isDetailLoading: boolean;
  onSelectDocument: (documentRecordId: number) => void;
  onShowFiles: (documentRecordId: number) => void;
  onRequestNewDocument: () => void;
  onOpenTableSettings: () => void;
  onRequestEditDocument: (documentRecordId?: number) => void;
  onRequestNewVersion: () => void;
  onRequestLatestVersionEdit: (documentRecordId?: number) => void;
  onShowDocumentFolder: () => void;
  onShowVersionFiles: (documentVersionId: number) => void;
}) {
  const fallbackSortingColumn = visibleTableColumns.includes('modifiedDate')
    ? 'modifiedDate'
    : (visibleTableColumns[0] ?? 'documentId');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: fallbackSortingColumn,
      desc: fallbackSortingColumn === 'modifiedDate'
    }
  ]);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'All'>('All');
  const [projectFilter, setProjectFilter] = useState<string>('All');
  const availableColumns = workspace.settings.visibleDocumentColumns;
  const projectFeatureEnabled = availableColumns.includes('project');
  const deferredSearch = useDeferredValue(search);
  const headerCellClassName =
    documentTableDensity === 'compact'
      ? 'whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground'
      : 'whitespace-nowrap px-3 py-2.5 text-left font-medium text-muted-foreground';
  const bodyCellClassName =
    documentTableDensity === 'compact' ? 'px-3 py-2 align-middle' : 'px-3 py-2.5 align-middle';
  const emptyStateClassName =
    documentTableDensity === 'compact'
      ? 'px-6 py-10 text-center text-muted-foreground'
      : 'px-6 py-12 text-center text-muted-foreground';

  const statusOptions = useMemo(() => ['All', ...workspace.statuses] as const, [workspace.statuses]);
  const latestVersion = selectedDocumentDetail?.versions[0] ?? null;

  useEffect(() => {
    setSorting((current) => {
      if (current.every((entry) => visibleTableColumns.includes(entry.id as DocumentTableColumn))) {
        return current;
      }

      return [
        {
          id: fallbackSortingColumn,
          desc: fallbackSortingColumn === 'modifiedDate'
        }
      ];
    });
  }, [fallbackSortingColumn, visibleTableColumns]);

  const filteredDocuments = useMemo(
    () =>
      workspace.documents.filter((document) => {
        const matchesStatus = statusFilter === 'All' || document.status === statusFilter;
        const matchesProject =
          !projectFeatureEnabled ||
          projectFilter === 'All' ||
          String(document.projectId ?? '') === projectFilter;
        return matchesStatus && matchesProject;
      }),
    [projectFeatureEnabled, projectFilter, statusFilter, workspace.documents]
  );

  const columns = useMemo<Array<ColumnDef<DocumentListItem>>>(
    () => {
      const fixedColumns: Array<ColumnDef<DocumentListItem> & { id: DocumentTableColumn }> = [
        {
          id: 'documentId',
          accessorKey: 'documentId',
          header: columnHeader('Document ID'),
          cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentId}</span>
        },
        {
          id: 'title',
          accessorKey: 'title',
          header: columnHeader('Title'),
          cell: ({ row }) => <span className="font-medium">{row.original.title}</span>
        },
        {
          id: 'documentType',
          accessorFn: (row) => row.typeName,
          header: columnHeader('Document Type')
        },
        {
          id: 'version',
          accessorFn: (row) => row.latestVersionLabel ?? '',
          header: columnHeader('Version'),
          cell: ({ row }) => <span>{row.original.latestVersionLabel ?? '—'}</span>
        },
        {
          id: 'status',
          accessorFn: (row) => row.status ?? '',
          header: columnHeader('Status'),
          cell: ({ row }) => <DocumentProgressBadge status={row.original.status} />
        },
        {
          id: 'author',
          accessorKey: 'author',
          header: columnHeader('Author')
        },
        {
          id: 'language',
          accessorFn: (row) => row.languageCode ?? '',
          header: columnHeader('Language'),
          cell: ({ row }) => <span>{row.original.languageCode ?? '—'}</span>
        },
        {
          id: 'confidentialityClass',
          accessorFn: (row) => row.confidentialityClassName ?? '',
          header: columnHeader('Confidentiality Class'),
          cell: ({ row }) => <span>{row.original.confidentialityClassName ?? '—'}</span>
        },
        {
          id: 'project',
          accessorFn: (row) => row.projectName ?? '',
          header: columnHeader('Project'),
          cell: ({ row }) => <span>{row.original.projectName ?? '—'}</span>
        },
        {
          id: 'company',
          accessorKey: 'company',
          header: columnHeader('Company'),
          cell: ({ row }) => <span>{row.original.company || '—'}</span>
        },
        {
          id: 'department',
          accessorKey: 'department',
          header: columnHeader('Department'),
          cell: ({ row }) => <span>{row.original.department || '—'}</span>
        },
        {
          id: 'createdDate',
          accessorKey: 'createdDate',
          header: columnHeader('Created Date'),
          cell: ({ row }) => <span>{formatDateShort(row.original.createdDate)}</span>
        },
        {
          id: 'modifiedDate',
          accessorKey: 'modifiedDate',
          header: columnHeader('Modified Date'),
          cell: ({ row }) => <span>{formatDateShort(row.original.modifiedDate)}</span>
        },
        {
          id: 'releasedDate',
          accessorFn: (row) => row.releasedDate ?? '',
          header: columnHeader('Released Date'),
          cell: ({ row }) => <span>{row.original.releasedDate ? formatDateShort(row.original.releasedDate) : '—'}</span>
        },
        {
          id: 'approvedBy',
          accessorKey: 'approvedBy',
          header: columnHeader('Approved By'),
          cell: ({ row }) => <span>{row.original.approvedBy || '—'}</span>
        },
        {
          id: 'revisionIntervalMonths',
          accessorFn: (row) => row.revisionIntervalMonths ?? '',
          header: columnHeader('Revision Interval'),
          cell: ({ row }) => (
            <span>{row.original.revisionIntervalMonths ? `${row.original.revisionIntervalMonths} months` : '—'}</span>
          )
        },
        {
          id: 'revisionDescription',
          accessorKey: 'revisionDescription',
          header: columnHeader('Revision Description'),
          cell: ({ row }) => (
            <span className="inline-block max-w-[240px] truncate" title={row.original.revisionDescription}>
              {row.original.revisionDescription || '—'}
            </span>
          )
        }
      ];

      return [
        ...fixedColumns.filter((column) => visibleTableColumns.includes(column.id)),
        {
          id: 'actions',
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
                variant="ghost"
                size="sm"
                disabled={!row.original.latestVersionLabel}
                onClick={(event) => {
                  stopRowAction(event);
                  onRequestLatestVersionEdit(row.original.id);
                }}
              >
                <CircleDot className="h-4 w-4" />
                Latest Version
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!row.original.latestVersionLabel}
                onClick={(event) => {
                  stopRowAction(event);
                  void onShowFiles(row.original.id);
                }}
              >
                <FolderOpen className="h-4 w-4" />
                Show Files
              </Button>
            </div>
          )
        }
      ];
    },
    [
      onRequestEditDocument,
      onRequestLatestVersionEdit,
      onShowFiles,
      visibleTableColumns
    ]
  );

  const table = useReactTable({
    data: filteredDocuments,
    columns,
    state: {
      sorting,
      globalFilter: deferredSearch
    },
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => {
      const haystack = [
        row.original.documentId,
        row.original.title,
        row.original.typeName,
        availableColumns.includes('author') ? row.original.author : '',
        row.original.status ?? '',
        availableColumns.includes('language') ? row.original.languageCode ?? '' : '',
        availableColumns.includes('confidentialityClass')
          ? row.original.confidentialityClassName ?? ''
          : '',
        projectFeatureEnabled ? row.original.projectName ?? '' : '',
        availableColumns.includes('company') ? row.original.company : '',
        availableColumns.includes('department') ? row.original.department : '',
        availableColumns.includes('approvedBy') ? row.original.approvedBy : '',
        availableColumns.includes('revisionDescription') ? row.original.revisionDescription : ''
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(String(filterValue).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="grid h-full gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-1 pb-3">
          <div>
            <div className="text-lg font-semibold">{workspace.workspace.name}</div>
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

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-doc-search="true"
              className="pl-10"
              placeholder="Search by ID, title, type, author, project, status, or metadata"
              value={search}
              onChange={(event) => {
                startTransition(() => {
                  setSearch(event.target.value);
                });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={cn(
                  'rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition',
                  statusFilter === status
                    ? 'border-border bg-secondary text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
          {projectFeatureEnabled ? (
            <Field label="Project">
              <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
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
        </div>

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
                          header.id === 'actions' && 'text-right'
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
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
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'cursor-pointer border-b border-border/60 transition hover:bg-accent/70',
                        workspace.selectedDocumentRecordId === row.original.id && 'bg-accent/70'
                      )}
                      onClick={() => onSelectDocument(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            bodyCellClassName,
                            cell.column.id === 'actions' && 'min-w-[180px]'
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div>
            <div className="text-base font-semibold">Document Detail</div>
            <div className="text-[13px] text-muted-foreground">
              Inspect metadata, latest-version fields, and managed folders
            </div>
          </div>
          {selectedDocumentDetail ? <DocumentProgressBadge status={latestVersion?.status ?? null} /> : null}
        </div>

        {!selectedDocumentDetail && !isDetailLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background p-5 text-center text-[13px] text-muted-foreground">
            Select a document from the table to view versions, show files, or open its folder.
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
                  <div className="font-mono text-xs text-primary">{selectedDocumentDetail.documentId}</div>
                  <div className="mt-1.5 text-lg font-semibold">{selectedDocumentDetail.title}</div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {selectedDocumentDetail.typeName} • {selectedDocumentDetail.author}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRequestEditDocument(selectedDocumentDetail.id)}
                  >
                    <PencilLine className="h-4 w-4" />
                    Edit Document
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!latestVersion}
                    onClick={() => onRequestLatestVersionEdit(selectedDocumentDetail.id)}
                  >
                    <CircleDot className="h-4 w-4" />
                    Edit Latest Version
                  </Button>
                  <Button variant="outline" size="sm" onClick={onShowDocumentFolder}>
                    <FolderOpen className="h-4 w-4" />
                    Show Folder
                  </Button>
                  <Button size="sm" onClick={onRequestNewVersion}>
                    <PencilLine className="h-4 w-4" />
                    {selectedDocumentDetail.versions.length === 0 ? 'Create First Version' : 'New Version'}
                  </Button>
                </div>
              </div>
	              <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
	                <InfoCard label="Document Type" value={selectedDocumentDetail.typeName} />
	                {availableColumns.includes('author') ? (
	                  <InfoCard label="Author" value={selectedDocumentDetail.author} />
	                ) : null}
	                {availableColumns.includes('language') ? (
	                  <InfoCard label="Language" value={selectedDocumentDetail.languageCode ?? '—'} />
	                ) : null}
	                {availableColumns.includes('confidentialityClass') ? (
	                  <InfoCard
	                    label="Confidentiality"
	                    value={selectedDocumentDetail.confidentialityClassName ?? '—'}
	                  />
	                ) : null}
	                {projectFeatureEnabled ? (
	                  <InfoCard label="Project" value={selectedDocumentDetail.projectName ?? '—'} />
	                ) : null}
	                {availableColumns.includes('company') ? (
	                  <InfoCard label="Company" value={selectedDocumentDetail.company || '—'} />
	                ) : null}
	                {availableColumns.includes('department') ? (
	                  <InfoCard label="Department" value={selectedDocumentDetail.department || '—'} />
	                ) : null}
	                {availableColumns.includes('revisionIntervalMonths') ? (
	                  <InfoCard
	                    label="Revision Interval"
	                    value={
	                      selectedDocumentDetail.revisionIntervalMonths
	                        ? `${selectedDocumentDetail.revisionIntervalMonths} months`
	                        : '—'
	                    }
	                  />
	                ) : null}
	                {availableColumns.includes('createdDate') ? (
	                  <InfoCard label="Created" value={formatDateTime(selectedDocumentDetail.createdDate)} />
	                ) : null}
	                {availableColumns.includes('modifiedDate') ? (
	                  <InfoCard label="Modified" value={formatDateTime(selectedDocumentDetail.modifiedDate)} />
	                ) : null}
	                {availableColumns.includes('releasedDate') ? (
	                  <InfoCard
	                    label="Released"
	                    value={latestVersion?.releasedDate ? formatDateTime(latestVersion.releasedDate) : '—'}
	                  />
	                ) : null}
	                {availableColumns.includes('approvedBy') ? (
	                  <InfoCard label="Approved By" value={latestVersion?.approvedBy || '—'} />
	                ) : null}
	              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-background p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-semibold">Versions</div>
                <Badge variant="outline">{selectedDocumentDetail.versions.length} total</Badge>
              </div>
              {selectedDocumentDetail.versions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                  This document shell has no versions yet. Create the first version to start tracking files.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDocumentDetail.versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-xl border border-border bg-card p-3 transition hover:bg-accent/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold">Version {version.versionLabel}</div>
                            <StatusBadge status={version.status} />
                            <Badge variant="outline">{version.files.length} files</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Created {formatDateTime(version.createdDate)}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onShowVersionFiles(version.id)}>
                          <FolderOpen className="h-4 w-4" />
                          Show Files
                        </Button>
                      </div>
	                      {availableColumns.includes('releasedDate') ||
	                      availableColumns.includes('approvedBy') ||
	                      availableColumns.includes('revisionDescription') ? (
	                        <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] md:grid-cols-3">
	                          {availableColumns.includes('releasedDate') ? (
	                            <InfoCard
	                              label="Released"
	                              value={version.releasedDate ? formatDateTime(version.releasedDate) : '—'}
	                            />
	                          ) : null}
	                          {availableColumns.includes('approvedBy') ? (
	                            <InfoCard label="Approved By" value={version.approvedBy || '—'} />
	                          ) : null}
	                          {availableColumns.includes('revisionDescription') ? (
	                            <InfoCard
	                              label="Revision Description"
	                              value={version.revisionDescription || 'No revision description.'}
	                            />
	                          ) : null}
	                        </div>
	                      ) : null}
                      {version.unmanagedPaths.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                          Unmanaged paths: {version.unmanagedPaths.join(', ')}
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
    </div>
  );
}

function DocumentTypesView({
  workspace,
  onCreateType,
  onEditType,
  onDeleteType
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
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
                <div className="font-mono text-xs text-primary">{type.numberPrefix}</div>
                <div className="mt-1.5 text-base font-semibold">{type.name}</div>
              </div>
              <Badge variant="outline">2-digit prefix</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEditType(type)}>
                <PencilLine className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDeleteType(type)}>
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
  onAssignProject
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onAssignProject: (document: DocumentListItem, nextProjectId: string) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
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

        <div className="mt-4 grid gap-2.5">
          {workspace.projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No projects yet. Create a project, then assign existing documents from the panel on the right.
            </div>
          ) : (
            workspace.projects.map((project) => {
              const documentCount = workspace.documents.filter((document) => document.projectId === project.id).length;

              return (
                <div key={project.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{project.name}</div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {documentCount} document{documentCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <Badge variant="outline">Workspace project</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEditProject(project)}>
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteProject(project)}>
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
            Quickly move existing documents into a project or clear the assignment.
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {workspace.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-[13px] text-muted-foreground">
              No documents yet. Create a document first, then assign it to a project here.
            </div>
          ) : (
            workspace.documents.map((document) => (
              <div
                key={document.id}
                className="grid gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px]"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-primary">{document.documentId}</div>
                  <div className="mt-1 text-sm font-semibold">{document.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {document.typeName} • {document.projectName ?? 'No project'}
                  </div>
                </div>
                <Field label="Project">
                  <Select
                    value={document.projectId ? String(document.projectId) : ''}
                    onChange={(event) => void onAssignProject(document, event.target.value)}
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

function ClassificationsView({
  workspace,
  onCreateConfidentialityClass,
  onEditConfidentialityClass,
  onDeleteConfidentialityClass
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
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
            <div key={item.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="text-base font-semibold">{item.name}</div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEditConfidentialityClass(item)}>
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteConfidentialityClass(item)}>
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
  onDeleteLanguage
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
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
            Short workspace language codes shown in the documents table and document metadata forms.
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
            <div key={item.id} className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="font-mono text-base font-semibold">{item.code}</div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEditLanguage(item)}>
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteLanguage(item)}>
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

function WorkspaceDialog({
  state,
  onStateChange,
  onSubmit
}: {
  state: WorkspaceDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<WorkspaceDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={state.open} onOpenChange={(open) => onStateChange(open ? { ...state, open } : defaultWorkspaceDialogState)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            DocTrack will create a workspace folder with `Database/workspace.sqlite` and `Documents`.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Workspace Name">
            <Input
              placeholder="Quality Operations"
              value={state.name}
              onChange={(event) => onStateChange((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>

          <Field label="Workspace Location">
            <div className="flex gap-2">
              <Input
                placeholder="/Users/you/Documents"
                value={state.parentPath}
                onChange={(event) =>
                  onStateChange((current) => ({ ...current, parentPath: event.target.value }))
                }
              />
              <Button
                variant="outline"
                onClick={() => {
                  void window.docTrack.dialogs.pickWorkspaceCreatePath(state.name || 'DocTrack Workspace').then((parentPath) => {
                    if (parentPath) {
                      onStateChange((current) => ({ ...current, parentPath }));
                    }
                  });
                }}
              >
                Browse
              </Button>
            </div>
          </Field>

          <WorkspaceStorageSettingsFields
            workspaceName={state.name}
            settings={state.settings}
            onSettingsChange={(settings) =>
              onStateChange((current) => ({
                ...current,
                settings
              }))
            }
          />

          <label className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]">
            <input
              checked={state.includeExampleData}
              className="mt-1"
              type="checkbox"
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  includeExampleData: event.target.checked
                }))
              }
            />
            <span>
              <span className="block font-medium">Seed starter data</span>
              <span className="text-muted-foreground">
                Adds example document types and sample documents so the workspace opens with realistic data.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onStateChange(defaultWorkspaceDialogState)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
  onSubmit
}: {
  state: TableColumnsDialogState;
  availableColumns: DocumentTableColumn[];
  onStateChange: React.Dispatch<React.SetStateAction<TableColumnsDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  const columnOptions = DOCUMENT_TABLE_COLUMN_OPTIONS.filter((column) =>
    availableColumns.includes(column.value)
  );

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => onStateChange(open ? { ...state, open } : defaultTableColumnsDialogState)}
    >
      <DialogContent className="w-[min(88vw,380px)] max-h-[72vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>Table View Settings</DialogTitle>
          <DialogDescription>
            Choose which workspace columns this app should show in the documents table.
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
                          : current.visibleColumns.filter((item) => item !== column.value)
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
          <Button variant="outline" onClick={() => onStateChange(defaultTableColumnsDialogState)}>
            Cancel
          </Button>
          <Button
            disabled={state.isSubmitting || columnOptions.length === 0 || state.visibleColumns.length === 0}
            onClick={() => void onSubmit()}
          >
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSettingsDialog({
  state,
  onStateChange,
  onSubmit
}: {
  state: WorkspaceSettingsDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<WorkspaceSettingsDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) =>
        onStateChange(open ? { ...state, open } : defaultWorkspaceSettingsDialogState)
      }
    >
      <DialogContent className="w-[min(94vw,960px)] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Update workspace-wide storage rules, metadata defaults, and which fields are enabled at all in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          <div className="px-1 py-1 pr-2">
            <WorkspaceStorageSettingsFields
              workspaceName={state.workspaceName}
              settings={state.settings}
              onSettingsChange={(settings) =>
                onStateChange((current) => ({
                  ...current,
                  settings
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
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
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
  onSettingsChange
}: {
  workspaceName: string;
  settings: WorkspaceSettings;
  onSettingsChange: (settings: WorkspaceSettings) => void;
}) {
  const selectedStorageOption =
    WORKSPACE_STORAGE_LAYOUT_OPTIONS.find((option) => option.value === settings.storageLayoutPreset) ??
    WORKSPACE_STORAGE_LAYOUT_OPTIONS[0];
  const selectedFileOrganizationOption =
    WORKSPACE_FILE_ORGANIZATION_OPTIONS.find(
      (option) => option.value === settings.fileOrganizationMode
    ) ?? WORKSPACE_FILE_ORGANIZATION_OPTIONS[0];
  const previewWorkspaceName = workspaceName.trim() || 'Quality Operations';
  const previewVersionFolderPath = buildDocumentVersionRelativePath(
    buildDocumentFolderRelativePath(settings, 'Procedure', '02202600001', 'Operating Procedure'),
    '001'
  );
  const previewRelativePath = buildVersionFileRelativePath(
    settings,
    previewVersionFolderPath,
    'working',
    'procedure.docx'
  );
  const showDefaultCompany = settings.visibleDocumentColumns.includes('company');
  const showDefaultDepartment = settings.visibleDocumentColumns.includes('department');

  return (
    <div className="grid gap-4">
      <Field label="Document Storage Layout">
        <Select
          value={settings.storageLayoutPreset}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              storageLayoutPreset: event.target.value as WorkspaceSettings['storageLayoutPreset']
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
              fileOrganizationMode: event.target.value as WorkspaceSettings['fileOrganizationMode']
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

      <div className="rounded-xl border border-border bg-background px-3 py-3 text-[13px]">
        <div className="font-medium">{selectedStorageOption.label}</div>
        <div className="mt-1 text-muted-foreground">{selectedStorageOption.description}</div>
        <div className="mt-2 font-medium">{selectedFileOrganizationOption.label}</div>
        <div className="mt-1 text-muted-foreground">{selectedFileOrganizationOption.description}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Example Path
        </div>
        <div className="mt-2 rounded-lg bg-card px-2.5 py-2 font-mono text-xs text-primary">
          {previewWorkspaceName}/{previewRelativePath}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Saving these settings migrates managed document folders and version files to the new workspace layout.
        </div>
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
                    defaultCompany: event.target.value
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
                    defaultDepartment: event.target.value
                  })
                }
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <ToggleSetting
        title="Automatically mark the previous version obsolete"
        description="When a new version is created, the old latest version switches to Obsolete automatically."
        checked={settings.autoMarkPreviousVersionObsolete}
        onChange={(checked) =>
          onSettingsChange({
            ...settings,
            autoMarkPreviousVersionObsolete: checked
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
                      : settings.visibleDocumentColumns.filter((item) => item !== column.value)
                  })
                }
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Disabled fields disappear from document forms, workspace pages, and personal table-view settings.
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
  projects,
  confidentialityClasses,
  languages,
  availableColumns
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DocumentDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<DocumentDialogState>>;
  onSubmit: () => Promise<void>;
  documentTypes: DocumentType[];
  projects: Project[];
  confidentialityClasses: ConfidentialityClass[];
  languages: WorkspaceLanguage[];
  availableColumns: DocumentTableColumn[];
}) {
  const showAuthor = availableColumns.includes('author');
  const showLanguage = availableColumns.includes('language');
  const showConfidentialityClass = availableColumns.includes('confidentialityClass');
  const showProject = availableColumns.includes('project');
  const showCompany = availableColumns.includes('company');
  const showDepartment = availableColumns.includes('department');
  const showRevisionInterval = availableColumns.includes('revisionIntervalMonths');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.mode === 'create' ? 'Create Document' : 'Edit Document'}</DialogTitle>
          <DialogDescription>
            {state.mode === 'create'
              ? 'Create the document shell first. DocTrack will generate the document ID and physical folder immediately, and you can add versions and files afterward.'
              : 'Update the document metadata used in the table, detail view, and project assignments.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className={cn('grid gap-4', showAuthor ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
            <Field label="Title">
              <Input
                placeholder="Internal Audit Procedure"
                value={state.title}
                onChange={(event) => onStateChange((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            {showAuthor ? (
              <Field label="Author">
                <Input
                  placeholder="Jordan Singh"
                  value={state.author}
                  onChange={(event) => onStateChange((current) => ({ ...current, author: event.target.value }))}
                />
              </Field>
            ) : null}
          </div>

          {state.mode === 'create' ? (
            <>
              <Field label="Document Type">
                <Select
                  value={state.documentTypeId}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      documentTypeId: event.target.value
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
                      versionScheme: event.target.value as DocumentVersionScheme
                    }))
                  }
                >
                  {Object.entries(DOCUMENT_VERSION_SCHEME_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <div className="text-xs text-muted-foreground">
                  This controls how version folders are labeled for this document.
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
                        languageId: event.target.value
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
                        confidentialityClassId: event.target.value
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
                        projectId: event.target.value
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
                      onStateChange((current) => ({ ...current, company: event.target.value }))
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
                      onStateChange((current) => ({ ...current, department: event.target.value }))
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
                        revisionIntervalMonths: event.target.value.replace(/[^\d]/g, '')
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
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
            {state.mode === 'create' ? 'Create Document' : 'Save Document'}
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
  documentDetail
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
            Create the next version folder first, then manage the actual files from Show Files.
          </DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-xl border border-border bg-background p-3 text-[13px]">
            <div className="font-mono text-xs text-primary">{documentDetail.documentId}</div>
            <div className="mt-1.5 text-base font-semibold">{documentDetail.title}</div>
            <div className="mt-1 text-muted-foreground">
              Next version: {getNextVersionLabelPreview(documentDetail, state.bumpType)}
            </div>
          </div>
        ) : null}

        <Field label="Version Notes">
          <Textarea
            placeholder="What changed in this version?"
            value={state.revisionDescription}
            onChange={(event) =>
              onStateChange((current) => ({ ...current, revisionDescription: event.target.value }))
            }
          />
        </Field>

        {documentDetail?.versionScheme === 'major-minor' && documentDetail.versions.length > 0 ? (
          <Field label="Version Bump">
            <Select
              value={state.bumpType}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  bumpType: event.target.value as VersionBumpType
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
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
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
  documentDetail
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LatestVersionDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<LatestVersionDialogState>>;
  onSubmit: () => Promise<void>;
  documentDetail: DocumentDetail | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Latest Version</DialogTitle>
          <DialogDescription>
            Update the current latest version without creating a new version entry.
          </DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="font-mono text-xs text-primary">{documentDetail.documentId}</div>
            <div className="mt-1.5 text-base font-semibold">{documentDetail.title}</div>
          </div>
        ) : null}

        <Field label="Status">
          <Select
            value={state.status}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                status: event.target.value as DocumentStatus
              }))
            }
          >
            {['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Released Date">
            <Input
              type="date"
              value={state.releasedDate}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  releasedDate: event.target.value
                }))
              }
            />
          </Field>

          <Field label="Approved By">
            <Input
              placeholder="Taylor Reed"
              value={state.approvedBy}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  approvedBy: event.target.value
                }))
              }
            />
          </Field>
        </div>

        <Field label="Revision Description">
          <Textarea
            placeholder="What changed in this version?"
            value={state.revisionDescription}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                revisionDescription: event.target.value
              }))
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDot className="h-4 w-4" />}
            Save Latest Version
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
  onSubmit
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
          <DialogTitle>{state.id ? 'Edit Document Type' : 'Create Document Type'}</DialogTitle>
          <DialogDescription>
            Each type needs a unique 2-digit prefix for automatic document ID generation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Type Name">
            <Input
              placeholder="Specification"
              value={state.name}
              onChange={(event) => onStateChange((current) => ({ ...current, name: event.target.value }))}
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
                  numberPrefix: event.target.value.replace(/\D/g, '').slice(0, 2)
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
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
  onSubmit
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
          <DialogTitle>{state.id ? 'Edit Project' : 'Create Project'}</DialogTitle>
          <DialogDescription>Projects let multiple documents be grouped inside the workspace.</DialogDescription>
        </DialogHeader>

        <Field label="Project Name">
          <Input
            placeholder="QMS Rollout"
            value={state.name}
            onChange={(event) => onStateChange((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Project
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
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ClassificationDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<ClassificationDialogState>>;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{state.id ? 'Edit Confidentiality Class' : 'Create Confidentiality Class'}</DialogTitle>
          <DialogDescription>Confidentiality classes are selectable values managed per workspace.</DialogDescription>
        </DialogHeader>

        <Field label="Class Name">
          <Input
            placeholder="Internal"
            value={state.name}
            onChange={(event) => onStateChange((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
  onSubmit
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
          <DialogTitle>{state.id ? 'Edit Language' : 'Create Language'}</DialogTitle>
          <DialogDescription>Use short codes such as `NL`, `EN`, or `DE` for workspace languages.</DialogDescription>
        </DialogHeader>

        <Field label="Language Code">
          <Input
            maxLength={8}
            placeholder="EN"
            value={state.code}
            onChange={(event) =>
              onStateChange((current) => ({ ...current, code: event.target.value.toUpperCase() }))
            }
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
  canEdit,
  onRefresh,
  onAddFiles,
  onOpenFile,
  onOpenFolder,
  onRenameFile,
  onDeleteFile,
  onChangeRole
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: FilesDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<FilesDialogState>>;
  version: DocumentVersion | null;
  canEdit: boolean;
  onRefresh: (documentVersionId: number) => Promise<void>;
  onAddFiles: (documentVersionId: number) => Promise<void>;
  onOpenFile: (fileId: number) => void;
  onOpenFolder: (documentVersionId: number) => void;
  onRenameFile: (file: DocumentVersionFile) => Promise<void>;
  onDeleteFile: (file: DocumentVersionFile) => Promise<void>;
  onChangeRole: (file: DocumentVersionFile, role: DocumentVersionFileRole) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Show Files</DialogTitle>
          <DialogDescription>
            Browse the physical files for one version, open them directly, or open the version folder.
          </DialogDescription>
        </DialogHeader>

        {version ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">Version {version.versionLabel}</div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {version.files.length} files tracked in this version
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DocumentProgressBadge status={version.status} />
                  <Button variant="outline" size="sm" onClick={() => void onRefresh(version.id)}>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onOpenFolder(version.id)}>
                    <FolderOpen className="h-4 w-4" />
                    Open Folder
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="New File Role">
                  <Select
                    value={state.addRole}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        addRole: event.target.value as DocumentVersionFileRole
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
                  disabled={!canEdit || state.isSubmitting}
                  onClick={() => void onAddFiles(version.id)}
                >
                  {state.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Add Files
                </Button>
              </div>
              {!canEdit ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  Older versions are read-only. Use the latest version to add, rename, delete, or reclassify files.
                </div>
              ) : null}
            </div>

            {version.unmanagedPaths.length > 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                Unmanaged paths: {version.unmanagedPaths.join(', ')}
              </div>
            ) : null}

            <div className="max-h-[360px] space-y-2 overflow-auto rounded-xl border border-border bg-background p-3">
              {version.files.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
                  No files in this version yet.
                </div>
              ) : (
                version.files.map((file) => (
                  <div key={file.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{file.fileName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} • Modified {formatDateTime(file.modifiedDate)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canEdit ? (
                          <Select
                            value={file.role}
                            onChange={(event) =>
                              void onChangeRole(file, event.target.value as DocumentVersionFileRole)
                            }
                          >
                            {DOCUMENT_VERSION_FILE_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {DOCUMENT_VERSION_FILE_ROLE_LABELS[role]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge variant="outline">{DOCUMENT_VERSION_FILE_ROLE_LABELS[file.role]}</Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onOpenFile(file.id)}>
                          Open
                        </Button>
                        {canEdit ? (
                          <Button variant="ghost" size="sm" onClick={() => void onRenameFile(file)}>
                            <Pencil className="h-4 w-4" />
                            Rename
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <Button variant="ghost" size="sm" onClick={() => void onDeleteFile(file)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg bg-background px-2.5 py-2 text-xs text-primary">
                      {file.filePath}
                    </div>
                  </div>
                ))
              )}
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

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[13px] font-medium text-foreground/90">{label}</span>
      {children}
    </label>
  );
}

function ColumnFilter({
  label,
  value,
  onChange
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
      <div className="mt-1.5 text-[13px]">{value}</div>
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
  bumpType: VersionBumpType
): string {
  const latestVersion = documentDetail.versions[0];

  if (documentDetail.versionScheme === 'numeric-3') {
    return String((latestVersion?.sequenceNumber ?? 0) + 1).padStart(3, '0');
  }

  if (documentDetail.versionScheme === 'v-prefix') {
    return `v${(latestVersion?.sequenceNumber ?? 0) + 1}`;
  }

  if (!latestVersion) {
    return '1.0';
  }

  const match = latestVersion.versionLabel.match(/^(\d+)\.(\d+)$/);
  if (!match) {
    return '1.0';
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return bumpType === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
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
  return ({ column }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void } }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

export default App;
