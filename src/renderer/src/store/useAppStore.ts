import { create } from 'zustand';
import type {
  OpenWorkspaceResult,
  RecentWorkspace,
  ThemeMode,
  WorkspaceSummary
} from '@shared/types';
import type { WorkspaceSettings } from '@shared/workspaceLayout';

export type WorkspaceView = 'documents' | 'documentTypes';

export interface WorkspaceTabState extends WorkspaceSummary {
  selectedView: WorkspaceView;
  selectedDocumentRecordId?: number;
}

interface AppStoreState {
  openWorkspaces: Record<string, WorkspaceTabState>;
  activeWorkspacePath?: string;
  recentWorkspaces: RecentWorkspace[];
  themeMode: ThemeMode;
  isBootstrapped: boolean;
  notification?: {
    tone: 'success' | 'error';
    message: string;
  };
  bootstrap: () => Promise<void>;
  createWorkspace: (input: {
    name: string;
    parentPath: string;
    settings: WorkspaceSettings;
    includeExampleData?: boolean;
  }) => Promise<void>;
  openWorkspace: (rootPath: string) => Promise<void>;
  refreshWorkspace: (rootPath: string) => Promise<void>;
  closeWorkspace: (rootPath: string) => Promise<void>;
  updateWorkspaceSettings: (rootPath: string, settings: WorkspaceSettings) => Promise<void>;
  setActiveWorkspace: (rootPath: string) => void;
  setWorkspaceView: (rootPath: string, view: WorkspaceView) => void;
  setSelectedDocument: (rootPath: string, documentRecordId?: number) => void;
  setThemeMode: (themeMode: ThemeMode) => Promise<void>;
  setNotification: (notification?: AppStoreState['notification']) => void;
}

const buildWorkspaceState = (
  result: OpenWorkspaceResult,
  existing?: WorkspaceTabState
): WorkspaceTabState => ({
  ...result.summary,
  selectedView: existing?.selectedView ?? 'documents',
  selectedDocumentRecordId: existing?.selectedDocumentRecordId
});

export const useAppStore = create<AppStoreState>((set, get) => ({
  openWorkspaces: {},
  activeWorkspacePath: undefined,
  recentWorkspaces: [],
  themeMode: 'system',
  isBootstrapped: false,
  notification: undefined,
  bootstrap: async () => {
    const [recentWorkspaces, themeMode, openWorkspaceInfos] = await Promise.all([
      window.docTrack.workspace.listRecent(),
      window.docTrack.theme.get(),
      window.docTrack.workspace.listOpen()
    ]);

    const summaries = await Promise.all(
      openWorkspaceInfos.map((workspace) => window.docTrack.workspace.getSummary(workspace.rootPath))
    );

    const openWorkspaces = Object.fromEntries(
      summaries.map((summary) => [summary.workspace.rootPath, buildWorkspaceState(summary)])
    );

    set({
      recentWorkspaces,
      themeMode,
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
    set((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [result.workspace.rootPath]: buildWorkspaceState(
          result,
          state.openWorkspaces[result.workspace.rootPath]
        )
      },
      activeWorkspacePath: result.workspace.rootPath,
      recentWorkspaces,
      notification: {
        tone: 'success',
        message: `Opened workspace "${result.workspace.name}".`
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
  updateWorkspaceSettings: async (rootPath, settings) => {
    const result = await window.docTrack.workspace.updateSettings(rootPath, settings);
    const warningSuffix =
      result.warnings && result.warnings.length > 0
        ? ` ${result.warnings.length} unmanaged path warning${result.warnings.length === 1 ? '' : 's'} recorded.`
        : '';
    set((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [result.workspace.rootPath]: buildWorkspaceState(
          result,
          state.openWorkspaces[result.workspace.rootPath]
        )
      },
      notification: {
        tone: 'success',
        message: `Workspace settings saved for "${result.workspace.name}".${warningSuffix}`
      }
    }));
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
  setThemeMode: async (themeMode) => {
    const nextTheme = await window.docTrack.theme.set(themeMode);
    set({ themeMode: nextTheme });
  },
  setNotification: (notification) => set({ notification })
}));
