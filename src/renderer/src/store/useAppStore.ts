import { create } from 'zustand';
import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings,
  type DocumentsVisualizationMode,
  type WorkspaceView
} from '@shared/applicationSettings';
import { createDefaultWorkspaceLifecycle } from '@shared/documentLifecycle';
import {
  DEFAULT_DOCUMENT_VIEW_STATE,
  buildDocumentViewStateFromSavedView,
  type DashboardLayout,
  type DocumentViewState,
  type SavedView,
  type SavedViewHealthFlagValue
} from '@shared/savedViews';
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/workspaceLayout';
import { createDefaultWorkspaceRoleSettings } from '@shared/workspaceRoles';
import type {
  CreateSavedViewInput,
  DeleteSavedViewInput,
  DuplicateSavedViewInput,
  OpenWorkspaceResult,
  PromoteSavedViewToSharedInput,
  PromoteSavedViewToSharedResult,
  RecentWorkspace,
  UpdateDashboardLayoutInput,
  UpdateSavedViewInput,
  WorkspaceSession,
  WorkspaceCreateInput,
  WorkspaceSettingsUpdateInput,
  WorkspaceSummary,
  WorkspaceUser
} from '@shared/types';

export interface WorkspaceTabState extends Omit<WorkspaceSummary, 'users'> {
  users: WorkspaceUser[];
  authKind: OpenWorkspaceResult['kind'];
  canRecoverAccess: boolean;
  session: WorkspaceSession | null;
  selectedView: WorkspaceView;
  selectedDocumentsVisualization: DocumentsVisualizationMode;
  documentViewState: DocumentViewState;
  selectedDocumentRecordId?: number;
}

interface AppStoreState {
  openWorkspaces: Record<string, WorkspaceTabState>;
  activeWorkspacePath?: string;
  recentWorkspaces: RecentWorkspace[];
  applicationSettings: ApplicationSettings;
  isBootstrapped: boolean;
  notification?: {
    tone: 'success' | 'error';
    message: string;
  };
  bootstrap: () => Promise<void>;
  createWorkspace: (input: WorkspaceCreateInput) => Promise<void>;
  openWorkspace: (rootPath: string) => Promise<void>;
  refreshWorkspace: (rootPath: string) => Promise<void>;
  closeWorkspace: (rootPath: string) => Promise<void>;
  dismissRecentWorkspace: (rootPath: string) => Promise<void>;
  updateWorkspaceSettings: (rootPath: string, input: WorkspaceSettingsUpdateInput) => Promise<void>;
  updateDashboardLayout: (rootPath: string, input: UpdateDashboardLayoutInput) => Promise<DashboardLayout>;
  signInWorkspace: (rootPath: string, username: string, password: string) => Promise<void>;
  recoverWorkspaceAccess: (
    rootPath: string,
    input: import('@shared/types').WorkspaceAccessRecoveryInput
  ) => Promise<void>;
  signOutWorkspace: (rootPath: string) => Promise<void>;
  createSavedView: (rootPath: string, input: CreateSavedViewInput) => Promise<SavedView>;
  updateSavedView: (
    rootPath: string,
    savedViewId: string,
    scope: SavedView['scope'],
    input: UpdateSavedViewInput
  ) => Promise<SavedView>;
  deleteSavedView: (rootPath: string, input: DeleteSavedViewInput) => Promise<void>;
  duplicateSavedView: (rootPath: string, input: DuplicateSavedViewInput) => Promise<SavedView>;
  promoteSavedViewToShared: (
    rootPath: string,
    input: PromoteSavedViewToSharedInput
  ) => Promise<PromoteSavedViewToSharedResult>;
  setActiveWorkspace: (rootPath: string) => void;
  setWorkspaceView: (rootPath: string, view: WorkspaceView) => void;
  setDocumentsVisualization: (rootPath: string, mode: DocumentsVisualizationMode) => void;
  setDocumentViewState: (
    rootPath: string,
    updater: DocumentViewState | ((current: DocumentViewState) => DocumentViewState)
  ) => void;
  applySavedView: (rootPath: string, savedView: SavedView) => void;
  applyDashboardDrilldown: (
    rootPath: string,
    input: {
      status?: SavedView['query']['statusFilter'];
      groupFilter?: string;
      projectFilter?: string;
      healthFlag?: SavedViewHealthFlagValue;
    }
  ) => void;
  setSelectedDocument: (rootPath: string, documentRecordId?: number) => void;
  updateApplicationSettings: (settings: ApplicationSettings) => Promise<void>;
  setNotification: (notification?: AppStoreState['notification']) => void;
}

const EMPTY_WORKSPACE_SUMMARY: Omit<WorkspaceSummary, 'workspace'> = {
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  lifecycle: createDefaultWorkspaceLifecycle(),
  roleSettings: createDefaultWorkspaceRoleSettings(),
  users: [],
  documents: [],
  dashboard: {
    generatedDate: '',
    totalDocuments: 0,
    countsByStatus: [],
    countsByType: [],
    countsByGroup: [],
    countsByProject: [],
    healthInsights: [],
    recentActivity: []
  },
  dashboardLayout: { widgets: [] },
  documentTypes: [],
  groups: [],
  projects: [],
  templates: [],
  confidentialityClasses: [],
  languages: [],
  statuses: [],
  savedViews: []
};

const buildWorkspaceState = (
  result: OpenWorkspaceResult,
  applicationSettings: ApplicationSettings,
  existing?: WorkspaceTabState
): WorkspaceTabState => {
  const summary =
    result.kind === 'authenticated'
      ? result.summary
      : result.summary ?? {
          workspace: result.workspace,
          ...EMPTY_WORKSPACE_SUMMARY,
          users: result.users
        };
  const existingDocumentViewState = existing?.documentViewState ?? {
    ...DEFAULT_DOCUMENT_VIEW_STATE
  };
  const normalizedStatusFilter =
    existingDocumentViewState.statusFilter === 'All' ||
    existingDocumentViewState.statusFilter === 'Not started' ||
    summary.statuses.includes(existingDocumentViewState.statusFilter)
      ? existingDocumentViewState.statusFilter
      : 'All';

  return {
    ...summary,
    roleSettings: summary.roleSettings ?? createDefaultWorkspaceRoleSettings(),
    users: summary.users ?? [],
    authKind: result.kind,
    canRecoverAccess: result.kind === 'unauthenticated' ? result.canRecoverAccess : false,
    session: result.kind === 'authenticated' ? result.session : null,
    selectedView: existing?.selectedView ?? applicationSettings.defaultWorkspaceView,
    selectedDocumentsVisualization:
      existing?.selectedDocumentsVisualization ?? applicationSettings.defaultDocumentsVisualization,
    documentViewState: {
      ...existingDocumentViewState,
      statusFilter: normalizedStatusFilter
    },
    selectedDocumentRecordId: existing?.selectedDocumentRecordId
  };
};

export const createAppStore = () =>
  create<AppStoreState>((set, get) => ({
    openWorkspaces: {},
    activeWorkspacePath: undefined,
    recentWorkspaces: [],
    applicationSettings: { ...DEFAULT_APPLICATION_SETTINGS },
    isBootstrapped: false,
    notification: undefined,
    bootstrap: async () => {
      let [recentWorkspaces, previousSessionWorkspaces, applicationSettings, openWorkspaceInfos] = await Promise.all([
        window.docTrack.workspace.listRecent(),
        window.docTrack.workspace.listPreviousSession(),
        window.docTrack.appSettings.get(),
        window.docTrack.workspace.listOpen()
      ]);

      if (
        openWorkspaceInfos.length === 0 &&
        applicationSettings.launchBehavior === 'reopen-previous-session'
      ) {
        for (const workspace of previousSessionWorkspaces) {
          try {
            await window.docTrack.workspace.open(workspace.rootPath);
          } catch {
            // Ignore missing or unavailable workspaces and continue restoring the rest.
          }
        }

        [recentWorkspaces, openWorkspaceInfos] = await Promise.all([
          window.docTrack.workspace.listRecent(),
          window.docTrack.workspace.listOpen()
        ]);
      }

      const summaries = await Promise.all(
        openWorkspaceInfos.map((workspace) => window.docTrack.workspace.getSummary(workspace.rootPath))
      );

      const openWorkspaces = Object.fromEntries(
        summaries.map((summary) => [
          summary.workspace.rootPath,
          buildWorkspaceState(summary, applicationSettings)
        ])
      );

      set({
        recentWorkspaces,
        applicationSettings,
        openWorkspaces,
        activeWorkspacePath: summaries[0]?.workspace.rootPath,
        isBootstrapped: true
      });
    },
    createWorkspace: async (input) => {
      const result = await window.docTrack.workspace.create(input);
      const recentWorkspaces = await window.docTrack.workspace.listRecent();
      const warningSuffix =
        result.warnings && result.warnings.length > 0
          ? ` ${result.warnings.length} storage warning${result.warnings.length === 1 ? '' : 's'} recorded.`
          : '';
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [result.workspace.rootPath]: buildWorkspaceState(
            result,
            state.applicationSettings,
            state.openWorkspaces[result.workspace.rootPath]
          )
        },
        activeWorkspacePath: result.workspace.rootPath,
        recentWorkspaces,
        notification: {
          tone: 'success',
          message: `Workspace "${result.workspace.name}" is ready.${warningSuffix}`
        }
      }));
    },
    openWorkspace: async (rootPath) => {
      const result = await window.docTrack.workspace.open(rootPath);
      const recentWorkspaces = await window.docTrack.workspace.listRecent();
      const warningSuffix =
        result.warnings && result.warnings.length > 0
          ? ` ${result.warnings.length} integrity warning${result.warnings.length === 1 ? '' : 's'} detected.`
          : '';
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [result.workspace.rootPath]: buildWorkspaceState(
            result,
            state.applicationSettings,
            state.openWorkspaces[result.workspace.rootPath]
          )
        },
        activeWorkspacePath: result.workspace.rootPath,
        recentWorkspaces,
        notification: {
          tone: 'success',
          message: `Opened workspace "${result.workspace.name}".${warningSuffix}`
        }
      }));
    },
    refreshWorkspace: async (rootPath) => {
      const result = await window.docTrack.workspace.getSummary(rootPath);
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [result.workspace.rootPath]: buildWorkspaceState(
            result,
            state.applicationSettings,
            state.openWorkspaces[result.workspace.rootPath]
          )
        }
      }));
    },
    closeWorkspace: async (rootPath) => {
      await window.docTrack.workspace.close(rootPath);
      set((state) => {
        const nextOpenWorkspaces = { ...state.openWorkspaces };
        delete nextOpenWorkspaces[rootPath];

        const remainingPaths = Object.keys(nextOpenWorkspaces);

        return {
          openWorkspaces: nextOpenWorkspaces,
          activeWorkspacePath:
            state.activeWorkspacePath === rootPath
              ? remainingPaths[remainingPaths.length - 1]
              : state.activeWorkspacePath
        };
      });
    },
    dismissRecentWorkspace: async (rootPath) => {
      const recentWorkspaces = await window.docTrack.workspace.dismissRecent(rootPath);
      set({ recentWorkspaces });
    },
    updateWorkspaceSettings: async (rootPath, input) => {
      const result = await window.docTrack.workspace.updateSettings(rootPath, input);
      const warningSuffix =
        result.warnings && result.warnings.length > 0
          ? ` ${result.warnings.length} unmanaged path warning${result.warnings.length === 1 ? '' : 's'} recorded.`
          : '';
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [result.workspace.rootPath]: buildWorkspaceState(
            result,
            state.applicationSettings,
            state.openWorkspaces[result.workspace.rootPath]
          )
        },
        notification: {
          tone: 'success',
          message: `Workspace settings saved for "${result.workspace.name}".${warningSuffix}`
        }
      }));
    },
    updateDashboardLayout: async (rootPath, input) => {
      const layout = await window.docTrack.workspace.updateDashboardLayout(rootPath, input);
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              dashboardLayout: layout
            }
          }
        };
      });
      return layout;
    },
    signInWorkspace: async (rootPath, username, password) => {
      const result = await window.docTrack.workspace.signIn(rootPath, { username, password });
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [rootPath]: buildWorkspaceState(result, state.applicationSettings, state.openWorkspaces[rootPath])
        }
      }));
    },
    recoverWorkspaceAccess: async (rootPath, input) => {
      const result = await window.docTrack.workspace.recoverAccess(rootPath, input);
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [rootPath]: buildWorkspaceState(result, state.applicationSettings, state.openWorkspaces[rootPath])
        },
        notification: {
          tone: 'success',
          message: `Access recovered for "${result.workspace.name}".`
        }
      }));
    },
    signOutWorkspace: async (rootPath) => {
      await window.docTrack.workspace.signOut(rootPath);
      const result = await window.docTrack.workspace.getSummary(rootPath);
      set((state) => ({
        openWorkspaces: {
          ...state.openWorkspaces,
          [rootPath]: buildWorkspaceState(result, state.applicationSettings, state.openWorkspaces[rootPath])
        }
      }));
    },
    createSavedView: async (rootPath, input) => {
      const savedView = await window.docTrack.savedViews.create(rootPath, input);
      await get().refreshWorkspace(rootPath);
      return savedView;
    },
    updateSavedView: async (rootPath, savedViewId, scope, input) => {
      const savedView = await window.docTrack.savedViews.update(rootPath, savedViewId, scope, input);
      await get().refreshWorkspace(rootPath);
      return savedView;
    },
    deleteSavedView: async (rootPath, input) => {
      await window.docTrack.savedViews.delete(rootPath, input);
      await get().refreshWorkspace(rootPath);
    },
    duplicateSavedView: async (rootPath, input) => {
      const savedView = await window.docTrack.savedViews.duplicate(rootPath, input);
      await get().refreshWorkspace(rootPath);
      return savedView;
    },
    promoteSavedViewToShared: async (rootPath, input) => {
      const result = await window.docTrack.savedViews.promoteToShared(rootPath, input);
      await get().refreshWorkspace(rootPath);
      return result;
    },
    setActiveWorkspace: (rootPath) => {
      set({ activeWorkspacePath: rootPath });
    },
    setWorkspaceView: (rootPath, view) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              selectedView: view
            }
          }
        };
      });
    },
    setDocumentsVisualization: (rootPath, mode) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              selectedDocumentsVisualization: mode
            }
          }
        };
      });
    },
    setDocumentViewState: (rootPath, updater) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        const nextState =
          typeof updater === 'function' ? updater(workspace.documentViewState) : updater;

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              documentViewState: nextState
            }
          }
        };
      });
    },
    applySavedView: (rootPath, savedView) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              selectedView: 'documents',
              selectedDocumentsVisualization: savedView.presentation.visualizationMode,
              documentViewState: buildDocumentViewStateFromSavedView(savedView)
            }
          }
        };
      });
    },
    applyDashboardDrilldown: (rootPath, input) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              selectedView: 'documents',
              documentViewState: {
                ...DEFAULT_DOCUMENT_VIEW_STATE,
                statusFilter: input.status ?? 'All',
                groupFilter: input.groupFilter ?? 'All',
                projectFilter: input.projectFilter ?? 'All',
                healthFilter: input.healthFlag ?? 'All'
              }
            }
          }
        };
      });
    },
    setSelectedDocument: (rootPath, documentRecordId) => {
      set((state) => {
        const workspace = state.openWorkspaces[rootPath];
        if (!workspace) {
          return state;
        }

        return {
          openWorkspaces: {
            ...state.openWorkspaces,
            [rootPath]: {
              ...workspace,
              selectedDocumentRecordId: documentRecordId
            }
          }
        };
      });
    },
    updateApplicationSettings: async (settings) => {
      const nextSettings = await window.docTrack.appSettings.update(settings);
      set({ applicationSettings: nextSettings });
    },
    setNotification: (notification) => set({ notification })
  }));

export const useAppStore = createAppStore();
