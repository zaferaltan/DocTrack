// @vitest-environment jsdom

import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import type { OpenWorkspaceResult, WorkspaceInfo } from '@shared/types';
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

const openWorkspaceResult: OpenWorkspaceResult = {
  workspace: workspaceInfo,
  summary: {
    workspace: workspaceInfo,
    settings: DEFAULT_WORKSPACE_SETTINGS,
    documents: [],
    dashboard: defaultDashboard,
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
    statuses: ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete']
  }
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
      getDashboard: vi.fn().mockResolvedValue(defaultDashboard),
      listActivity: vi.fn().mockResolvedValue([]),
      updateSettings: vi.fn(),
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
      defaultWorkspaceView: 'documentTypes'
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
});
