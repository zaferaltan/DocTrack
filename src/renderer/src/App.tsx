import {
  startTransition,
  useDeferredValue,
  useEffect,
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
  PencilLine,
  Plus,
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
  type ColumnFiltersState,
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
  buildDocumentFolderRelativePath,
  buildDocumentVersionRelativePath,
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_STORAGE_LAYOUT_OPTIONS,
  type WorkspaceSettings,
  type WorkspaceStorageLayoutPreset
} from '@shared/workspaceLayout';
import type {
  CreateDocumentInput,
  CreateVersionInput,
  DocumentDetail,
  DocumentListItem,
  DocumentStatus,
  DocumentType,
  ThemeMode
} from '@shared/types';

type WorkspaceView = 'documents' | 'documentTypes';

type NotificationTone = 'success' | 'error';

const STATUS_VARIANTS: Record<DocumentStatus, 'success' | 'warning' | 'muted' | 'default'> = {
  Draft: 'warning',
  'In Review': 'default',
  Released: 'success',
  Archived: 'muted'
};

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: SunMoon }
];

const getSystemTheme = (): ThemeMode =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (themeMode: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
  root.classList.toggle('dark', effectiveTheme === 'dark');
};

const extractDroppedFilePath = (file: File | undefined): string | null => file?.path ?? null;

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

interface DocumentDialogState {
  open: boolean;
  title: string;
  documentTypeId: string;
  author: string;
  notes: string;
  sourceFilePath: string;
  isSubmitting: boolean;
}

interface VersionDialogState {
  open: boolean;
  notes: string;
  sourceFilePath: string;
  isSubmitting: boolean;
}

interface StatusDialogState {
  open: boolean;
  status: DocumentStatus;
  isSubmitting: boolean;
}

interface TypeDialogState {
  open: boolean;
  id?: number;
  name: string;
  numberPrefix: string;
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

const defaultDocumentDialogState: DocumentDialogState = {
  open: false,
  title: '',
  documentTypeId: '',
  author: '',
  notes: '',
  sourceFilePath: '',
  isSubmitting: false
};

const defaultVersionDialogState: VersionDialogState = {
  open: false,
  notes: '',
  sourceFilePath: '',
  isSubmitting: false
};

const defaultStatusDialogState: StatusDialogState = {
  open: false,
  status: 'Draft',
  isSubmitting: false
};

const defaultTypeDialogState: TypeDialogState = {
  open: false,
  name: '',
  numberPrefix: '',
  isSubmitting: false
};

const stopRowAction = (event: React.MouseEvent) => event.stopPropagation();

function App() {
  const {
    openWorkspaces,
    activeWorkspacePath,
    recentWorkspaces,
    themeMode,
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
    setThemeMode,
    setNotification
  } = useAppStore();

  const [workspaceDialog, setWorkspaceDialog] = useState(defaultWorkspaceDialogState);
  const [workspaceSettingsDialog, setWorkspaceSettingsDialog] = useState(
    defaultWorkspaceSettingsDialogState
  );
  const [documentDialog, setDocumentDialog] = useState(defaultDocumentDialogState);
  const [versionDialog, setVersionDialog] = useState(defaultVersionDialogState);
  const [statusDialog, setStatusDialog] = useState(defaultStatusDialogState);
  const [typeDialog, setTypeDialog] = useState(defaultTypeDialogState);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<DocumentDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const workspaceTabs = Object.values(openWorkspaces);
  const activeWorkspace = activeWorkspacePath ? openWorkspaces[activeWorkspacePath] : undefined;

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
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== 'system') {
      return undefined;
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    query.addEventListener('change', listener);

    return () => {
      query.removeEventListener('change', listener);
    };
  }, [themeMode]);

  useEffect(() => {
    if (!activeWorkspacePath || !activeWorkspace?.selectedDocumentRecordId) {
      setSelectedDocumentDetail(null);
      return;
    }

    setIsDetailLoading(true);
    void window.docTrack.documents
      .detail(activeWorkspacePath, activeWorkspace.selectedDocumentRecordId)
      .then((detail) => {
        setSelectedDocumentDetail(detail);
      })
      .catch((error: Error) => {
        setNotification({
          tone: 'error',
          message: error.message
        });
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  }, [activeWorkspace?.selectedDocumentRecordId, activeWorkspacePath, setNotification]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta) {
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setWorkspaceDialog((state) => ({ ...state, open: true }));
        return;
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openWorkspacePicker();
        return;
      }

      if (event.key.toLowerCase() === 'n' && activeWorkspace) {
        event.preventDefault();
        setDocumentDialog((state) => ({ ...state, open: true }));
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
  }, [activeWorkspace, openWorkspacePicker]);

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

  const handleCreateDocument = async () => {
    if (!activeWorkspacePath) {
      return;
    }

    try {
      setDocumentDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.create(activeWorkspacePath, {
        title: documentDialog.title,
        documentTypeId: Number(documentDialog.documentTypeId),
        author: documentDialog.author,
        notes: documentDialog.notes,
        sourceFilePath: documentDialog.sourceFilePath
      } satisfies CreateDocumentInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setDocumentDialog(defaultDocumentDialogState);
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to create document.'
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
        notes: versionDialog.notes,
        sourceFilePath: versionDialog.sourceFilePath
      } satisfies CreateVersionInput);
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setVersionDialog(defaultVersionDialogState);
      setNotification({
        tone: 'success',
        message: `Version ${detail.versions[0]?.versionNumber ?? ''} created for ${detail.documentId}.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to create document version.'
      });
      setVersionDialog((state) => ({ ...state, isSubmitting: false }));
    }
  };

  const handleUpdateStatus = async () => {
    if (!activeWorkspacePath || !selectedDocumentDetail) {
      return;
    }

    try {
      setStatusDialog((state) => ({ ...state, isSubmitting: true }));
      const detail = await window.docTrack.documents.updateStatus(activeWorkspacePath, {
        documentRecordId: selectedDocumentDetail.id,
        status: statusDialog.status
      });
      await refreshWorkspace(activeWorkspacePath);
      setSelectedDocument(activeWorkspacePath, detail.id);
      setSelectedDocumentDetail(detail);
      setStatusDialog(defaultStatusDialogState);
      setNotification({
        tone: 'success',
        message: `${detail.documentId} moved to ${statusDialog.status}.`
      });
    } catch (error) {
      setNotification({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to update document status.'
      });
      setStatusDialog((state) => ({ ...state, isSubmitting: false }));
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

    const confirmed = window.confirm(`Delete document type "${type.name}"?`);
    if (!confirmed) {
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

  if (!isBootstrapped) {
    return (
      <div className="app-surface flex h-full items-center justify-center">
        {bootError ? (
          <div className="max-w-xl rounded-[28px] border border-rose-500/30 bg-card/95 px-8 py-7 shadow-panel">
            <div className="text-lg font-semibold text-rose-300">DocTrack could not start</div>
            <div className="mt-3 text-sm text-muted-foreground">{bootError}</div>
            <div className="mt-5 flex gap-3">
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
          <div className="rounded-[28px] border border-border bg-card/90 px-8 py-7 shadow-panel">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading DocTrack workspace shell
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-surface flex h-full flex-col">
      <header className="border-b border-border/80 bg-card/70 px-5 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-workspace text-workspace-contrast shadow-panel">
              <FileStack className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">DocTrack</div>
              <div className="text-sm text-muted-foreground">
                Offline document workspaces with version control
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle
              themeMode={themeMode}
              onChange={(nextTheme) => {
                void setThemeMode(nextTheme).catch((error: Error) => {
                  setNotification({
                    tone: 'error',
                    message: error.message
                  });
                });
              }}
            />
            <Button variant="outline" onClick={() => setWorkspaceDialog((state) => ({ ...state, open: true }))}>
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
            <Button variant="secondary" onClick={() => void openWorkspacePicker()}>
              <FolderOpen className="h-4 w-4" />
              Open Workspace
            </Button>
            <Button
              variant="outline"
              disabled={!activeWorkspace}
              onClick={() => {
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
              }}
            >
              <Settings2 className="h-4 w-4" />
              Workspace Settings
            </Button>
            <Button
              onClick={() => setDocumentDialog((state) => ({ ...state, open: true }))}
              disabled={!activeWorkspace}
            >
              <FilePlus2 className="h-4 w-4" />
              New Document
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {workspaceTabs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              No workspace open yet. Create one or open an existing workspace folder.
            </div>
          ) : (
            workspaceTabs.map((workspaceTab) => (
              <button
                key={workspaceTab.workspace.rootPath}
                className={cn(
                  'group flex min-w-[220px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition',
                  activeWorkspacePath === workspaceTab.workspace.rootPath
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                )}
                onClick={() => {
                  startTransition(() => {
                    setActiveWorkspace(workspaceTab.workspace.rootPath);
                  });
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{workspaceTab.workspace.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {workspaceTab.documents.length} docs
                  </div>
                </div>
                <button
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeWorkspace(workspaceTab.workspace.rootPath);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </button>
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
        <aside className="hidden w-[240px] border-r border-border/80 bg-card/50 p-4 lg:block">
          <div className="rounded-[24px] border border-border bg-background/70 p-3 shadow-sm">
            <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
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
          </div>

          <div className="mt-4 rounded-[24px] border border-border bg-workspace px-4 py-5 text-workspace-contrast shadow-panel">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-workspace-accent" />
              Keyboard Shortcuts
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-200/80">
              <Shortcut hint="Ctrl/Cmd + Shift + N" label="New workspace" />
              <Shortcut hint="Ctrl/Cmd + O" label="Open workspace" />
              <Shortcut hint="Ctrl/Cmd + N" label="New document" />
              <Shortcut hint="Ctrl/Cmd + F" label="Focus search" />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-4">
          {!activeWorkspace ? (
            <WelcomeView
              recentWorkspaces={recentWorkspaces}
              onCreateWorkspace={() => setWorkspaceDialog((state) => ({ ...state, open: true }))}
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
          ) : activeWorkspace.selectedView === 'documents' ? (
            <DocumentsView
              workspace={activeWorkspace}
              selectedDocumentDetail={selectedDocumentDetail}
              isDetailLoading={isDetailLoading}
              onSelectDocument={(documentRecordId) =>
                setSelectedDocument(activeWorkspace.workspace.rootPath, documentRecordId)
              }
              onOpenFile={(documentVersionId) => {
                void window.docTrack.documents
                  .openFile(activeWorkspace.workspace.rootPath, documentVersionId)
                  .catch((error: Error) => {
                    setNotification({
                      tone: 'error',
                      message: error.message
                    });
                  });
              }}
              onRequestNewDocument={() => setDocumentDialog((state) => ({ ...state, open: true }))}
              onRequestNewVersion={() => {
                if (selectedDocumentDetail) {
                  setVersionDialog((state) => ({
                    ...state,
                    open: true
                  }));
                }
              }}
              onRequestStatusChange={() => {
                if (selectedDocumentDetail) {
                  setStatusDialog({
                    open: true,
                    status: selectedDocumentDetail.versions[0]?.status ?? 'Draft',
                    isSubmitting: false
                  });
                }
              }}
            />
          ) : (
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
          )}
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

      <DocumentDialog
        open={documentDialog.open}
        onOpenChange={(open) =>
          setDocumentDialog(open ? { ...documentDialog, open } : defaultDocumentDialogState)
        }
        state={documentDialog}
        onStateChange={setDocumentDialog}
        onSubmit={handleCreateDocument}
        documentTypes={activeWorkspace?.documentTypes ?? []}
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

      <StatusDialog
        open={statusDialog.open}
        onOpenChange={(open) =>
          setStatusDialog(open ? { ...statusDialog, open } : defaultStatusDialogState)
        }
        state={statusDialog}
        onStateChange={setStatusDialog}
        onSubmit={handleUpdateStatus}
        documentDetail={selectedDocumentDetail}
      />

      <DocumentTypeDialog
        open={typeDialog.open}
        onOpenChange={(open) => setTypeDialog(open ? { ...typeDialog, open } : defaultTypeDialogState)}
        state={typeDialog}
        onStateChange={setTypeDialog}
        onSubmit={handleSaveDocumentType}
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
    <div className="flex rounded-2xl border border-border bg-background/80 p-1 shadow-sm">
      {themeOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
              themeMode === option.value
                ? 'bg-primary text-primary-foreground'
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
        'mx-4 mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-sm',
        tone === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      )}
    >
      <div>{message}</div>
      <button className="rounded-full p-1 hover:bg-black/10" onClick={onClose}>
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
        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
      <span className="rounded-full bg-white/10 px-2 py-1 font-mono text-xs text-slate-100">
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
    <div className="grid h-full gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[32px] border border-border bg-card/80 p-8 shadow-panel">
        <Badge variant="outline" className="mb-6 w-fit gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Workspace-first document operations
        </Badge>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
          Keep every document, version, and status inside a portable offline workspace.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Create a new workspace folder or reopen an existing one. Each workspace opens in its own
          tab, with document tables, version history, and type configuration ready to go.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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

      <div className="rounded-[32px] border border-border bg-card/80 p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Recent Workspaces</div>
            <div className="text-sm text-muted-foreground">
              Fast re-entry into the last offline projects you touched
            </div>
          </div>
          <History className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-6 space-y-3">
          {recentWorkspaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              No recent workspaces yet. Your newly created workspaces will appear here.
            </div>
          ) : (
            recentWorkspaces.map((workspace) => (
              <button
                key={workspace.rootPath}
                className="w-full rounded-2xl border border-border bg-background/70 p-4 text-left transition hover:border-primary/40 hover:bg-accent"
                onClick={() => onOpenRecent(workspace.rootPath)}
              >
                <div className="truncate text-sm font-semibold">{workspace.name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{workspace.rootPath}</div>
                <div className="mt-3 text-xs text-muted-foreground">
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
  selectedDocumentDetail,
  isDetailLoading,
  onSelectDocument,
  onOpenFile,
  onRequestNewDocument,
  onRequestNewVersion,
  onRequestStatusChange
}: {
  workspace: ReturnType<typeof useAppStore.getState>['openWorkspaces'][string];
  selectedDocumentDetail: DocumentDetail | null;
  isDetailLoading: boolean;
  onSelectDocument: (documentRecordId: number) => void;
  onOpenFile: (documentVersionId: number) => void;
  onRequestNewDocument: () => void;
  onRequestNewVersion: () => void;
  onRequestStatusChange: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'modifiedDate', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'All'>('All');
  const deferredSearch = useDeferredValue(search);

  const filteredDocuments =
    statusFilter === 'All'
      ? workspace.documents
      : workspace.documents.filter((document) => document.status === statusFilter);

  const columns: Array<ColumnDef<DocumentListItem>> = [
    {
      accessorKey: 'documentId',
      header: columnHeader('Document ID'),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.documentId}</span>
    },
    {
      accessorKey: 'title',
      header: columnHeader('Title'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          <div className="text-xs text-muted-foreground">{row.original.typeName}</div>
        </div>
      )
    },
    {
      accessorKey: 'typeName',
      header: columnHeader('Type')
    },
    {
      accessorKey: 'status',
      header: columnHeader('Status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    {
      accessorKey: 'latestVersion',
      header: columnHeader('Latest Version'),
      cell: ({ row }) => <span>v{row.original.latestVersion}</span>
    },
    {
      accessorKey: 'modifiedDate',
      header: columnHeader('Modified'),
      cell: ({ row }) => <span>{formatDateShort(row.original.modifiedDate)}</span>
    },
    {
      accessorKey: 'author',
      header: columnHeader('Author')
    },
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
              onSelectDocument(row.original.id);
              onRequestStatusChange();
            }}
          >
            <CircleDot className="h-4 w-4" />
            Status
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              stopRowAction(event);
              onOpenFileForRow(row.original, selectedDocumentDetail, onOpenFile, onSelectDocument);
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </Button>
        </div>
      )
    }
  ];

  const table = useReactTable({
    data: filteredDocuments,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: deferredSearch
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: (row, _columnId, filterValue) => {
      const haystack = [
        row.original.documentId,
        row.original.title,
        row.original.typeName,
        row.original.author,
        row.original.status
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
    <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-h-0 flex-col rounded-[30px] border border-border bg-card/80 p-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 px-2 pb-4">
          <div>
            <div className="text-xl font-semibold">{workspace.workspace.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {workspace.documents.length} documents tracked in this workspace
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRequestNewDocument}>
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-doc-search="true"
              className="pl-10"
              placeholder="Search by ID, title, type, author, or status"
              value={search}
              onChange={(event) => {
                startTransition(() => {
                  setSearch(event.target.value);
                });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['All', ...workspace.statuses] as const).map((status) => (
              <button
                key={status}
                className={cn(
                  'rounded-full border px-3 py-2 text-sm font-medium transition',
                  statusFilter === status
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <ColumnFilter
            label="Document ID"
            value={String(table.getColumn('documentId')?.getFilterValue() ?? '')}
            onChange={(value) => table.getColumn('documentId')?.setFilterValue(value)}
          />
          <ColumnFilter
            label="Title"
            value={String(table.getColumn('title')?.getFilterValue() ?? '')}
            onChange={(value) => table.getColumn('title')?.setFilterValue(value)}
          />
          <ColumnFilter
            label="Type"
            value={String(table.getColumn('typeName')?.getFilterValue() ?? '')}
            onChange={(value) => table.getColumn('typeName')?.setFilterValue(value)}
          />
          <ColumnFilter
            label="Author"
            value={String(table.getColumn('author')?.getFilterValue() ?? '')}
            onChange={(value) => table.getColumn('author')?.setFilterValue(value)}
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-border">
          <div className="h-full overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-border">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          'whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground',
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
                    <td colSpan={columns.length} className="px-6 py-16 text-center text-muted-foreground">
                      No documents match the current search and filter settings.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'cursor-pointer border-b border-border/60 transition hover:bg-accent/70',
                        workspace.selectedDocumentRecordId === row.original.id && 'bg-primary/10'
                      )}
                      onClick={() => onSelectDocument(row.original.id)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-4 py-3 align-middle',
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

      <div className="flex min-h-0 flex-col rounded-[30px] border border-border bg-card/80 p-4 shadow-panel">
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div>
            <div className="text-lg font-semibold">Version Detail</div>
            <div className="text-sm text-muted-foreground">
              Inspect the selected document and act on the latest version
            </div>
          </div>
          {selectedDocumentDetail ? <StatusBadge status={selectedDocumentDetail.versions[0]?.status ?? 'Draft'} /> : null}
        </div>

        {!selectedDocumentDetail && !isDetailLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-[24px] border border-dashed border-border bg-background/70 p-6 text-center text-sm text-muted-foreground">
            Select a document from the table to view version history, open files, or update status.
          </div>
        ) : null}

        {isDetailLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading document detail
          </div>
        ) : null}

        {selectedDocumentDetail ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="rounded-[24px] border border-border bg-background/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-xs text-primary">{selectedDocumentDetail.documentId}</div>
                  <div className="mt-2 text-xl font-semibold">{selectedDocumentDetail.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedDocumentDetail.typeName} • {selectedDocumentDetail.author}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onRequestStatusChange}>
                    <CircleDot className="h-4 w-4" />
                    Change Status
                  </Button>
                  <Button size="sm" onClick={onRequestNewVersion}>
                    <PencilLine className="h-4 w-4" />
                    New Version
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <InfoCard label="Created" value={formatDateTime(selectedDocumentDetail.createdDate)} />
                <InfoCard label="Modified" value={formatDateTime(selectedDocumentDetail.modifiedDate)} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-[24px] border border-border bg-background/70 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">Versions</div>
                <Badge variant="outline">{selectedDocumentDetail.versions.length} total</Badge>
              </div>
              <div className="space-y-3">
                {selectedDocumentDetail.versions.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-2xl border border-border bg-card/80 p-4 transition hover:border-primary/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold">Version {version.versionNumber}</div>
                          <StatusBadge status={version.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Created {formatDateTime(version.createdDate)}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onOpenFile(version.id)}>
                        <FolderOpen className="h-4 w-4" />
                        Open File
                      </Button>
                    </div>
                    <div className="mt-3 rounded-2xl bg-background/80 p-3 text-sm text-muted-foreground">
                      {version.notes || 'No notes recorded for this version.'}
                    </div>
                  </div>
                ))}
              </div>
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
    <div className="rounded-[30px] border border-border bg-card/80 p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="text-xl font-semibold">Document Types</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Prefix-managed document categories for structured numeric IDs
          </div>
        </div>
        <Button onClick={onCreateType}>
          <Plus className="h-4 w-4" />
          Add Document Type
        </Button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workspace.documentTypes.map((type) => (
          <div
            key={type.id}
            className="rounded-[24px] border border-border bg-background/70 p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-primary">{type.numberPrefix}</div>
                <div className="mt-2 text-lg font-semibold">{type.name}</div>
              </div>
              <Badge variant="outline">2-digit prefix</Badge>
            </div>
            <div className="mt-4 flex gap-2">
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

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm">
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Update how new documents are stored for this workspace. Existing files stay where they are.
          </DialogDescription>
        </DialogHeader>

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
  const selectedOption =
    WORKSPACE_STORAGE_LAYOUT_OPTIONS.find((option) => option.value === settings.storageLayoutPreset) ??
    WORKSPACE_STORAGE_LAYOUT_OPTIONS[0];
  const previewWorkspaceName = workspaceName.trim() || 'Quality Operations';
  const previewRelativePath = buildDocumentVersionRelativePath(
    buildDocumentFolderRelativePath(
      settings,
      'Procedure',
      '02202600001',
      'Operating Procedure'
    ),
    2,
    'procedure.pdf'
  );

  return (
    <div className="grid gap-4">
      <Field label="Document Storage Layout">
        <Select
          value={settings.storageLayoutPreset}
          onChange={(event) =>
            onSettingsChange({
              storageLayoutPreset: event.target.value as WorkspaceStorageLayoutPreset
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

      <div className="rounded-2xl border border-border bg-background/70 px-4 py-4 text-sm">
        <div className="font-medium">{selectedOption.label}</div>
        <div className="mt-1 text-muted-foreground">{selectedOption.description}</div>
        <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Example Path
        </div>
        <div className="mt-2 rounded-xl bg-card px-3 py-2 font-mono text-xs text-primary">
          {previewWorkspaceName}/{previewRelativePath}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Later settings updates affect newly created documents only. Existing document folders are not moved.
        </div>
      </div>
    </div>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentTypes
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DocumentDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<DocumentDialogState>>;
  onSubmit: () => Promise<void>;
  documentTypes: DocumentType[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Document</DialogTitle>
          <DialogDescription>
            Upload the first file version and DocTrack will generate the structured numeric document ID automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input
                placeholder="Internal Audit Procedure"
                value={state.title}
                onChange={(event) => onStateChange((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <Field label="Author">
              <Input
                placeholder="Jordan Singh"
                value={state.author}
                onChange={(event) => onStateChange((current) => ({ ...current, author: event.target.value }))}
              />
            </Field>
          </div>

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

          <Field label="Version Notes">
            <Textarea
              placeholder="Describe what this initial version contains."
              value={state.notes}
              onChange={(event) => onStateChange((current) => ({ ...current, notes: event.target.value }))}
            />
          </Field>

          <Field label="Source File">
            <FileDropField
              value={state.sourceFilePath}
              onChange={(value) => onStateChange((current) => ({ ...current, sourceFilePath: value }))}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Create Document
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
            The document ID stays fixed while the version number increments for the selected document.
          </DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm">
            <div className="font-mono text-xs text-primary">{documentDetail.documentId}</div>
            <div className="mt-2 text-lg font-semibold">{documentDetail.title}</div>
            <div className="mt-1 text-muted-foreground">
              Next version: v{(documentDetail.versions[0]?.versionNumber ?? 0) + 1}
            </div>
          </div>
        ) : null}

        <Field label="Version Notes">
          <Textarea
            placeholder="What changed in this version?"
            value={state.notes}
            onChange={(event) => onStateChange((current) => ({ ...current, notes: event.target.value }))}
          />
        </Field>

        <Field label="Source File">
          <FileDropField
            value={state.sourceFilePath}
            onChange={(value) => onStateChange((current) => ({ ...current, sourceFilePath: value }))}
          />
        </Field>

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

function StatusDialog({
  open,
  onOpenChange,
  state,
  onStateChange,
  onSubmit,
  documentDetail
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: StatusDialogState;
  onStateChange: React.Dispatch<React.SetStateAction<StatusDialogState>>;
  onSubmit: () => Promise<void>;
  documentDetail: DocumentDetail | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Document Status</DialogTitle>
          <DialogDescription>
            Status updates apply to the latest version and do not create a new version entry.
          </DialogDescription>
        </DialogHeader>

        {documentDetail ? (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="font-mono text-xs text-primary">{documentDetail.documentId}</div>
            <div className="mt-2 text-lg font-semibold">{documentDetail.title}</div>
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
            {['Draft', 'In Review', 'Released', 'Archived'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={state.isSubmitting} onClick={() => void onSubmit()}>
            {state.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDot className="h-4 w-4" />}
            Update Status
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

function FileDropField({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={cn(
        'rounded-[24px] border border-dashed p-4 transition',
        isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background/70'
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const filePath = extractDroppedFilePath(event.dataTransfer.files[0]);
        if (filePath) {
          onChange(filePath);
        }
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-medium">Drag and drop a file here</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Or browse to select a source file from disk.
          </div>
          {value ? <div className="mt-3 rounded-xl bg-card px-3 py-2 text-xs text-primary">{value}</div> : null}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void window.docTrack.dialogs.pickDocumentFile().then((filePath) => {
              if (filePath) {
                onChange(filePath);
              }
            });
          }}
        >
          <Upload className="h-4 w-4" />
          Browse File
        </Button>
      </div>
    </div>
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
      <span className="text-sm font-medium">{label}</span>
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
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>;
}

function columnHeader(label: string) {
  return ({ column }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void } }) => (
    <button
      className="inline-flex items-center gap-2 transition hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown className="h-4 w-4" />
    </button>
  );
}

function onOpenFileForRow(
  row: DocumentListItem,
  selectedDetail: DocumentDetail | null,
  onOpenFile: (documentVersionId: number) => void,
  onSelectDocument: (documentRecordId: number) => void
) {
  if (selectedDetail?.id === row.id) {
    const latestVersionId = selectedDetail.versions[0]?.id;
    if (latestVersionId) {
      onOpenFile(latestVersionId);
    }
    return;
  }

  onSelectDocument(row.id);
}

export default App;
