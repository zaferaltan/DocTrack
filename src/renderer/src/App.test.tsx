// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import type { DocTrackApi } from '@shared/ipc';
import type { DocumentDetail, OpenWorkspaceResult, WorkspaceInfo } from '@shared/types';
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

const openWorkspaceResult: OpenWorkspaceResult = {
  workspace: workspaceInfo,
  summary: {
    workspace: workspaceInfo,
    settings: DEFAULT_WORKSPACE_SETTINGS,
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
    statuses: ['Draft', 'In Review', 'Released', 'Archived', 'Obsolete']
  }
};

const cloneWorkspaceResult = (): OpenWorkspaceResult =>
  JSON.parse(JSON.stringify(openWorkspaceResult)) as OpenWorkspaceResult;

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
  workspaceResult: OpenWorkspaceResult = openWorkspaceResult
) => {
  let persistedSettings = { ...initialSettings };

  const docTrack: DocTrackApi = {
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
      updateSettings: vi.fn().mockResolvedValue(workspaceResult)
      ,
      getDashboard: vi.fn().mockResolvedValue(workspaceResult.summary.dashboard),
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
    }
  };

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
    await changeInput(
      getLabeledControl(settingsDialog, 'Default Document Author', 'input') as HTMLInputElement,
      'Taylor Reed'
    );
    await changeSelect(
      getLabeledControl(
        settingsDialog,
        'Default Document Version Scheme',
        'select'
      ) as HTMLSelectElement,
      'major-minor'
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
    await click(getButton('Save Settings'));

    expect(docTrack.appSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        themeMode: 'dark',
        defaultDocumentAuthor: 'Taylor Reed',
        defaultDocumentVersionScheme: 'major-minor',
        defaultIncludeExampleData: false,
        documentTableDensity: 'compact'
      })
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await click(getButton('New Document'));
    const documentDialog = getDialog();
    const authorInput = getLabeledControl(documentDialog, 'Author', 'input') as HTMLInputElement;
    const versionSchemeSelect = getLabeledControl(
      documentDialog,
      'Version Scheme',
      'select'
    ) as HTMLSelectElement;
    expect(authorInput.value).toBe('Taylor Reed');
    expect(versionSchemeSelect.value).toBe('major-minor');
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
    await click(getButton('Create Workspace', workspaceDialog));

    expect(docTrack.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Quality Workspace',
        folderName: 'Quality Files',
        parentPath: '/Users/you/Documents'
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
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(document.body.textContent).toContain('Something broke.');

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
    await click(getButton('Select and Add Files', dialog));

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
    await changeInput(
      getLabeledControl(dialog, 'Author', 'input') as HTMLInputElement,
      'Taylor Reed'
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
        author: 'Taylor Reed',
        documentTypeId: 2,
        versionScheme: 'numeric-3',
        templateId: 'Procedure Starter'
      })
    );

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
