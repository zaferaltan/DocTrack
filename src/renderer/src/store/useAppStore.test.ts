// @vitest-environment jsdom

import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  DEFAULT_DOCUMENT_VIEW_STATE,
  type SavedView
} from '@shared/savedViews';
import { createDefaultWorkspaceLifecycle } from '@shared/documentLifecycle';
import type {
  OpenWorkspaceResult,
  WorkspaceInfo,
  WorkspaceSession,
  WorkspaceUser
} from '@shared/types';
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/workspaceLayout';
import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from '@renderer/store/useAppStore';

const workspaceInfo: WorkspaceInfo = {
  id: 1,
  name: 'Quality',
  rootPath: '/Workspaces/Quality',
  createdDate: '2026-03-28T10:00:00.000Z',
  isOpen: true
};

const defaultDashboard = {
  generatedDate: '2026-03-31T12:00:00.000Z',
  totalDocuments: 0,
  countsByStatus: [],
  countsByType: [],
  countsByProject: [],
  healthInsights: [],
  recentActivity: []
};

const workspaceUsers: WorkspaceUser[] = [
  {
    id: 1,
    username: 'jordan',
    displayName: 'Jordan Singh',
    role: 'admin',
    signInEnabled: true,
    lastSignedInDate: '2026-03-31T12:00:00.000Z',
    createdDate: '2026-03-28T09:00:00.000Z',
    modifiedDate: '2026-03-31T12:00:00.000Z'
  }
];

const workspaceSession: WorkspaceSession = {
  user: workspaceUsers[0],
  permissions: {
    canReadWorkspace: true,
    canEditWorkspace: true,
    canManageWorkspace: true
  },
  signedInAt: '2026-03-31T12:00:00.000Z'
};

const openWorkspaceResult: OpenWorkspaceResult = {
  kind: 'authenticated',
  workspace: workspaceInfo,
  summary: {
    workspace: workspaceInfo,
    settings: DEFAULT_WORKSPACE_SETTINGS,
    lifecycle: createDefaultWorkspaceLifecycle(),
    users: workspaceUsers,
    documents: [],
    dashboard: defaultDashboard,
    dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
    documentTypes: [
      {
        id: 1,
        name: 'Procedure',
        numberPrefix: '02'
      }
    ],
    projects: [],
    templates: [],
    confidentialityClasses: [],
    languages: [],
    statuses: ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'],
    savedViews: []
  },
  session: workspaceSession
};

const installDocTrackMock = (applicationSettings = DEFAULT_APPLICATION_SETTINGS) => {
  const docTrack = {
    workspace: {
      create: vi.fn(),
      open: vi.fn().mockResolvedValue(openWorkspaceResult),
      close: vi.fn(),
      listOpen: vi.fn().mockResolvedValue([workspaceInfo]),
      listRecent: vi.fn().mockResolvedValue([]),
      dismissRecent: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue(openWorkspaceResult),
      signIn: vi.fn().mockResolvedValue(openWorkspaceResult),
      signOut: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue(workspaceSession),
      listUsers: vi.fn().mockResolvedValue(workspaceUsers),
      createUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      updateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      activateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      deactivateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      resetUserPassword: vi.fn().mockResolvedValue(workspaceUsers[0]),
      getDashboard: vi.fn().mockResolvedValue(defaultDashboard),
      getDashboardLayout: vi.fn().mockResolvedValue(DEFAULT_DASHBOARD_LAYOUT),
      listActivity: vi.fn().mockResolvedValue([]),
      updateSettings: vi.fn(),
      updateDashboardLayout: vi.fn().mockResolvedValue(DEFAULT_DASHBOARD_LAYOUT),
      listBackups: vi.fn().mockResolvedValue([]),
      createBackup: vi.fn(),
      getRestorePreview: vi.fn(),
      getRestoreDiff: vi.fn(),
      restoreBackup: vi.fn(),
      integrityCheck: vi.fn(),
      onFilesystemDrift: vi.fn().mockImplementation(() => () => undefined)
    },
    dialogs: {
      pickWorkspaceCreatePath: vi.fn(),
      pickWorkspaceOpenPath: vi.fn(),
      pickWorkspaceLogoFile: vi.fn(),
      pickDocumentFiles: vi.fn(),
      resolveDroppedFilePaths: vi.fn()
    },
    documents: {
      list: vi.fn(),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createVersion: vi.fn(),
      updateLatestVersion: vi.fn(),
      updateVersion: vi.fn(),
      deleteVersion: vi.fn(),
      addVersionFiles: vi.fn(),
      renameVersionFile: vi.fn(),
      deleteVersionFile: vi.fn(),
      changeVersionFileRole: vi.fn(),
      syncVersionFiles: vi.fn(),
      getVersionFilesystemPreview: vi.fn(),
      applyVersionFilesystemReconciliation: vi.fn(),
      openVersionFile: vi.fn(),
      openDocumentFolder: vi.fn(),
      openVersionFolder: vi.fn(),
      openStoredPath: vi.fn(),
      export: vi.fn(),
      previewVersionFile: vi.fn(),
      compareVersions: vi.fn(),
      planVersionFileImport: vi.fn(),
      reconcileUnmanagedPath: vi.fn(),
      ignoreUnmanagedPath: vi.fn()
    },
    savedViews: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      duplicate: vi.fn(),
      promoteToShared: vi.fn()
    },
    documentTypes: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    projects: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    templates: {
      list: vi.fn(),
      create: vi.fn(),
      addFiles: vi.fn(),
      delete: vi.fn()
    },
    confidentialityClasses: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    languages: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    appSettings: {
      get: vi.fn().mockResolvedValue(applicationSettings),
      update: vi.fn().mockImplementation(async (settings: ApplicationSettings) => settings)
    },
    appUpdates: {
      getState: vi.fn().mockResolvedValue({
        status: 'idle',
        currentVersion: '0.1.0',
        isSupported: true,
        message: 'Ready to check for updates.',
        release: null,
        progress: null,
        lastCheckedAt: null,
        lastCheckSource: null,
        lastUpdatedAt: '2026-04-02T10:00:00.000Z'
      }),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      onStateChange: vi.fn().mockImplementation(() => () => undefined)
    }
  };

  window.docTrack = docTrack;
  return docTrack;
};

describe('useAppStore', () => {
  it('reopens the most recent workspace during bootstrap and applies the default workspace view', async () => {
    const docTrack = installDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      launchBehavior: 'reopen-last-workspace',
      defaultWorkspaceView: 'documentTypes',
      defaultDocumentsVisualization: 'timeline'
    });
    docTrack.workspace.listRecent.mockResolvedValueOnce([
      {
        rootPath: workspaceInfo.rootPath,
        name: workspaceInfo.name,
        lastOpenedDate: '2026-03-28T12:00:00.000Z'
      }
    ]);
    docTrack.workspace.listOpen
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([workspaceInfo]);

    const store = createAppStore();

    await store.getState().bootstrap();

    expect(docTrack.workspace.open).toHaveBeenCalledWith(workspaceInfo.rootPath);
    expect(store.getState().activeWorkspacePath).toBe(workspaceInfo.rootPath);
    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedView).toBe(
      'documentTypes'
    );
    expect(
      store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedDocumentsVisualization
    ).toBe('timeline');
    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.documentViewState).toEqual(
      DEFAULT_DOCUMENT_VIEW_STATE
    );
  });

  it('can persist templates as the default workspace view', async () => {
    const docTrack = installDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      defaultWorkspaceView: 'templates'
    });
    const store = createAppStore();

    await store.getState().bootstrap();

    expect(docTrack.workspace.getSummary).toHaveBeenCalledWith(workspaceInfo.rootPath);
    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedView).toBe(
      'templates'
    );
    expect(
      store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedDocumentsVisualization
    ).toBe(DEFAULT_APPLICATION_SETTINGS.defaultDocumentsVisualization);
  });

  it('updates application settings through the shared IPC surface', async () => {
    const docTrack = installDocTrackMock();
    const store = createAppStore();
    const nextSettings: ApplicationSettings = {
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'dark',
      documentTableDensity: 'compact'
    };

    await store.getState().updateApplicationSettings(nextSettings);

    expect(docTrack.appSettings.update).toHaveBeenCalledWith(nextSettings);
    expect(store.getState().applicationSettings).toEqual(nextSettings);
  });

  it('updates workspace settings through the shared IPC surface using the combined settings payload', async () => {
    const docTrack = installDocTrackMock();
    docTrack.workspace.updateSettings.mockResolvedValue(openWorkspaceResult);
    const store = createAppStore();

    await store.getState().updateWorkspaceSettings(workspaceInfo.rootPath, {
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        companyLogoPath: 'Database/branding/company-logo.png'
      },
      companyLogoSourceFilePath: 'C:\\logos\\company.png',
      clearCompanyLogo: false
    });

    expect(docTrack.workspace.updateSettings).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        settings: expect.objectContaining({
          companyLogoPath: 'Database/branding/company-logo.png'
        }),
        companyLogoSourceFilePath: 'C:\\logos\\company.png',
        clearCompanyLogo: false
      })
    );
  });

  it('applies a saved view into the active workspace document state', async () => {
    installDocTrackMock();
    const store = createAppStore();
    const savedView: SavedView = {
      id: 'view-1',
      name: 'Released this month',
      scope: 'shared',
      query: {
        search: '',
        statusFilter: 'Released',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: [
          {
            id: 'rule-1',
            field: 'releasedDate',
            operator: 'thisMonth'
          }
        ]
      },
      presentation: {
        visualizationMode: 'timeline',
        sorting: [
          {
            column: 'releasedDate',
            desc: true
          }
        ]
      },
      createdDate: '2026-04-06T09:00:00.000Z',
      modifiedDate: '2026-04-06T09:00:00.000Z'
    };

    await store.getState().bootstrap();
    store.getState().applySavedView(workspaceInfo.rootPath, savedView);

    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedView).toBe('documents');
    expect(
      store.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedDocumentsVisualization
    ).toBe('timeline');
    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.documentViewState).toEqual({
      search: '',
      statusFilter: 'Released',
      projectFilter: 'All',
      healthFilter: 'All',
      rules: [
        {
          id: 'rule-1',
          field: 'releasedDate',
          operator: 'thisMonth'
        }
      ],
      sorting: [
        {
          column: 'releasedDate',
          desc: true
        }
      ]
    });
  });

  it('updates the shared dashboard layout in workspace state', async () => {
    const docTrack = installDocTrackMock();
    const nextLayout = {
      widgets: [
        {
          id: 'saved-view-widget',
          type: 'savedView' as const,
          title: 'Pinned',
          x: 0,
          y: 0,
          w: 6,
          h: 2,
          config: {},
          savedViewId: 'view-1'
        }
      ]
    };
    docTrack.workspace.updateDashboardLayout.mockResolvedValue(nextLayout);
    const store = createAppStore();

    await store.getState().bootstrap();
    await store.getState().updateDashboardLayout(workspaceInfo.rootPath, {
      layout: nextLayout
    });

    expect(docTrack.workspace.updateDashboardLayout).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      { layout: nextLayout }
    );
    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.dashboardLayout).toEqual(
      nextLayout
    );
  });

  it('resets stale status filters when a refreshed workspace lifecycle removes them', async () => {
    const docTrack = installDocTrackMock();
    const store = createAppStore();

    await store.getState().bootstrap();
    store.getState().setDocumentViewState(workspaceInfo.rootPath, (current) => ({
      ...current,
      statusFilter: 'Archived'
    }));

    const refreshedWorkspaceResult: OpenWorkspaceResult = {
      ...openWorkspaceResult,
      summary: {
        ...openWorkspaceResult.summary,
        lifecycle: {
          mode: 'custom',
          statuses: [
            {
              key: 'draft',
              name: 'Draft',
              role: 'draft',
              sortOrder: 0,
              requiresReleasedDate: false,
              requiresReviewedBy: false,
              requiresApprovedBy: false
            },
            {
              key: 'released',
              name: 'Released',
              role: 'released',
              sortOrder: 1,
              requiresReleasedDate: false,
              requiresReviewedBy: false,
              requiresApprovedBy: false
            }
          ],
          initialStatusKey: 'draft',
          autoPreviousVersionStatusKey: 'released',
          allowedTransitions: [{ fromStatusKey: 'draft', toStatusKey: 'released' }]
        },
        statuses: ['Draft', 'Released']
      }
    };
    docTrack.workspace.getSummary.mockResolvedValue(refreshedWorkspaceResult);

    await store.getState().refreshWorkspace(workspaceInfo.rootPath);

    expect(store.getState().openWorkspaces[workspaceInfo.rootPath]?.documentViewState.statusFilter).toBe(
      'All'
    );
  });
});
