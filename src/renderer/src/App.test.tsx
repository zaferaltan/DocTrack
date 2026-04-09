// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import type { AppUpdateState } from '@shared/appUpdates';
import { createDefaultWorkspaceLifecycle, type WorkspaceLifecycle } from '@shared/documentLifecycle';
import type { DocTrackApi } from '@shared/ipc';
import { DEFAULT_DASHBOARD_LAYOUT, DEFAULT_DOCUMENT_VIEW_STATE } from '@shared/savedViews';
import type {
  DocumentDetail,
  OpenWorkspaceResult,
  WorkspaceInfo,
  WorkspaceSession,
  WorkspaceUser
} from '@shared/types';
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/workspaceLayout';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@renderer/App';
import { useAppStore } from '@renderer/store/useAppStore';

const workspaceInfo: WorkspaceInfo = {
  id: 1,
  name: 'Quality',
  rootPath: '/Workspaces/Quality',
  createdDate: '2026-03-28T10:00:00.000Z',
  isOpen: true
};

const defaultDashboard = {
  generatedDate: '2026-03-31T12:00:00.000Z',
  totalDocuments: 1,
  countsByStatus: [
    { id: 'draft', label: 'Draft', count: 1, tone: 'warning' as const, status: 'Draft' as const }
  ],
  countsByType: [{ id: 'Procedure', label: 'Procedure', count: 1 }],
  countsByProject: [{ id: 'no-project', label: 'No project', count: 1, projectId: null }],
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
    archived: false,
    linkedRecordCount: 0,
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
    documents: [
      {
        id: 101,
        documentId: '02202600001',
        title: 'Operating Procedure',
        typeId: 2,
        typeName: 'Procedure',
        versionScheme: 'numeric-3',
        status: 'Draft',
        latestVersionLabel: '001',
        effectiveDate: null,
        releasedDate: null,
        approvedBy: '',
        revisionDescription: '',
        modifiedDate: '2026-03-28T10:00:00.000Z',
        createdDate: '2026-03-28T09:00:00.000Z',
        author: 'Jordan Singh',
        languageId: 1,
        languageCode: 'EN',
        confidentialityClassId: null,
        confidentialityClassName: null,
        projectId: null,
        projectName: null,
        company: 'Acme',
        department: 'Quality',
        startDate: '2026-03-28',
        revisionIntervalMonths: 12,
        nextReviewDate: '2027-03-28T10:00:00.000Z',
        isOverdue: false,
        healthFlags: [],
        latestVersionFileCount: 1,
        lastActivityDate: '2026-03-28T10:00:00.000Z',
        reviewedBy: ''
      }
    ],
    dashboard: defaultDashboard,
    dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
    documentTypes: [
      {
        id: 1,
        name: 'Specification',
        numberPrefix: '01'
      },
      {
        id: 2,
        name: 'Procedure',
        numberPrefix: '02'
      }
    ],
    projects: [],
    templates: [],
    confidentialityClasses: [],
    languages: [
      {
        id: 1,
        code: 'EN'
      }
    ],
    statuses: ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete'],
    savedViews: []
  },
  session: workspaceSession
};

const cloneWorkspaceResult = (): OpenWorkspaceResult =>
  JSON.parse(JSON.stringify(openWorkspaceResult)) as OpenWorkspaceResult;

const buildCustomWorkspaceLifecycle = (): WorkspaceLifecycle => ({
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
      key: 'in-review',
      name: 'In Review',
      role: 'review',
      sortOrder: 1,
      requiresReleasedDate: false,
      requiresReviewedBy: true,
      requiresApprovedBy: false
    },
    {
      key: 'released',
      name: 'Released',
      role: 'released',
      sortOrder: 2,
      requiresReleasedDate: true,
      requiresReviewedBy: true,
      requiresApprovedBy: true
    },
    {
      key: 'archived',
      name: 'Archived',
      role: 'archived',
      sortOrder: 3,
      requiresReleasedDate: false,
      requiresReviewedBy: false,
      requiresApprovedBy: false
    }
  ],
  initialStatusKey: 'draft',
  autoPreviousVersionStatusKey: 'archived',
  allowedTransitions: [
    { fromStatusKey: 'draft', toStatusKey: 'in-review' },
    { fromStatusKey: 'in-review', toStatusKey: 'released' },
    { fromStatusKey: 'released', toStatusKey: 'archived' }
  ]
});

const buildDocumentDetail = (overrides: Partial<DocumentDetail> = {}): DocumentDetail => ({
  id: 101,
  documentId: '02202600001',
  title: 'Operating Procedure',
  typeId: 2,
  typeName: 'Procedure',
  versionScheme: 'numeric-3',
  documentFolderPath: 'Documents/Procedure/02202600001',
  createdDate: '2026-03-28T09:00:00.000Z',
  modifiedDate: '2026-03-28T10:00:00.000Z',
  author: 'Jordan Singh',
  languageId: 1,
  languageCode: 'EN',
  confidentialityClassId: null,
  confidentialityClassName: null,
  projectId: null,
  projectName: null,
  company: 'Acme',
  department: 'Quality',
  startDate: '2026-03-28',
  revisionIntervalMonths: 12,
  versions: [
    {
      id: 201,
      documentId: 101,
      versionDocumentId: '02202600001',
      sequenceNumber: 1,
      versionLabel: '001',
      status: 'Draft',
      releasedDate: null,
      reviewedBy: '',
      approvedBy: '',
      createdDate: '2026-03-28T10:00:00.000Z',
      revisionDescription: '',
      files: [],
      unmanagedPaths: [],
      filesystemState: 'clean',
      filesystemChanges: []
    }
  ],
  ...overrides
});

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

const defaultAppUpdateState: AppUpdateState = {
  status: 'idle',
  currentVersion: '0.1.0',
  isSupported: true,
  message: 'Ready to check for updates.',
  release: null,
  progress: null,
  lastCheckedAt: null,
  lastCheckSource: null,
  lastUpdatedAt: '2026-04-02T10:00:00.000Z'
};

const resetStore = () => {
  useAppStore.setState({
    openWorkspaces: {},
    activeWorkspacePath: undefined,
    recentWorkspaces: [],
    applicationSettings: { ...DEFAULT_APPLICATION_SETTINGS },
    isBootstrapped: false,
    notification: undefined
  });
};

const setStoreState = async (
  partial:
    | Partial<ReturnType<typeof useAppStore.getState>>
    | ((
        state: ReturnType<typeof useAppStore.getState>
      ) => Partial<ReturnType<typeof useAppStore.getState>>)
) => {
  await act(async () => {
    if (typeof partial === 'function') {
      useAppStore.setState((state) => partial(state as ReturnType<typeof useAppStore.getState>));
      return;
    }

    useAppStore.setState(partial);
  });
  await flushPromises();
};

const buildDocTrackMock = (
  initialSettings: ApplicationSettings = {
    ...DEFAULT_APPLICATION_SETTINGS,
    themeMode: 'light'
  },
  workspaceResult: OpenWorkspaceResult = openWorkspaceResult,
  initialAppUpdateState: AppUpdateState = defaultAppUpdateState
) => {
  let persistedSettings = { ...initialSettings };
  let persistedAppUpdateState = JSON.parse(
    JSON.stringify(initialAppUpdateState)
  ) as AppUpdateState;

  const docTrack = {
    workspace: {
      create: vi.fn().mockResolvedValue(workspaceResult),
      open: vi.fn().mockResolvedValue(workspaceResult),
      close: vi.fn().mockResolvedValue([]),
      listOpen: vi.fn().mockResolvedValue([workspaceInfo]),
      listRecent: vi.fn().mockResolvedValue([
        {
          rootPath: workspaceInfo.rootPath,
          name: workspaceInfo.name,
          lastOpenedDate: '2026-03-28T12:00:00.000Z'
        }
      ]),
      dismissRecent: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue(workspaceResult),
      signIn: vi.fn().mockResolvedValue(workspaceResult),
      signOut: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockResolvedValue(workspaceSession),
      listUsers: vi.fn().mockResolvedValue(workspaceUsers),
      recoverAccess: vi.fn().mockResolvedValue(workspaceResult),
      createUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      updateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      activateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      deactivateUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      deleteUser: vi.fn().mockResolvedValue({ action: 'deleted', userId: workspaceUsers[0].id }),
      unarchiveUser: vi.fn().mockResolvedValue(workspaceUsers[0]),
      resetUserPassword: vi.fn().mockResolvedValue(workspaceUsers[0]),
      updateSettings: vi.fn().mockResolvedValue(workspaceResult)
      ,
      getDashboard: vi.fn().mockResolvedValue(workspaceResult.summary.dashboard),
      getDashboardLayout: vi.fn().mockResolvedValue(workspaceResult.summary.dashboardLayout),
      listActivity: vi.fn().mockResolvedValue(workspaceResult.summary.dashboard.recentActivity),
      updateDashboardLayout: vi.fn().mockResolvedValue(workspaceResult.summary.dashboardLayout),
      listBackups: vi.fn().mockResolvedValue([]),
      createBackup: vi.fn().mockResolvedValue({
        backup: {
          id: 'backup-1',
          label: 'Manual Snapshot',
          createdDate: '2026-03-31T12:00:00.000Z',
          backupPath: '/Workspaces/Quality/Backups/backup-1',
          manifestPath: '/Workspaces/Quality/Backups/backup-1/manifest.json',
          workspaceName: 'Quality',
          documentCount: 1,
          versionCount: 1,
          fileCount: 1,
          sizeBytes: 1024,
          reason: 'manual'
        }
      }),
      getRestorePreview: vi.fn().mockResolvedValue({
        backup: {
          id: 'backup-1',
          label: 'Manual Snapshot',
          createdDate: '2026-03-31T12:00:00.000Z',
          backupPath: '/Workspaces/Quality/Backups/backup-1',
          manifestPath: '/Workspaces/Quality/Backups/backup-1/manifest.json',
          workspaceName: 'Quality',
          documentCount: 1,
          versionCount: 1,
          fileCount: 1,
          sizeBytes: 1024,
          reason: 'manual'
        },
        suggestedWorkspaceName: 'Quality Restored',
        destinationRootPath: '/Workspaces/Quality Restored',
        destinationExists: false
      }),
      getRestoreDiff: vi.fn().mockResolvedValue({
        backup: {
          id: 'backup-1',
          label: 'Manual Snapshot',
          createdDate: '2026-03-31T12:00:00.000Z',
          backupPath: '/Workspaces/Quality/Backups/backup-1',
          manifestPath: '/Workspaces/Quality/Backups/backup-1/manifest.json',
          workspaceName: 'Quality',
          documentCount: 1,
          versionCount: 1,
          fileCount: 1,
          sizeBytes: 1024,
          reason: 'manual'
        },
        generatedDate: '2026-03-31T12:00:00.000Z',
        sections: [],
        totals: {
          addedCount: 0,
          removedCount: 0,
          changedCount: 0
        }
      }),
      restoreBackup: vi.fn().mockResolvedValue(workspaceResult),
      integrityCheck: vi.fn().mockResolvedValue({
        checkedDate: '2026-03-31T12:00:00.000Z',
        issueCount: 0,
        issues: []
      }),
      onFilesystemDrift: vi.fn().mockImplementation(() => () => undefined)
    },
    dialogs: {
      pickWorkspaceCreatePath: vi.fn().mockResolvedValue(null),
      pickWorkspaceOpenPath: vi.fn().mockResolvedValue(null),
      pickWorkspaceLogoFile: vi.fn().mockResolvedValue(null),
      pickDocumentFiles: vi.fn().mockResolvedValue([]),
      resolveDroppedFilePaths: vi.fn().mockResolvedValue([])
    },
    documents: {
      list: vi.fn().mockResolvedValue(workspaceResult.summary.documents),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
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
      openVersionFile: vi.fn().mockResolvedValue(undefined),
      openDocumentFolder: vi.fn().mockResolvedValue(undefined),
      openVersionFolder: vi.fn().mockResolvedValue(undefined),
      openStoredPath: vi.fn().mockResolvedValue(undefined),
      export: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: '/Exports/quality-documents-2026-03-31.csv'
      }),
      previewVersionFile: vi.fn().mockResolvedValue({
        fileId: 1,
        fileName: 'procedure.pdf',
        filePath: 'Documents/Procedure/02202600001/001/procedure.pdf',
        absolutePath: '/Workspaces/Quality/Documents/Procedure/02202600001/001/procedure.pdf',
        kind: 'pdf',
        isSupported: true,
        previewUrl: 'file:///procedure.pdf',
        textContent: null,
        warning: null
      }),
      compareVersions: vi.fn().mockResolvedValue({
        currentVersionId: 201,
        previousVersionId: 200,
        currentVersionLabel: '002',
        previousVersionLabel: '001',
        deltas: [],
        unchangedCount: 0
      }),
      planVersionFileImport: vi.fn().mockResolvedValue({
        versionId: 201,
        suggestedRole: 'working',
        hasBlockingDuplicates: false,
        warnings: [],
        candidates: []
      }),
      reconcileUnmanagedPath: vi.fn(),
      ignoreUnmanagedPath: vi.fn()
    },
    savedViews: {
      list: vi.fn().mockResolvedValue(workspaceResult.summary.savedViews),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      duplicate: vi.fn(),
      promoteToShared: vi.fn()
    },
    documentTypes: {
      list: vi.fn().mockResolvedValue(workspaceResult.summary.documentTypes),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    projects: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    templates: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      addFiles: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    confidentialityClasses: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    languages: {
      list: vi.fn().mockResolvedValue(workspaceResult.summary.languages),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    appSettings: {
      get: vi.fn().mockImplementation(async () => ({ ...persistedSettings })),
      update: vi.fn().mockImplementation(async (settings: ApplicationSettings) => {
        persistedSettings = { ...settings };
        return { ...persistedSettings };
      })
    },
    appUpdates: {
      getState: vi.fn().mockImplementation(
        async () =>
          JSON.parse(JSON.stringify(persistedAppUpdateState)) as AppUpdateState
      ),
      checkForUpdates: vi.fn().mockImplementation(
        async () =>
          JSON.parse(JSON.stringify(persistedAppUpdateState)) as AppUpdateState
      ),
      downloadUpdate: vi.fn().mockImplementation(
        async () =>
          JSON.parse(JSON.stringify(persistedAppUpdateState)) as AppUpdateState
      ),
      quitAndInstall: vi.fn().mockResolvedValue(undefined),
      onStateChange: vi.fn().mockImplementation(() => () => undefined)
    }
  } satisfies DocTrackApi;

  window.docTrack = docTrack;
  return docTrack;
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderApp = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  await act(async () => {
    root.render(<App />);
  });
  await flushPromises();

  return {
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
};

const getButton = (label: string, root: ParentNode = document.body): HTMLButtonElement => {
  const button = [...root.querySelectorAll('button')].find((element) =>
    normalizeText(element.textContent).includes(label)
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Unable to find button: ${label}`);
  }

  return button;
};

const getDialog = (): HTMLElement => {
  const dialog = document.body.querySelector('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) {
    throw new Error('Unable to find an open dialog.');
  }

  return dialog;
};

const getLastDialog = (): HTMLElement => {
  const dialogs = [...document.body.querySelectorAll('[role="dialog"]')];
  const dialog = dialogs.at(-1);
  if (!(dialog instanceof HTMLElement)) {
    throw new Error('Unable to find an open dialog.');
  }

  return dialog;
};

const getLabeledControl = (
  root: ParentNode,
  labelText: string,
  selector: string
): HTMLElement => {
  const label = [...root.querySelectorAll('label')].find((element) =>
    normalizeText(element.textContent).includes(labelText)
  );

  if (!label) {
    throw new Error(`Unable to find label: ${labelText}`);
  }

  const control = label.querySelector(selector);
  if (!(control instanceof HTMLElement)) {
    throw new Error(`Unable to find control "${selector}" for label: ${labelText}`);
  }

  return control;
};

const click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
  await flushPromises();
};

const changeInput = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    setValue?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushPromises();
};

const changeCheckbox = async (element: HTMLInputElement, checked: boolean) => {
  await act(async () => {
    if (element.checked !== checked) {
      element.click();
    }
  });
  await flushPromises();
};

const changeSelect = async (element: HTMLSelectElement, value: string) => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value'
    )?.set;
    setValue?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flushPromises();
};

const getDocumentsVisualizationButton = (
  mode: 'table' | 'kanban' | 'timeline' | 'calendar'
): HTMLButtonElement => {
  const button = document.querySelector(
    `[data-documents-visualization-button="${mode}"]`
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Unable to find visualization button: ${mode}`);
  }

  return button;
};

const createDragDataTransfer = () => {
  const values = new Map<string, string>();

  return {
    effectAllowed: 'all',
    dropEffect: 'move',
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? ''
  };
};

const dispatchDragEvent = async (
  element: HTMLElement,
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend',
  dataTransfer: ReturnType<typeof createDragDataTransfer>
) => {
  await act(async () => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: dataTransfer
    });
    element.dispatchEvent(event);
  });
  await flushPromises();
};

const dispatchPointerEvent = async (
  target: HTMLElement | Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number
) => {
  await act(async () => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }));
  });
  await flushPromises();
};

const dispatchKeyboardEvent = async (
  target: HTMLElement | Window,
  key: string,
  options: KeyboardEventInit = {}
) => {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key,
        ...options
      })
    );
  });
  await flushPromises();
};

const waitForAnimationFrame = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
  await flushPromises();
};

describe('App', () => {
  beforeEach(() => {
    // @ts-expect-error React act environment flag for tests.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    document.documentElement.className = '';
    resetStore();
    vi.useFakeTimers();
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    document.documentElement.className = '';
    resetStore();
  });

  it('previews theme changes and uses saved application defaults in creation dialogs', async () => {
    const docTrack = buildDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'light'
    });
    const view = await renderApp();

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await click(getButton('Settings'));
    await click(getButton('Dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await click(getButton('Cancel'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await click(getButton('Settings'));
    const settingsDialog = getDialog();
    expect(getButton('Light', settingsDialog).closest('label')).toBeNull();
    await click(getButton('Dark', settingsDialog));
    await changeSelect(
      getLabeledControl(
        settingsDialog,
        'Default Document Version Scheme',
        'select'
      ) as HTMLSelectElement,
      'alpha-uppercase'
    );
    await changeCheckbox(
      getLabeledControl(
        settingsDialog,
        'Seed starter data in new workspaces',
        'input[type="checkbox"]'
      ) as HTMLInputElement,
      false
    );
    await changeSelect(
      getLabeledControl(settingsDialog, 'Document Table Density', 'select') as HTMLSelectElement,
      'compact'
    );
    await changeSelect(
      getLabeledControl(settingsDialog, 'Default Documents View', 'select') as HTMLSelectElement,
      'calendar'
    );
    await click(getButton('Save Settings'));

    expect(docTrack.appSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        themeMode: 'dark',
        defaultDocumentVersionScheme: 'alpha-uppercase',
        defaultIncludeExampleData: false,
        documentTableDensity: 'compact',
        defaultDocumentsVisualization: 'calendar'
      })
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await click(getButton('New Document'));
    const documentDialog = getDialog();
    const authorSelect = getLabeledControl(documentDialog, 'Author', 'select') as HTMLSelectElement;
    const versionSchemeSelect = getLabeledControl(
      documentDialog,
      'Version Scheme',
      'select'
    ) as HTMLSelectElement;
    expect(authorSelect.value).toBe(String(workspaceSession.user.id));
    expect(versionSchemeSelect.value).toBe('alpha-uppercase');
    await click(getButton('Cancel'));

    await click(getButton('New Workspace'));
    const workspaceDialog = getDialog();
    const includeExampleData = getLabeledControl(
      workspaceDialog,
      'Seed starter data',
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(includeExampleData.checked).toBe(false);
    await click(getButton('Cancel'));

    const firstHeaderCell = document.querySelector('thead th');
    expect(firstHeaderCell?.className).toContain('py-2');

    await view.unmount();
  });

  it('opens the command palette with Mod+K and shows the shortcut in settings', async () => {
    buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Settings'));
    const settingsDialog = getDialog();
    expect(normalizeText(settingsDialog.textContent)).toContain('Open Command Palette');
    await click(getButton('Cancel', settingsDialog));

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    const palette = getDialog();
    expect(normalizeText(palette.textContent)).toContain('Command Palette');
    const searchInput = palette.querySelector('input[aria-label="Command search"]');
    expect(searchInput).toBeInstanceOf(HTMLInputElement);

    await dispatchKeyboardEvent(searchInput as HTMLInputElement, 'Escape');

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    await view.unmount();
  });

  it('shows global and recent-workspace commands when no workspace is open', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.workspace.listOpen = vi.fn().mockResolvedValue([]);
    docTrack.workspace.listRecent = vi.fn().mockResolvedValue([
      {
        rootPath: '/Workspaces/Quality',
        name: 'Quality',
        lastOpenedDate: '2026-03-28T12:00:00.000Z'
      }
    ]);

    const view = await renderApp();

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    const palette = getDialog();
    const paletteText = normalizeText(palette.textContent);
    expect(paletteText).toContain('Open Settings');
    expect(paletteText).toContain('Create Workspace');
    expect(paletteText).toContain('Open Workspace Folder');
    expect(paletteText).toContain('Open Recent Workspace: Quality');
    expect(paletteText).not.toContain('Create Document');
    expect(paletteText).not.toContain('Open Workspace Settings');

    await view.unmount();
  });

  it('shows workspace commands, filters unsupported views, and dedupes open workspaces from recents', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...workspaceResult.summary.settings,
      visibleDocumentColumns: ['documentId', 'title', 'documentType', 'version', 'status']
    };

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );

    const view = await renderApp();
    const secondaryWorkspace = cloneWorkspaceResult();
    secondaryWorkspace.workspace = {
      ...workspaceInfo,
      id: 2,
      name: 'Safety',
      rootPath: '/Workspaces/Safety'
    };
    secondaryWorkspace.summary.workspace = secondaryWorkspace.workspace;

    await setStoreState((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [secondaryWorkspace.workspace.rootPath]: {
          ...secondaryWorkspace.summary,
          users: secondaryWorkspace.summary.users ?? [],
          authKind: 'authenticated',
          canRecoverAccess: false,
          session: workspaceSession,
          selectedView: 'documents',
          selectedDocumentsVisualization: 'table',
          documentViewState: { ...DEFAULT_DOCUMENT_VIEW_STATE }
        }
      },
      recentWorkspaces: [
        {
          rootPath: '/Workspaces/Safety',
          name: 'Safety',
          lastOpenedDate: '2026-03-28T13:00:00.000Z'
        },
        {
          rootPath: '/Workspaces/Closed',
          name: 'Closed',
          lastOpenedDate: '2026-03-27T12:00:00.000Z'
        }
      ]
    }));

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    const paletteText = normalizeText(getDialog().textContent);
    expect(paletteText).toContain('Switch to Workspace: Safety');
    expect(paletteText).not.toContain('Open Recent Workspace: Safety');
    expect(paletteText).toContain('Open Recent Workspace: Closed');
    expect(paletteText).toContain('Open Workspace Settings');
    expect(paletteText).toContain('Open Backups & Recovery');
    expect(paletteText).toContain('Show Activity Log');
    expect(paletteText).toContain('Create Document');
    expect(paletteText).toContain('Export Report');
    expect(paletteText).toContain('Go to Dashboard');
    expect(paletteText).toContain('Go to Documents');
    expect(paletteText).toContain('Go to Templates');
    expect(paletteText).toContain('Go to Document Types');
    expect(paletteText).not.toContain('Go to Projects');
    expect(paletteText).not.toContain('Go to Classifications');
    expect(paletteText).not.toContain('Go to Languages');

    await view.unmount();
  });

  it('uses the selected document directly and otherwise opens document pickers for version and import commands', async () => {
    vi.useRealTimers();
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());

    const view = await renderApp();

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });
    let palette = getDialog();
    expect(normalizeText(palette.textContent)).toContain('Create Version...');
    expect(normalizeText(palette.textContent)).toContain('Import File...');

    await click(getButton('Create Version...', palette));
    palette = getDialog();
    expect(normalizeText(palette.textContent)).toContain('Choose Document for Create Version');
    expect(normalizeText(palette.textContent)).toContain('Operating Procedure');

    let backButton = palette.querySelector('button[aria-label="Back"]');
    if (!(backButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find the command palette back button.');
    }
    await click(backButton);
    palette = getDialog();

    await click(getButton('Import File...', palette));
    palette = getDialog();
    expect(normalizeText(palette.textContent)).toContain('Choose Document for Import File');

    backButton = palette.querySelector('button[aria-label="Back"]');
    if (!(backButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find the command palette back button.');
    }
    await click(backButton);

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    palette = getDialog();
    const paletteText = normalizeText(palette.textContent);
    expect(paletteText).toContain('Create Version for 02202600001');
    expect(paletteText).toContain('Import File into 02202600001');
    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });

    await view.unmount();
  });

  it('imports files into the latest version from the command palette', async () => {
    vi.useRealTimers();
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());
    docTrack.dialogs.pickDocumentFiles = vi
      .fn()
      .mockResolvedValue(['/incoming/procedure.docx']);
    docTrack.documents.planVersionFileImport = vi.fn().mockResolvedValue({
      versionId: 201,
      suggestedRole: 'working',
      hasBlockingDuplicates: false,
      warnings: [],
      candidates: []
    });

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });
    await click(getButton('Import File into 02202600001', getDialog()));
    await waitForAnimationFrame();

    expect(docTrack.dialogs.pickDocumentFiles).toHaveBeenCalledTimes(1);
    expect(docTrack.documents.planVersionFileImport).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      201,
      ['/incoming/procedure.docx']
    );
    expect(normalizeText(getLastDialog().textContent)).toContain('Show Files');
    expect(normalizeText(getLastDialog().textContent)).toContain('/incoming/procedure.docx');

    await view.unmount();
  });

  it('opens export report from the command palette with PDF workspace defaults', async () => {
    vi.useRealTimers();
    buildDocTrackMock();
    const view = await renderApp();

    await setStoreState((state) => ({
      openWorkspaces: {
        ...state.openWorkspaces,
        [workspaceInfo.rootPath]: {
          ...state.openWorkspaces[workspaceInfo.rootPath],
          selectedView: 'dashboard',
          selectedDocumentsVisualization:
            state.openWorkspaces[workspaceInfo.rootPath]?.selectedDocumentsVisualization ?? 'table'
        }
      }
    }));

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });
    await click(getButton('Export Report', getDialog()));
    await waitForAnimationFrame();

    expect(useAppStore.getState().openWorkspaces[workspaceInfo.rootPath]?.selectedView).toBe('documents');

    const exportDialog = getLastDialog();
    expect(
      (getLabeledControl(exportDialog, 'Format', 'select') as HTMLSelectElement).value
    ).toBe('pdf');
    expect(
      (getLabeledControl(exportDialog, 'Scope', 'select') as HTMLSelectElement).value
    ).toBe('whole-workspace');

    await view.unmount();
  });

  it('supports arrow navigation, Enter, and empty search results in the command palette', async () => {
    vi.useRealTimers();
    buildDocTrackMock();
    const view = await renderApp();

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });
    let palette = getDialog();
    const searchInput = palette.querySelector('input[aria-label="Command search"]');
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error('Unable to find the command palette search input.');
    }

    await dispatchKeyboardEvent(searchInput, 'ArrowDown');
    await dispatchKeyboardEvent(searchInput, 'Enter');
    await waitForAnimationFrame();

    expect(normalizeText(getLastDialog().textContent)).toContain('Create Workspace');
    await click(getButton('Cancel', getLastDialog()));

    await dispatchKeyboardEvent(window, 'k', { ctrlKey: true });
    palette = getDialog();
    await changeInput(
      palette.querySelector('input[aria-label="Command search"]') as HTMLInputElement,
      'no-such-command'
    );

    expect(normalizeText(getDialog().textContent)).toContain('No commands match your search.');

    await view.unmount();
  });

  it('saves updater preferences through the application settings dialog', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Settings'));
    const dialog = getDialog();

    await changeCheckbox(
      getLabeledControl(dialog, 'Enable automatic updates', 'input[type="checkbox"]') as HTMLInputElement,
      false
    );
    await changeCheckbox(
      getLabeledControl(
        dialog,
        'Check for updates on launch',
        'input[type="checkbox"]'
      ) as HTMLInputElement,
      false
    );
    await click(getButton('Save Settings', dialog));

    expect(docTrack.appSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        autoUpdateEnabled: false,
        checkForUpdatesOnLaunch: false
      })
    );

    await view.unmount();
  });

  it('checks for application updates from the settings dialog', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Settings'));
    await click(getButton('Check for Updates', getDialog()));

    expect(docTrack.appUpdates.checkForUpdates).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('downloads an available application update from the settings dialog', async () => {
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      openWorkspaceResult,
      {
        ...defaultAppUpdateState,
        status: 'available',
        message: 'DocTrack 0.2.0 is available to download.',
        release: {
          version: '0.2.0',
          releaseName: '0.2.0',
          releaseDate: '2026-04-02T10:00:00.000Z',
          releaseNotes: 'A new build is ready.'
        }
      }
    );
    const view = await renderApp();

    await click(getButton('Settings'));
    await click(getButton('Download Update', getDialog()));

    expect(docTrack.appUpdates.downloadUpdate).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('prompts to download an update discovered during the launch check', async () => {
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      openWorkspaceResult,
      {
        ...defaultAppUpdateState,
        status: 'available',
        message: 'DocTrack 0.2.0 is available to download.',
        release: {
          version: '0.2.0',
          releaseName: '0.2.0',
          releaseDate: '2026-04-02T10:00:00.000Z',
          releaseNotes: 'A new build is ready.'
        },
        lastCheckedAt: '2026-04-02T10:00:00.000Z',
        lastCheckSource: 'launch'
      }
    );
    const view = await renderApp();

    const dialog = getLastDialog();
    expect(normalizeText(dialog.textContent)).toContain('Update Available');
    expect(normalizeText(dialog.textContent)).toContain(
      'DocTrack 0.2.0 is available. Download it now?'
    );

    await click(getButton('Download Update', dialog));

    expect(docTrack.appUpdates.downloadUpdate).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('prompts to install after a launch-discovered update finishes downloading', async () => {
    let appUpdateStateListener: ((state: AppUpdateState) => void) | undefined;
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      openWorkspaceResult,
      {
        ...defaultAppUpdateState,
        status: 'available',
        message: 'DocTrack 0.2.0 is available to download.',
        release: {
          version: '0.2.0',
          releaseName: '0.2.0',
          releaseDate: '2026-04-02T10:00:00.000Z',
          releaseNotes: 'A new build is ready.'
        },
        lastCheckedAt: '2026-04-02T10:00:00.000Z',
        lastCheckSource: 'launch'
      }
    );
    docTrack.appUpdates.onStateChange = vi.fn().mockImplementation((listener) => {
      appUpdateStateListener = listener;
      return () => undefined;
    });
    docTrack.appUpdates.downloadUpdate = vi.fn().mockImplementation(async () => {
      const downloadedState: AppUpdateState = {
        ...defaultAppUpdateState,
        status: 'downloaded',
        currentVersion: '0.1.0',
        isSupported: true,
        message: 'DocTrack 0.2.0 is ready to install.',
        release: {
          version: '0.2.0',
          releaseName: '0.2.0',
          releaseDate: '2026-04-02T10:00:00.000Z',
          releaseNotes: 'A new build is ready.'
        },
        progress: null,
        lastCheckedAt: '2026-04-02T10:00:00.000Z',
        lastCheckSource: 'launch',
        lastUpdatedAt: '2026-04-02T10:01:00.000Z'
      };
      await act(async () => {
        appUpdateStateListener?.(downloadedState);
      });
      return downloadedState;
    });
    const view = await renderApp();

    await click(getButton('Download Update', getLastDialog()));

    const dialog = getLastDialog();
    expect(normalizeText(dialog.textContent)).toContain('Install Update');
    expect(normalizeText(dialog.textContent)).toContain(
      'DocTrack 0.2.0 has finished downloading. Restart and install it now?'
    );

    await click(getButton('Install and Restart', dialog));

    expect(docTrack.appUpdates.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(docTrack.appUpdates.quitAndInstall).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('installs a downloaded application update from the settings dialog', async () => {
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      openWorkspaceResult,
      {
        ...defaultAppUpdateState,
        status: 'downloaded',
        message: 'DocTrack 0.2.0 is ready to install.',
        release: {
          version: '0.2.0',
          releaseName: '0.2.0',
          releaseDate: '2026-04-02T10:00:00.000Z',
          releaseNotes: 'A new build is ready.'
        }
      }
    );
    const view = await renderApp();

    await click(getButton('Settings'));
    await click(getButton('Install and Restart', getDialog()));

    expect(docTrack.appUpdates.quitAndInstall).toHaveBeenCalledTimes(1);

    await view.unmount();
  });

  it('shows updater errors when a manual check fails', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.appUpdates.checkForUpdates = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'));
    const view = await renderApp();

    await click(getButton('Settings'));
    await click(getButton('Check for Updates', getDialog()));

    expect(normalizeText(document.body.textContent)).toContain('Network unavailable');

    await view.unmount();
  });

  it('does not show a sidebar width control in application settings', async () => {
    buildDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'light',
      documentDetailViewMode: 'sidebar'
    });
    const view = await renderApp();

    await click(getButton('Settings'));

    expect(normalizeText(getDialog().textContent)).not.toContain('Sidebar Width');

    await view.unmount();
  });

  it('saves workspace version document ID management from workspace settings', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Workspace Settings'));
    const dialog = getDialog();
    await changeSelect(
      getLabeledControl(dialog, 'Version Document ID Management', 'select') as HTMLSelectElement,
      'version-specific-document-id'
    );
    await click(getButton('Save Settings'));

    expect(docTrack.workspace.updateSettings).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        settings: expect.objectContaining({
          versionManagementMode: 'version-specific-document-id'
        })
      })
    );

    await view.unmount();
  });

  it('lets users provide a folder name that differs from the workspace name', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('New Workspace'));
    const workspaceDialog = getDialog();
    expect(workspaceDialog.className).toContain('max-h-[85vh]');

    expect(normalizeText(workspaceDialog.textContent)).not.toContain('Folder Name');

    await changeInput(
      getLabeledControl(workspaceDialog, 'Workspace Name', 'input') as HTMLInputElement,
      'Quality Workspace'
    );
    await changeCheckbox(
      getLabeledControl(
        workspaceDialog,
        'Use a different folder name',
        'input[type="checkbox"]'
      ) as HTMLInputElement,
      true
    );
    await changeInput(
      getLabeledControl(workspaceDialog, 'Folder Name', 'input') as HTMLInputElement,
      'Quality Files'
    );
    await changeInput(
      getLabeledControl(workspaceDialog, 'Workspace Location', 'input') as HTMLInputElement,
      '/Users/you/Documents'
    );
    await changeInput(
      getLabeledControl(workspaceDialog, 'Admin Display Name', 'input') as HTMLInputElement,
      'Taylor Reed'
    );
    await changeInput(
      getLabeledControl(workspaceDialog, 'Admin Password / PIN', 'input') as HTMLInputElement,
      '2468'
    );
    await click(getButton('Create Workspace', workspaceDialog));

    expect(docTrack.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Quality Workspace',
        folderName: 'Quality Files',
        parentPath: '/Users/you/Documents',
        initialAdmin: expect.objectContaining({
          username: 'admin',
          displayName: 'Taylor Reed',
          password: '2468'
        })
      })
    );

    await view.unmount();
  });

  it('shows the lifecycle preset toggle in both workspace dialogs and reveals the custom designer', async () => {
    buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('New Workspace'));
    const createDialog = getDialog();
    expect(normalizeText(createDialog.textContent)).toContain('Document Lifecycle');
    expect(normalizeText(createDialog.textContent)).toContain('Built-in simplified workflow');
    expect(normalizeText(createDialog.textContent)).not.toContain('Add Status');

    await changeSelect(
      getLabeledControl(createDialog, 'Lifecycle Mode', 'select') as HTMLSelectElement,
      'custom'
    );

    expect(normalizeText(createDialog.textContent)).toContain('Add Status');
    expect(normalizeText(createDialog.textContent)).toContain('Allowed Transitions');

    await click(getButton('Cancel', createDialog));
    await click(getButton('Workspace Settings'));

    const settingsDialog = getDialog();
    expect(normalizeText(settingsDialog.textContent)).toContain('Document Lifecycle');
    expect(
      getLabeledControl(settingsDialog, 'Lifecycle Mode', 'select') instanceof HTMLSelectElement
    ).toBe(true);

    await view.unmount();
  });

  it('sends custom lifecycle settings through the workspace settings save flow', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Workspace Settings'));
    const dialog = getDialog();

    await changeSelect(
      getLabeledControl(dialog, 'Lifecycle Mode', 'select') as HTMLSelectElement,
      'custom'
    );
    await click(getButton('Add Status', dialog));
    await click(getButton('Save Settings', dialog));

    expect(docTrack.workspace.updateSettings).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        lifecycle: expect.objectContaining({
          mode: 'custom',
          statuses: expect.arrayContaining([
            expect.objectContaining({ name: 'Status 6' })
          ])
        })
      })
    );

    await view.unmount();
  });

  it('confirms inline status changes from the documents table before applying them', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.documents.updateLatestVersion = vi.fn().mockResolvedValue(
      buildDocumentDetail({
        documentId: '02202600001',
        versions: [
          {
            ...buildDocumentDetail().versions[0]!,
            status: 'Released',
            versionDocumentId: '02202600001'
          }
        ]
      })
    );
    const view = await renderApp();

    const statusSelect = document.querySelector('[data-status-select="101"]');
    if (!(statusSelect instanceof HTMLSelectElement)) {
      throw new Error('Unable to find the inline status select.');
    }

    expect([...statusSelect.options].map((option) => option.value)).toEqual(
      expect.arrayContaining(['Draft', 'Released'])
    );

    await changeSelect(statusSelect, 'Released');
    expect(docTrack.documents.updateLatestVersion).not.toHaveBeenCalled();
    expect(getDialog().textContent).toContain('Confirm Status Change');

    await click(getButton('Apply Status'));

    expect(docTrack.documents.updateLatestVersion).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        documentRecordId: 101,
        status: 'Released'
      })
    );

    await view.unmount();
  });

  it('opens the latest-version dialog when a target status requires missing metadata', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.lifecycle = {
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
          requiresReleasedDate: true,
          requiresReviewedBy: false,
          requiresApprovedBy: false
        }
      ],
      initialStatusKey: 'draft',
      autoPreviousVersionStatusKey: 'released',
      allowedTransitions: [{ fromStatusKey: 'draft', toStatusKey: 'released' }]
    };
    workspaceResult.summary.statuses = ['Draft', 'Released'];

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());

    const view = await renderApp();
    const statusSelect = document.querySelector('[data-status-select="101"]');
    if (!(statusSelect instanceof HTMLSelectElement)) {
      throw new Error('Unable to find the inline status select.');
    }

    await changeSelect(statusSelect, 'Released');

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Edit Latest Version');
    expect(normalizeText(dialog.textContent)).toContain('This status requires Released Date.');
    expect(docTrack.documents.updateLatestVersion).not.toHaveBeenCalled();
    expect(
      (getLabeledControl(dialog, 'Status', 'select') as HTMLSelectElement).value
    ).toBe('Released');

    await view.unmount();
  });

  it('limits inline status options to the allowed lifecycle transitions', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.lifecycle = buildCustomWorkspaceLifecycle();
    workspaceResult.summary.statuses = ['Draft', 'In Review', 'Released', 'Archived'];

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    const statusSelect = document.querySelector('[data-status-select="101"]');
    if (!(statusSelect instanceof HTMLSelectElement)) {
      throw new Error('Unable to find the inline status select.');
    }

    expect([...statusSelect.options].map((option) => option.value)).toEqual([
      'Draft',
      'In Review'
    ]);

    await view.unmount();
  });

  it('gates confirmations and notification dismissal according to application settings', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();
    const confirmSpy = vi.mocked(window.confirm);

    await setStoreState({
      applicationSettings: {
        ...useAppStore.getState().applicationSettings,
        confirmDestructiveActions: false
      }
    });

    await click(getButton('Document Types'));
    await click(getButton('Delete'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(docTrack.documentTypes.delete).toHaveBeenCalledTimes(1);

    await setStoreState({
      applicationSettings: {
        ...useAppStore.getState().applicationSettings,
        confirmDestructiveActions: true
      },
      notification: undefined
    });

    await click(getButton('Delete'));
    expect(confirmSpy).not.toHaveBeenCalled();
    const confirmationDialog = getDialog();
    expect(normalizeText(confirmationDialog.textContent)).toContain('Delete Document Type');
    await click(getButton('Delete Document Type', confirmationDialog));
    expect(docTrack.documentTypes.delete).toHaveBeenCalledTimes(2);

    act(() => {
      useAppStore.getState().setNotification({
        tone: 'success',
        message: 'Saved successfully.'
      });
    });
    expect(document.body.textContent).toContain('Saved successfully.');
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(document.body.textContent).not.toContain('Saved successfully.');

    await setStoreState({
      applicationSettings: {
        ...useAppStore.getState().applicationSettings,
        autoDismissSuccessNotifications: false
      }
    });
    act(() => {
      useAppStore.getState().setNotification({
        tone: 'success',
        message: 'Keep me visible.'
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(document.body.textContent).toContain('Keep me visible.');

    await setStoreState({
      applicationSettings: {
        ...useAppStore.getState().applicationSettings,
        autoDismissSuccessNotifications: true
      }
    });
    act(() => {
      useAppStore.getState().setNotification({
        tone: 'error',
        message: 'Something broke.'
      });
    });
    const dismissNotificationButton = document.body.querySelector(
      'button[aria-label="Dismiss notification"]'
    );
    if (!(dismissNotificationButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find the notification dismiss button.');
    }
    expect(dismissNotificationButton.closest('div')?.className).toContain('window-no-drag');
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(document.body.textContent).toContain('Something broke.');
    await click(dismissNotificationButton);
    expect(document.body.textContent).not.toContain('Something broke.');

    await view.unmount();
  });

  it('uses the app-level default table columns and lets users change them from the table gear menu', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    const getHeaders = () =>
      [...document.querySelectorAll('thead th')].map((cell) => normalizeText(cell.textContent));

    expect(getHeaders()).toContain('Document ID');
    expect(getHeaders()).toContain('Title');
    expect(getHeaders()).toContain('Document Type');
    expect(getHeaders()).toContain('Version');
    expect(getHeaders()).toContain('Status');
    expect(getHeaders()).toContain('Project');
    expect(getHeaders()).not.toContain('Author');
    expect(getHeaders()).not.toContain('Company');

    const tableSettingsButton = document.querySelector('[aria-label="Table View Settings"]');
    if (!(tableSettingsButton instanceof HTMLElement)) {
      throw new Error('Unable to find the table view settings button.');
    }

    await click(tableSettingsButton);
    const dialog = getDialog();
    const authorCheckbox = getLabeledControl(dialog, 'Author', 'input[type="checkbox"]') as HTMLInputElement;
    await changeCheckbox(authorCheckbox, true);
    await click(getButton('Save View'));

    expect(docTrack.appSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        documentTableVisibleColumns: expect.arrayContaining([
          'documentId',
          'title',
          'documentType',
          'version',
          'status',
          'project',
          'author'
        ])
      })
    );
    expect(getHeaders()).toContain('Author');

    await view.unmount();
  });

  it('opens the export dialog from the documents view header', async () => {
    buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Export'));

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Export Documents');
    expect(
      getLabeledControl(dialog, 'Format', 'select') as HTMLSelectElement
    ).toBeInstanceOf(HTMLSelectElement);

    await view.unmount();
  });

  it('exports the current table using filtered rows and visible columns', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.documents.push({
      id: 102,
      documentId: '02202600002',
      title: 'Supplier Checklist',
      typeId: 2,
      typeName: 'Procedure',
      versionScheme: 'numeric-3',
      status: 'Released',
      latestVersionLabel: '002',
      effectiveDate: '2026-03-29T10:00:00.000Z',
      releasedDate: '2026-03-29T10:00:00.000Z',
      approvedBy: 'Avery Chen',
      revisionDescription: 'Released to operations',
      modifiedDate: '2026-03-29T10:00:00.000Z',
      createdDate: '2026-03-28T11:00:00.000Z',
      author: 'Avery Chen',
      languageId: 1,
      languageCode: 'EN',
      confidentialityClassId: null,
      confidentialityClassName: null,
      projectId: null,
      projectName: null,
      company: 'Acme',
      department: 'Operations',
      startDate: '2026-03-28',
      revisionIntervalMonths: 6,
      nextReviewDate: '2026-09-29T10:00:00.000Z',
      isOverdue: false,
      healthFlags: [],
      latestVersionFileCount: 1,
      lastActivityDate: '2026-03-29T10:00:00.000Z',
      reviewedBy: 'Morgan Patel'
    });

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await click(getDocumentsVisualizationButton('kanban'));
    expect(getDocumentsVisualizationButton('kanban').getAttribute('aria-pressed')).toBe('true');

    await changeInput(
      document.querySelector('[data-doc-search="true"]') as HTMLInputElement,
      'Operating'
    );
    await click(getButton('Export'));
    await click(getButton('Export', getDialog()));

    expect(docTrack.documents.export).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        format: 'csv',
        scope: 'current-table',
        pdfColorMode: 'color',
        companyLogoPath: null,
        columns: [
          { key: 'documentId', label: 'Document ID' },
          { key: 'title', label: 'Title' },
          { key: 'documentType', label: 'Document Type' },
          { key: 'version', label: 'Version' },
          { key: 'status', label: 'Status' },
          { key: 'project', label: 'Project' }
        ],
        rows: [
          expect.objectContaining({
            id: 101,
            title: 'Operating Procedure'
          })
        ],
        filters: {
          search: 'Operating',
          status: 'All',
          project: 'All projects'
        }
      })
    );

    await view.unmount();
  });

  it('exports the whole workspace using all workspace-enabled columns and ignores current filters', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.documents.push({
      id: 102,
      documentId: '02202600002',
      title: 'Supplier Checklist',
      typeId: 2,
      typeName: 'Procedure',
      versionScheme: 'numeric-3',
      status: 'Released',
      latestVersionLabel: '002',
      effectiveDate: '2026-03-29T10:00:00.000Z',
      releasedDate: '2026-03-29T10:00:00.000Z',
      approvedBy: 'Avery Chen',
      revisionDescription: 'Released to operations',
      modifiedDate: '2026-03-29T10:00:00.000Z',
      createdDate: '2026-03-28T11:00:00.000Z',
      author: 'Avery Chen',
      languageId: 1,
      languageCode: 'EN',
      confidentialityClassId: null,
      confidentialityClassName: null,
      projectId: null,
      projectName: null,
      company: 'Acme',
      department: 'Operations',
      startDate: '2026-03-28',
      revisionIntervalMonths: 6,
      nextReviewDate: '2026-09-29T10:00:00.000Z',
      isOverdue: false,
      healthFlags: [],
      latestVersionFileCount: 1,
      lastActivityDate: '2026-03-29T10:00:00.000Z',
      reviewedBy: 'Morgan Patel'
    });

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await changeInput(
      document.querySelector('[data-doc-search="true"]') as HTMLInputElement,
      'No Matching Value'
    );
    await click(getButton('Export'));

    const dialog = getDialog();
    await changeSelect(
      getLabeledControl(dialog, 'Scope', 'select') as HTMLSelectElement,
      'whole-workspace'
    );
    await click(getButton('Export', dialog));

    expect(docTrack.documents.export).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        scope: 'whole-workspace',
        pdfColorMode: 'color',
        companyLogoPath: null,
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 101 }),
          expect.objectContaining({ id: 102 })
        ]),
        columns: workspaceResult.summary.settings.visibleDocumentColumns.map((column) => ({
          key: column,
          label: expect.any(String)
        })),
        filters: {
          search: '',
          status: 'All',
          project: ''
        }
      })
    );

    await view.unmount();
  });

  it('switches between documents visualization modes and reuses the active filters', async () => {
    vi.setSystemTime(new Date('2026-04-06T12:00:00.000Z'));

    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.documents[0] = {
      ...workspaceResult.summary.documents[0]!,
      status: 'Draft',
      effectiveDate: null,
      nextReviewDate: '2026-04-08T10:00:00.000Z'
    };
    workspaceResult.summary.documents.push({
      id: 102,
      documentId: '02202600002',
      title: 'Supplier Checklist',
      typeId: 2,
      typeName: 'Procedure',
      versionScheme: 'numeric-3',
      status: 'Released',
      latestVersionLabel: '002',
      effectiveDate: '2026-03-29T10:00:00.000Z',
      releasedDate: '2026-03-29T10:00:00.000Z',
      approvedBy: 'Avery Chen',
      revisionDescription: 'Released to operations',
      modifiedDate: '2026-03-29T10:00:00.000Z',
      createdDate: '2026-03-28T11:00:00.000Z',
      author: 'Avery Chen',
      languageId: 1,
      languageCode: 'EN',
      confidentialityClassId: null,
      confidentialityClassName: null,
      projectId: null,
      projectName: null,
      company: 'Acme',
      department: 'Operations',
      startDate: '2026-03-28',
      revisionIntervalMonths: 6,
      nextReviewDate: '2026-04-10T10:00:00.000Z',
      isOverdue: false,
      healthFlags: [],
      latestVersionFileCount: 1,
      lastActivityDate: '2026-03-29T10:00:00.000Z',
      reviewedBy: 'Morgan Patel'
    });

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await click(getButton('Released'));

    await click(getDocumentsVisualizationButton('kanban'));
    expect(document.body.textContent).toContain('Supplier Checklist');
    expect(document.body.textContent).not.toContain('Operating Procedure');

    await click(getDocumentsVisualizationButton('timeline'));
    expect(document.body.textContent).toContain('March 2026');
    expect(document.body.textContent).toContain('Supplier Checklist');
    expect(document.body.textContent).not.toContain('Operating Procedure');

    await click(getDocumentsVisualizationButton('calendar'));
    expect(document.body.textContent).toContain('April 2026');
    expect(document.body.textContent).toContain('Supplier Checklist');
    expect(document.body.textContent).not.toContain('Operating Procedure');

    await view.unmount();
  });

  it('renders saved views in the documents panel and applies them from the UI', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.documents[0] = {
      ...workspaceResult.summary.documents[0]!,
      healthFlags: ['missingFiles'],
      revisionDescription: 'Missing working file import'
    };
    workspaceResult.summary.savedViews = [
      {
        id: 'saved-view-1',
        name: 'Drafts with missing files',
        scope: 'shared',
        query: {
          search: 'Operating',
          statusFilter: 'Draft',
          projectFilter: 'All',
          healthFilter: 'All',
          rules: [
            {
              id: 'rule-1',
              field: 'healthFlag',
              operator: 'is',
              value: 'missingFiles'
            }
          ]
        },
        presentation: {
          visualizationMode: 'kanban',
          sorting: [
            {
              column: 'modifiedDate',
              desc: true
            }
          ]
        },
        createdDate: '2026-04-06T09:00:00.000Z',
        modifiedDate: '2026-04-06T09:00:00.000Z'
      }
    ];

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await click(getButton('Saved Views'));
    expect(document.body.textContent).toContain('Drafts with missing files');
    await click(getButton('Drafts with missing files'));

    expect(getDocumentsVisualizationButton('kanban').getAttribute('aria-pressed')).toBe('true');
    expect(
      (document.querySelector('[data-doc-search="true"]') as HTMLInputElement).value
    ).toBe('Operating');

    await view.unmount();
  });

  it('opens the existing status confirmation flow when a kanban card is dropped into a new status column', async () => {
    const docTrack = buildDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'light'
    });
    docTrack.documents.updateLatestVersion = vi
      .fn()
      .mockResolvedValue(buildDocumentDetail());

    const view = await renderApp();

    await click(getDocumentsVisualizationButton('kanban'));

    const card = document.querySelector('[data-document-visual-card="101"]');
    const targetColumn = document.querySelector('[data-kanban-column="Released"]');
    if (!(card instanceof HTMLElement) || !(targetColumn instanceof HTMLElement)) {
      throw new Error('Unable to find kanban drag targets.');
    }

    const dataTransfer = createDragDataTransfer();

    await dispatchDragEvent(card, 'dragstart', dataTransfer);
    await dispatchDragEvent(targetColumn, 'dragover', dataTransfer);
    await dispatchDragEvent(targetColumn, 'drop', dataTransfer);
    await dispatchDragEvent(card, 'dragend', dataTransfer);

    expect(normalizeText(getDialog().textContent)).toContain('Confirm Status Change');
    await click(getButton('Apply Status', getDialog()));

    expect(docTrack.documents.updateLatestVersion).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        documentRecordId: 101,
        status: 'Released'
      })
    );

    await view.unmount();
  });

  it('shows PDF grouping choices only for supported workspace fields', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      visibleDocumentColumns: ['documentId', 'title', 'documentType', 'version', 'status']
    };

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await click(getButton('Export'));
    let dialog = getDialog();
    expect(normalizeText(dialog.textContent)).not.toContain('Group By');

    await changeSelect(
      getLabeledControl(dialog, 'Format', 'select') as HTMLSelectElement,
      'pdf'
    );

    dialog = getDialog();
    const groupingSelect = getLabeledControl(dialog, 'Group By', 'select') as HTMLSelectElement;
    const optionLabels = [...groupingSelect.options].map((option) => option.textContent?.trim());

    expect(optionLabels).toEqual(['No Grouping', 'Document Type', 'Status']);

    await view.unmount();
  });

  it('includes the PDF appearance mode and workspace logo in export requests', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      companyLogoPath: 'Database/branding/company-logo.png'
    };

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();

    await click(getButton('Export'));
    const dialog = getDialog();
    await changeSelect(
      getLabeledControl(dialog, 'Format', 'select') as HTMLSelectElement,
      'pdf'
    );
    await changeSelect(
      getLabeledControl(dialog, 'Appearance', 'select') as HTMLSelectElement,
      'black-and-white'
    );
    await click(getButton('Export', dialog));

    expect(docTrack.documents.export).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        format: 'pdf',
        pdfColorMode: 'black-and-white',
        companyLogoPath: 'Database/branding/company-logo.png'
      })
    );

    await view.unmount();
  });

  it('lets users select and remove a workspace logo from workspace settings', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      companyLogoPath: 'Database/branding/company-logo.png'
    };

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.dialogs.pickWorkspaceLogoFile = vi.fn().mockResolvedValue('C:\\logos\\next-logo.png');

    const view = await renderApp();

    await click(getButton('Workspace Settings'));
    let dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Saved logo: company-logo.png');
    await click(getButton('Replace Logo', dialog));

    dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('New logo selected: next-logo.png');
    await click(getButton('Save Settings', dialog));

    expect(docTrack.workspace.updateSettings).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        settings: expect.objectContaining({
          companyLogoPath: 'Database/branding/company-logo.png'
        }),
        companyLogoSourceFilePath: 'C:\\logos\\next-logo.png',
        clearCompanyLogo: false
      })
    );

    await click(getButton('Workspace Settings'));
    dialog = getDialog();
    await click(getButton('Remove Logo', dialog));
    await click(getButton('Save Settings', dialog));

    expect(docTrack.workspace.updateSettings).toHaveBeenLastCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        settings: expect.objectContaining({
          companyLogoPath: ''
        }),
        companyLogoSourceFilePath: null,
        clearCompanyLogo: true
      })
    );

    await view.unmount();
  });

  it('saves activity log retention and disable settings from workspace settings', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Workspace Settings'));
    await click(getButton('Advanced Settings', getDialog()));

    let dialog = getLastDialog();
    await changeCheckbox(
      getLabeledControl(
        dialog,
        'Enable activity log',
        'input[type="checkbox"]'
      ) as HTMLInputElement,
      false
    );
    await changeInput(
      getLabeledControl(dialog, 'Activity Log Max Rows', 'input') as HTMLInputElement,
      '2500'
    );
    await click(getButton('Done', dialog));

    dialog = getDialog();
    await click(getButton('Save Settings', dialog));

    expect(docTrack.workspace.updateSettings).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        settings: expect.objectContaining({
          activityLogEnabled: false,
          activityLogMaxRows: 2500
        })
      })
    );

    await view.unmount();
  });

  it('shows a disabled message instead of recent activity when activity log is turned off', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      activityLogEnabled: false
    };
    workspaceResult.summary.dashboard.recentActivity = [
      {
        id: 1,
        eventType: 'document.updated',
        message: 'Updated document "Operating Procedure".',
        createdDate: '2026-03-31T10:00:00.000Z',
        documentRecordId: 101,
        documentVersionId: null
      }
    ];

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light',
        defaultWorkspaceView: 'dashboard'
      },
      workspaceResult
    );
    const view = await renderApp();

    expect(normalizeText(document.body.textContent)).toContain(
      'This feature has been disabled in the workspace settings.'
    );
    expect(normalizeText(document.body.textContent)).not.toContain('Show all');

    await view.unmount();
  });

  it('opens the full activity log modal and filters activity records', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.dashboard.recentActivity = [
      {
        id: 1,
        eventType: 'document.updated',
        message: 'Updated document "Operating Procedure".',
        createdDate: '2026-03-31T10:00:00.000Z',
        documentRecordId: 101,
        documentVersionId: null
      }
    ];

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light',
        defaultWorkspaceView: 'dashboard'
      },
      workspaceResult
    );
    docTrack.workspace.listActivity = vi.fn().mockResolvedValue([
      {
        id: 1,
        eventType: 'document.updated',
        message: 'Updated document "Operating Procedure".',
        createdDate: '2026-03-31T10:00:00.000Z',
        documentRecordId: 101,
        documentVersionId: null
      },
      {
        id: 2,
        eventType: 'workspace.backup.created',
        message: 'Created a manual snapshot.',
        createdDate: '2026-03-31T11:00:00.000Z',
        documentRecordId: null,
        documentVersionId: null
      }
    ]);

    const view = await renderApp();

    await click(getButton('Show all'));

    expect(docTrack.workspace.listActivity).toHaveBeenCalledWith(workspaceInfo.rootPath);

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Activity Log');
    expect(normalizeText(dialog.textContent)).toContain(
      'Showing 2 of 2 activity records.'
    );

    await changeInput(
      getLabeledControl(dialog, 'Search', 'input') as HTMLInputElement,
      'snapshot'
    );
    expect(normalizeText(dialog.textContent)).toContain(
      'Showing 1 of 2 activity records.'
    );
    expect(normalizeText(dialog.textContent)).toContain(
      'Created a manual snapshot.'
    );
    expect(normalizeText(dialog.textContent)).not.toContain(
      'Updated document "Operating Procedure".'
    );

    await view.unmount();
  });

  it('respects workspace field availability and searches across app-hidden metadata fields', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = DEFAULT_WORKSPACE_SETTINGS;
    workspaceResult.summary.documents[0]!.company = 'Acme Search Token';

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();
    const headers = [...document.querySelectorAll('thead th')].map((cell) => normalizeText(cell.textContent));

    expect(headers).toContain('Document ID');
    expect(headers).toContain('Title');
    expect(headers).not.toContain('Author');

    await changeInput(
      document.querySelector('[data-doc-search="true"]') as HTMLInputElement,
      'Acme Search Token'
    );
    expect(document.body.textContent).toContain('Operating Procedure');
    expect(document.body.textContent).not.toContain('No documents match');

    await changeInput(
      document.querySelector('[data-doc-search="true"]') as HTMLInputElement,
      'No Matching Value'
    );
    expect(document.body.textContent).toContain('No documents match the current search and filter settings.');

    await view.unmount();
  });

  it('shows the active table sort column and direction in the header', async () => {
    buildDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'light'
    });

    const view = await renderApp();

    const documentIdHeader = getButton('Document ID');
    expect(documentIdHeader.getAttribute('data-sort-direction')).toBe('asc');
    expect(documentIdHeader.className).toContain('font-bold');
    expect(documentIdHeader.closest('th')?.getAttribute('aria-sort')).toBe('ascending');

    await click(documentIdHeader);

    const documentIdHeaderAfter = getButton('Document ID');
    expect(documentIdHeaderAfter.getAttribute('data-sort-direction')).toBe('desc');
    expect(documentIdHeaderAfter.className).toContain('font-bold');
    expect(documentIdHeaderAfter.closest('th')?.getAttribute('aria-sort')).toBe('descending');

    const titleHeader = getButton('Title');
    expect(titleHeader.getAttribute('data-sort-direction')).toBe('none');
    expect(titleHeader.className).not.toContain('font-bold');
    expect(titleHeader.closest('th')?.getAttribute('aria-sort')).toBe('none');

    await view.unmount();
  });

  it('hides disabled version metadata fields in the edit latest version dialog', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.settings = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      visibleDocumentColumns: DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns.filter(
        (column) => column !== 'approvedBy'
      )
    };

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await click(getButton('Edit Latest Version'));

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Released Date');
    expect(normalizeText(dialog.textContent)).not.toContain('Approved By');
    expect(normalizeText(dialog.textContent)).toContain('Revision Description');

    await view.unmount();
  });

  it('clamps sidebar drag-resizing to the app width before persisting', async () => {
    const docTrack = buildDocTrackMock({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'light',
      documentDetailSidebarWidth: 400
    });
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());

    const view = await renderApp();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1000
    });

    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);

    const sidebar = document.querySelector('[data-detail-sidebar="true"]');
    if (!(sidebar instanceof HTMLElement)) {
      throw new Error('Unable to find the sidebar.');
    }

    expect(sidebar.className).toContain('fixed');

    const resizeHandle = document.querySelector('[title="Resize detail sidebar"]');
    if (!(resizeHandle instanceof HTMLElement)) {
      throw new Error('Unable to find the sidebar resize handle.');
    }

    await dispatchPointerEvent(resizeHandle, 'pointerdown', 800);
    await dispatchPointerEvent(window, 'pointermove', 0);
    await dispatchPointerEvent(window, 'pointerup', 0);

    expect(docTrack.appSettings.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentDetailSidebarWidth: 900
      })
    );

    await view.unmount();
  });

  it('stages selected files before uploading them to a version', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(buildDocumentDetail());
    docTrack.dialogs.pickDocumentFiles = vi
      .fn()
      .mockResolvedValue(['/incoming/procedure.docx']);
    let resolveImportPlan: (value: {
      versionId: number;
      suggestedRole: 'concept-pdf';
      hasBlockingDuplicates: false;
      warnings: string[];
      candidates: Array<{
        sourceFilePath: string;
        fileName: string;
        role: 'concept-pdf';
        isDuplicate: false;
      }>;
    }) => void = () => undefined;
    docTrack.documents.planVersionFileImport = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImportPlan = resolve;
        })
    );
    docTrack.documents.addVersionFiles = vi.fn().mockResolvedValue(buildDocumentDetail().versions[0]);

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await click(getButton('Show Files'));

    const dialog = getDialog();
    await click(getButton('Select Files', dialog));

    expect(normalizeText(dialog.textContent)).toContain('Checking selected files...');

    resolveImportPlan({
      versionId: 201,
      suggestedRole: 'concept-pdf',
      hasBlockingDuplicates: false,
      warnings: [],
      candidates: [
        {
          sourceFilePath: '/incoming/procedure.docx',
          fileName: 'procedure.docx',
          role: 'concept-pdf',
          isDuplicate: false
        }
      ]
    });
    await flushPromises();

    expect(docTrack.documents.planVersionFileImport).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      201,
      ['/incoming/procedure.docx']
    );
    expect(docTrack.documents.addVersionFiles).not.toHaveBeenCalled();
    expect(normalizeText(dialog.textContent)).toContain('/incoming/procedure.docx');

    await click(getButton('Upload Files', dialog));

    expect(docTrack.documents.addVersionFiles).toHaveBeenCalledWith(workspaceInfo.rootPath, {
      documentVersionId: 201,
      role: 'concept-pdf',
      sourceFilePaths: ['/incoming/procedure.docx']
    });

    await view.unmount();
  });

  it('confirms document deletion and shows the physical files that will be removed', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(
      buildDocumentDetail({
        versions: [
          {
            ...buildDocumentDetail().versions[0]!,
            files: [
              {
                id: 301,
                documentVersionId: 201,
                role: 'working',
                fileName: 'procedure.docx',
                filePath: 'Documents/Procedure/02202600001/001/procedure.docx',
                contentHash: 'hash-1',
                fileSize: 128,
                createdDate: '2026-03-28T10:00:00.000Z',
                modifiedDate: '2026-03-28T10:00:00.000Z'
              }
            ],
            unmanagedPaths: ['Documents/Procedure/02202600001/001/custom']
          }
        ]
      })
    );

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await click(getButton('Delete Document'));

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain('Physical files will be deleted');
    expect(normalizeText(dialog.textContent)).toContain(
      'Documents/Procedure/02202600001/001/procedure.docx'
    );
    expect(normalizeText(dialog.textContent)).toContain(
      'Documents/Procedure/02202600001/001/custom'
    );

    await click(getButton('Delete Document', dialog));

    expect(docTrack.documents.delete).toHaveBeenCalledWith(workspaceInfo.rootPath, {
      documentRecordId: 101
    });

    await view.unmount();
  });

  it('confirms version deletion and uses the selected version id', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(
      buildDocumentDetail({
        versions: [
          {
            ...buildDocumentDetail().versions[0]!,
            files: [
              {
                id: 301,
                documentVersionId: 201,
                role: 'working',
                fileName: 'procedure.docx',
                filePath: 'Documents/Procedure/02202600001/001/procedure.docx',
                contentHash: 'hash-1',
                fileSize: 128,
                createdDate: '2026-03-28T10:00:00.000Z',
                modifiedDate: '2026-03-28T10:00:00.000Z'
              }
            ]
          }
        ]
      })
    );
    docTrack.documents.deleteVersion = vi
      .fn()
      .mockResolvedValue(buildDocumentDetail({ versions: [] }));

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await click(getButton('Delete Version'));

    const dialog = getDialog();
    expect(normalizeText(dialog.textContent)).toContain(
      'Documents/Procedure/02202600001/001/procedure.docx'
    );

    await click(getButton('Delete Version', dialog));

    expect(docTrack.documents.deleteVersion).toHaveBeenCalledWith(workspaceInfo.rootPath, {
      documentVersionId: 201
    });

    await view.unmount();
  });

  it('renames a managed file through the rename dialog', async () => {
    const docTrack = buildDocTrackMock();
    docTrack.documents.detail = vi.fn().mockResolvedValue(
      buildDocumentDetail({
        versions: [
          {
            ...buildDocumentDetail().versions[0]!,
            files: [
              {
                id: 301,
                documentVersionId: 201,
                role: 'working',
                fileName: 'procedure.docx',
                filePath: 'Documents/Procedure/02202600001/001/procedure.docx',
                contentHash: 'hash-1',
                fileSize: 128,
                createdDate: '2026-03-28T10:00:00.000Z',
                modifiedDate: '2026-03-28T10:00:00.000Z'
              }
            ]
          }
        ]
      })
    );
    docTrack.documents.renameVersionFile = vi
      .fn()
      .mockResolvedValue(buildDocumentDetail().versions[0]);

    const view = await renderApp();
    const firstRow = document.querySelector('tbody tr');
    if (!(firstRow instanceof HTMLElement)) {
      throw new Error('Unable to find the first document row.');
    }

    await click(firstRow);
    await click(getButton('Show Files'));
    await click(getButton('Rename', getDialog()));

    const dialog = getLastDialog();
    expect(normalizeText(dialog.textContent)).toContain(
      'Renaming here also renames the managed file on disk.'
    );

    await changeInput(
      getLabeledControl(dialog, 'New File Name', 'input') as HTMLInputElement,
      'procedure-renamed.docx'
    );
    await click(getButton('Rename File', dialog));

    expect(docTrack.documents.renameVersionFile).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      {
        fileId: 301,
        nextFileName: 'procedure-renamed.docx'
      }
    );

    await view.unmount();
  });

  it('shows languages on their own page and keeps the workspace settings dialog scrollable', async () => {
    buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('Languages'));
    expect(document.body.textContent).toContain('Short workspace language codes shown in the documents table and document metadata forms.');

    await click(getButton('Classifications'));
    expect(document.body.textContent).toContain('Workspace-defined selectable classes for document handling.');
    expect(document.body.textContent).not.toContain(
      'Short workspace language codes shown in the documents table and document metadata forms.'
    );

    await click(getButton('Workspace Settings'));
    const dialog = getDialog();
    expect(dialog.className).toContain('max-h-[85vh]');

    await view.unmount();
  });

  it('shows the templates workspace view and routes template actions through IPC', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.templates = [
      {
        id: 'Procedure Starter',
        name: 'Procedure Starter',
        folderPath: 'Templates/Procedure Starter',
        fileCount: 1,
        modifiedDate: '2026-03-31T12:00:00.000Z',
        files: [
          {
            fileName: 'starter.docx',
            filePath: 'Templates/Procedure Starter/starter.docx',
            fileSize: 128,
            modifiedDate: '2026-03-31T12:00:00.000Z'
          }
        ]
      }
    ];

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.templates.create = vi.fn().mockResolvedValue(workspaceResult.summary.templates[0]);
    docTrack.templates.addFiles = vi.fn().mockResolvedValue(workspaceResult.summary.templates[0]);
    docTrack.dialogs.pickDocumentFiles = vi
      .fn()
      .mockResolvedValue(['/incoming/template-starter.docx']);

    const view = await renderApp();

    await click(getButton('Templates'));
    expect(document.body.textContent).toContain(
      'Reusable workspace document starters stored in the root Templates folder.'
    );

    await click(getButton('Add Template'));
    let dialog = getDialog();
    await changeInput(
      getLabeledControl(dialog, 'Template Name', 'input') as HTMLInputElement,
      'Procedure Starter'
    );
    await click(getButton('Save Template', dialog));

    expect(docTrack.templates.create).toHaveBeenCalledWith(workspaceInfo.rootPath, {
      name: 'Procedure Starter'
    });

    await click(getButton('Add Files'));
    dialog = getDialog();
    await click(getButton('Browse Files', dialog));
    await click(getButton('Import Template Files', dialog));

    expect(docTrack.templates.addFiles).toHaveBeenCalledWith(workspaceInfo.rootPath, {
      templateId: 'Procedure Starter',
      sourceFilePaths: ['/incoming/template-starter.docx']
    });

    await view.unmount();
  });

  it('includes the selected template when creating a document', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.templates = [
      {
        id: 'Procedure Starter',
        name: 'Procedure Starter',
        folderPath: 'Templates/Procedure Starter',
        fileCount: 1,
        modifiedDate: '2026-03-31T12:00:00.000Z',
        files: [
          {
            fileName: 'starter.docx',
            filePath: 'Templates/Procedure Starter/starter.docx',
            fileSize: 128,
            modifiedDate: '2026-03-31T12:00:00.000Z'
          }
        ]
      }
    ];

    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.documents.create = vi.fn().mockResolvedValue(
      buildDocumentDetail({
        versions: [
          {
            ...buildDocumentDetail().versions[0]!,
            revisionDescription: 'Created from template "Procedure Starter".'
          }
        ]
      })
    );

    const view = await renderApp();

    await click(getButton('New Document'));
    const dialog = getDialog();
    await changeInput(
      getLabeledControl(dialog, 'Title', 'input') as HTMLInputElement,
      'Templated Procedure'
    );
    await changeSelect(
      getLabeledControl(dialog, 'Author', 'select') as HTMLSelectElement,
      String(workspaceSession.user.id)
    );
    await changeSelect(
      getLabeledControl(dialog, 'Document Type', 'select') as HTMLSelectElement,
      '2'
    );
    await changeSelect(
      getLabeledControl(dialog, 'Template', 'select') as HTMLSelectElement,
      'Procedure Starter'
    );
    await click(getButton('Create Document', dialog));

    expect(docTrack.documents.create).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      expect.objectContaining({
        title: 'Templated Procedure',
        author: workspaceSession.user.displayName,
        authorUserId: workspaceSession.user.id,
        documentTypeId: 2,
        versionScheme: 'numeric-3',
        templateId: 'Procedure Starter'
      })
    );

    await view.unmount();
  });

  it('shows inline validation for a missing author when creating a document', async () => {
    const docTrack = buildDocTrackMock();
    const view = await renderApp();

    await click(getButton('New Document'));
    const dialog = getDialog();
    await changeInput(
      getLabeledControl(dialog, 'Title', 'input') as HTMLInputElement,
      'Author Validation Procedure'
    );
    await changeSelect(
      getLabeledControl(dialog, 'Document Type', 'select') as HTMLSelectElement,
      '2'
    );

    const authorSelect = getLabeledControl(dialog, 'Author', 'select') as HTMLSelectElement;
    await changeSelect(authorSelect, '');
    await click(getButton('Create Document', dialog));

    expect(docTrack.documents.create).not.toHaveBeenCalled();
    expect(authorSelect.getAttribute('aria-invalid')).toBe('true');
    expect(normalizeText(dialog.textContent)).toContain('Author is required.');

    await changeSelect(authorSelect, String(workspaceSession.user.id));

    expect(authorSelect.getAttribute('aria-invalid')).not.toBe('true');
    expect(normalizeText(dialog.textContent)).not.toContain('Author is required.');

    await view.unmount();
  });

  it('keeps workspace user validation inside the modal and protects the signed-in account', async () => {
    const workspaceResult = cloneWorkspaceResult();
    const inactiveUser: WorkspaceUser = {
      ...workspaceUsers[0],
      id: 2,
      username: 'casey',
      displayName: 'Casey Holt',
      role: 'viewer',
      signInEnabled: false
    };
    workspaceResult.summary.users = [workspaceUsers[0], inactiveUser];

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    ).workspace.listUsers.mockResolvedValue(workspaceResult.summary.users);

    const view = await renderApp();

    await click(getButton('Workspace Users'));
    const dialog = getDialog();
    const activeBadge = [...dialog.querySelectorAll('div')].find(
      (element) => normalizeText(element.textContent) === 'Active'
    );
    const inactiveBadge = [...dialog.querySelectorAll('div')].find(
      (element) => normalizeText(element.textContent) === 'Inactive'
    );
    const deactivateButton = getButton('Deactivate', dialog);
    const userList = [...dialog.querySelectorAll('div')].find((element) =>
      element.className.includes('flex-1 space-y-2 overflow-y-auto')
    );

    expect(activeBadge?.className).toContain('bg-[#E8F3EC]');
    expect(inactiveBadge?.className).toContain('bg-destructive');
    expect(userList?.className).toContain('overflow-y-auto');
    expect(deactivateButton.disabled).toBe(true);
    expect(normalizeText(dialog.textContent)).toContain(
      'cannot be set to inactive'
    );

    await click(getButton('New', dialog));
    await click(getButton('Create User', dialog));

    expect(normalizeText(dialog.textContent)).toContain(
      'Fix the highlighted fields before saving.'
    );
    expect(document.body.querySelector('[aria-label="Dismiss notification"]')).toBeNull();

    await view.unmount();
  });

  it('pins the signed-in workspace user to the top of the list and labels it clearly', async () => {
    const currentUser = workspaceUsers[0];
    const otherUser: WorkspaceUser = {
      ...currentUser,
      id: 2,
      username: 'casey',
      displayName: 'Casey Holt',
      role: 'viewer',
      signInEnabled: false
    };
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.users = [currentUser, otherUser];
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.workspace.listUsers.mockResolvedValue([otherUser, currentUser]);

    const view = await renderApp();

    await click(getButton('Workspace Users'));
    const dialog = getDialog();
    const userButtons = [...dialog.querySelectorAll('button')].filter((element) =>
      normalizeText(element.textContent).includes('@')
    );

    expect(userButtons).toHaveLength(2);
    expect(normalizeText(userButtons[0]?.textContent)).toContain('Jordan Singh');
    expect(normalizeText(userButtons[0]?.textContent)).toContain('You');
    expect(normalizeText(userButtons[1]?.textContent)).toContain('Casey Holt');
    expect(normalizeText(dialog.textContent)).toContain('Other users');

    await view.unmount();
  });

  it('keeps archived workspace users in a collapsible section', async () => {
    const currentUser = workspaceUsers[0];
    const archivedUser: WorkspaceUser = {
      ...currentUser,
      id: 2,
      username: 'casey',
      displayName: 'Casey Holt',
      role: 'viewer',
      signInEnabled: false,
      archived: true,
      linkedRecordCount: 3
    };
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.users = [currentUser, archivedUser];
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.workspace.listUsers.mockResolvedValue([currentUser, archivedUser]);

    const view = await renderApp();

    await click(getButton('Workspace Users'));
    const dialog = getDialog();

    expect(normalizeText(dialog.textContent)).toContain('Archived users');
    expect(normalizeText(dialog.textContent)).not.toContain('Casey Holt');

    await click(getButton('Archived users', dialog));

    expect(normalizeText(dialog.textContent)).toContain('Casey Holt');
    expect(normalizeText(dialog.textContent)).toContain('Archived');

    await view.unmount();
  });

  it('restores archived workspace users from the archive section', async () => {
    const currentUser = workspaceUsers[0];
    const archivedUser: WorkspaceUser = {
      ...currentUser,
      id: 2,
      username: 'casey',
      displayName: 'Casey Holt',
      role: 'viewer',
      signInEnabled: false,
      archived: true,
      linkedRecordCount: 3
    };
    const restoredUser: WorkspaceUser = {
      ...archivedUser,
      archived: false
    };
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.users = [currentUser, archivedUser];
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.workspace.listUsers = vi
      .fn()
      .mockResolvedValueOnce([currentUser, archivedUser])
      .mockResolvedValueOnce([currentUser, restoredUser]);
    docTrack.workspace.unarchiveUser.mockResolvedValue(restoredUser);

    const view = await renderApp();

    await click(getButton('Workspace Users'));
    let dialog = getDialog();
    await click(getButton('Archived users', dialog));
    await click(getButton('Casey Holt', dialog));
    await click(getButton('Restore User', getDialog()));

    dialog = getDialog();
    expect(docTrack.workspace.unarchiveUser).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      2
    );
    expect(normalizeText(dialog.textContent)).toContain('Casey Holt');
    expect(normalizeText(dialog.textContent)).not.toContain('Restore User');

    await view.unmount();
  });

  it('offers recovery when a locked workspace has no active users left', async () => {
    const lockedWorkspaceResult: OpenWorkspaceResult = {
      kind: 'unauthenticated',
      workspace: workspaceInfo,
      summary: {
        ...cloneWorkspaceResult().summary,
        workspace: workspaceInfo,
        users: workspaceUsers
      },
      users: [],
      canRecoverAccess: true,
      session: null
    };
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      lockedWorkspaceResult
    );
    docTrack.workspace.recoverAccess.mockResolvedValue(cloneWorkspaceResult());

    const view = await renderApp();

    expect(normalizeText(document.body.textContent)).toContain(
      'Recover access to Quality'
    );

    await changeInput(
      getLabeledControl(document.body, 'Recovery Admin Display Name', 'input') as HTMLInputElement,
      'Recovery Admin'
    );
    await changeInput(
      getLabeledControl(document.body, 'Recovery Admin Username', 'input') as HTMLInputElement,
      'recovery-admin'
    );
    await changeInput(
      getLabeledControl(document.body, 'Recovery Password or PIN', 'input') as HTMLInputElement,
      'rescue123'
    );
    await click(getButton('Recover Access'));

    expect(docTrack.workspace.recoverAccess).toHaveBeenCalledWith(
      workspaceInfo.rootPath,
      {
        username: 'recovery-admin',
        displayName: 'Recovery Admin',
        password: 'rescue123'
      }
    );

    await view.unmount();
  });

  it('shows a friendly recovery error when the admin username already exists', async () => {
    const lockedWorkspaceResult: OpenWorkspaceResult = {
      kind: 'unauthenticated',
      workspace: workspaceInfo,
      summary: {
        ...cloneWorkspaceResult().summary,
        workspace: workspaceInfo,
        users: workspaceUsers
      },
      users: [],
      canRecoverAccess: true,
      session: null
    };
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      lockedWorkspaceResult
    );
    docTrack.workspace.recoverAccess.mockRejectedValue(
      new Error('A workspace user with the username "admin" already exists.')
    );

    const view = await renderApp();

    await changeInput(
      getLabeledControl(document.body, 'Recovery Admin Display Name', 'input') as HTMLInputElement,
      'Recovery Admin'
    );
    await changeInput(
      getLabeledControl(document.body, 'Recovery Admin Username', 'input') as HTMLInputElement,
      'admin'
    );
    await changeInput(
      getLabeledControl(document.body, 'Recovery Password or PIN', 'input') as HTMLInputElement,
      'rescue123'
    );
    await click(getButton('Recover Access'));

    expect(normalizeText(document.body.textContent)).toContain(
      'A workspace user with the username "admin" already exists.'
    );
    expect(normalizeText(document.body.textContent)).not.toContain(
      'SqliteError: UNIQUE constraint failed: WorkspaceUsers.Username'
    );

    await view.unmount();
  });

  it('resets the workspace user dialog submit state after activating a user', async () => {
    const inactiveUser: WorkspaceUser = {
      ...workspaceUsers[0],
      id: 2,
      username: 'casey',
      displayName: 'Casey Holt',
      role: 'viewer',
      signInEnabled: false
    };
    const activatedUser: WorkspaceUser = {
      ...inactiveUser,
      signInEnabled: true
    };
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.users = [workspaceUsers[0], inactiveUser];
    const docTrack = buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    docTrack.workspace.listUsers = vi
      .fn()
      .mockResolvedValueOnce([workspaceUsers[0], inactiveUser])
      .mockResolvedValueOnce([workspaceUsers[0], activatedUser]);

    const view = await renderApp();

    await click(getButton('Workspace Users'));
    const initialDialog = getDialog();
    const inactiveUserButton = [...initialDialog.querySelectorAll('button')].find((element) =>
      normalizeText(element.textContent).includes('Casey Holt')
    );
    if (!(inactiveUserButton instanceof HTMLButtonElement)) {
      throw new Error('Unable to find the inactive workspace user.');
    }

    await click(inactiveUserButton);
    await click(getButton('Activate', getDialog()));

    const refreshedDialog = getDialog();
    expect(docTrack.workspace.activateUser).toHaveBeenCalledWith(workspaceInfo.rootPath, 2);
    expect(getButton('Save User', refreshedDialog).disabled).toBe(false);

    await view.unmount();
  });

  it('filters the document table by project assignment', async () => {
    const workspaceResult = cloneWorkspaceResult();
    workspaceResult.summary.projects = [
      {
        id: 7,
        name: 'QMS Rollout'
      }
    ];
    workspaceResult.summary.documents = [
      {
        ...workspaceResult.summary.documents[0]!,
        projectId: 7,
        projectName: 'QMS Rollout'
      },
      {
        ...workspaceResult.summary.documents[0]!,
        id: 102,
        documentId: '02202600002',
        title: 'Supplier Audit Checklist',
        projectId: null,
        projectName: null
      }
    ];

    buildDocTrackMock(
      {
        ...DEFAULT_APPLICATION_SETTINGS,
        themeMode: 'light'
      },
      workspaceResult
    );
    const view = await renderApp();
    const projectSelect = getLabeledControl(document.body, 'Project', 'select') as HTMLSelectElement;

    await changeSelect(projectSelect, '7');
    expect(document.body.textContent).toContain('Operating Procedure');
    expect(document.body.textContent).not.toContain('Supplier Audit Checklist');

    await changeSelect(projectSelect, '');
    expect(document.body.textContent).toContain('Supplier Audit Checklist');
    expect(document.body.textContent).not.toContain('Operating Procedure');

    await view.unmount();
  });
});
