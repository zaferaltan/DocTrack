// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import {
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import type { DocTrackApi } from '@shared/ipc';
import type { OpenWorkspaceResult, WorkspaceInfo } from '@shared/types';
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
        revisionIntervalMonths: 12
      }
    ],
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
      getSummary: vi.fn().mockResolvedValue(workspaceResult),
      updateSettings: vi.fn().mockResolvedValue(workspaceResult)
    },
    dialogs: {
      pickWorkspaceCreatePath: vi.fn().mockResolvedValue(null),
      pickWorkspaceOpenPath: vi.fn().mockResolvedValue(null),
      pickDocumentFiles: vi.fn().mockResolvedValue([])
    },
    documents: {
      list: vi.fn().mockResolvedValue(workspaceResult.summary.documents),
      detail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      createVersion: vi.fn(),
      updateLatestVersion: vi.fn(),
      addVersionFiles: vi.fn(),
      renameVersionFile: vi.fn(),
      deleteVersionFile: vi.fn(),
      changeVersionFileRole: vi.fn(),
      syncVersionFiles: vi.fn(),
      openVersionFile: vi.fn().mockResolvedValue(undefined),
      openDocumentFolder: vi.fn().mockResolvedValue(undefined),
      openVersionFolder: vi.fn().mockResolvedValue(undefined)
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

describe('App', () => {
  beforeEach(() => {
    // @ts-expect-error React act environment flag for tests.
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    document.documentElement.className = '';
    resetStore();
    vi.useFakeTimers();
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

    await click(getButton('Application Settings'));
    await click(getButton('Dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await click(getButton('Cancel'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await click(getButton('Application Settings'));
    const settingsDialog = getDialog();
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
    expect(confirmSpy).toHaveBeenCalledTimes(1);
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
