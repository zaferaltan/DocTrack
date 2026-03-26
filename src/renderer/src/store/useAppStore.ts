import { create } from 'zustand';
import type {
  OpenWorkspaceResult,
  RecentWorkspace,
  ThemeMode,
  WorkspaceSummary
} from '@shared/types';

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
    filePath: string;
    includeExampleData?: boolean;
  }) => Promise<void>;
  openWorkspace: (filePath: string) => Promise<void>;
  refreshWorkspace: (filePath: string) => Promise<void>;
  closeWorkspace: (filePath: string) => Promise<void>;
  setActiveWorkspace: (filePath: string) => void;
  setWorkspaceView: (filePath: string, view: WorkspaceView) => void;
  setSelectedDocument: (filePath: string, documentRecordId?: number) => void;
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
      openWorkspaceInfos.map((workspace) => window.docTrack.workspace.getSummary(workspace.filePath))
    );

    const openWorkspaces = Object.fromEntries(
      summaries.map((summary) => [summary.workspace.filePath, buildWorkspaceState(summary)])
    );

    set({
      recentWorkspaces,
      themeMode,
      openWorkspaces,
      activeWorkspacePath: summaries[0]?.workspace.filePath,
      isBootstrapped: true
    });
  },
  createWorkspace: async (input) => {
    const result = await window.docTrack.workspace.create(input);
    const recentWorkspaces = await window.docTrack.workspace.listRecent();
    set((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [result.workspace.filePath]: buildWorkspaceState(
          result,
          state.openWorkspaces[result.workspace.filePath]
        )
      },
      activeWorkspacePath: result.workspace.filePath,
      recentWorkspaces,
      notification: {
        tone: 'success',
        message: `Workspace "${result.workspace.name}" is ready.`
      }
    }));
  },
  openWorkspace: async (filePath) => {
    const result = await window.docTrack.workspace.open(filePath);
    const recentWorkspaces = await window.docTrack.workspace.listRecent();
    set((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [result.workspace.filePath]: buildWorkspaceState(
          result,
          state.openWorkspaces[result.workspace.filePath]
        )
      },
      activeWorkspacePath: result.workspace.filePath,
      recentWorkspaces,
      notification: {
        tone: 'success',
        message: `Opened workspace "${result.workspace.name}".`
      }
    }));
  },
  refreshWorkspace: async (filePath) => {
    const result = await window.docTrack.workspace.getSummary(filePath);
    set((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [result.workspace.filePath]: buildWorkspaceState(
          result,
          state.openWorkspaces[result.workspace.filePath]
        )
      }
    }));
  },
  closeWorkspace: async (filePath) => {
    await window.docTrack.workspace.close(filePath);
    set((state) => {
      const nextOpenWorkspaces = { ...state.openWorkspaces };
      delete nextOpenWorkspaces[filePath];

      const remainingPaths = Object.keys(nextOpenWorkspaces);

      return {
        openWorkspaces: nextOpenWorkspaces,
        activeWorkspacePath:
          state.activeWorkspacePath === filePath
            ? remainingPaths[remainingPaths.length - 1]
            : state.activeWorkspacePath
      };
    });
  },
  setActiveWorkspace: (filePath) => {
    set({ activeWorkspacePath: filePath });
  },
  setWorkspaceView: (filePath, view) => {
    set((state) => {
      const workspace = state.openWorkspaces[filePath];
      if (!workspace) {
        return state;
      }

      return {
        openWorkspaces: {
          ...state.openWorkspaces,
          [filePath]: {
            ...workspace,
            selectedView: view
          }
        }
      };
    });
  },
  setSelectedDocument: (filePath, documentRecordId) => {
    set((state) => {
      const workspace = state.openWorkspaces[filePath];
      if (!workspace) {
        return state;
      }

      return {
        openWorkspaces: {
          ...state.openWorkspaces,
          [filePath]: {
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
