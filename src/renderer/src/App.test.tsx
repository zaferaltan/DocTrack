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
        modifiedDate: '2026-03-28T10:00:00.000Z',
        createdDate: '2026-03-28T09:00:00.000Z',
        author: 'Jordan Singh'
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
    statuses: ['Draft', 'In Review', 'Released', 'Archived']
  }
};

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
  }
) => {
  let persistedSettings = { ...initialSettings };

  const docTrack: DocTrackApi = {
    workspace: {
      create: vi.fn(),
      open: vi.fn().mockResolvedValue(openWorkspaceResult),
      close: vi.fn().mockResolvedValue([]),
      listOpen: vi.fn().mockResolvedValue([workspaceInfo]),
      listRecent: vi.fn().mockResolvedValue([
        {
          rootPath: workspaceInfo.rootPath,
          name: workspaceInfo.name,
          lastOpenedDate: '2026-03-28T12:00:00.000Z'
        }
      ]),
      getSummary: vi.fn().mockResolvedValue(openWorkspaceResult),
      updateSettings: vi.fn().mockResolvedValue(openWorkspaceResult)
    },
    dialogs: {
      pickWorkspaceCreatePath: vi.fn().mockResolvedValue(null),
      pickWorkspaceOpenPath: vi.fn().mockResolvedValue(null),
      pickDocumentFiles: vi.fn().mockResolvedValue([])
    },
    documents: {
      list: vi.fn().mockResolvedValue(openWorkspaceResult.summary.documents),
      detail: vi.fn(),
      create: vi.fn(),
      createVersion: vi.fn(),
      addVersionFiles: vi.fn(),
      renameVersionFile: vi.fn(),
      deleteVersionFile: vi.fn(),
      changeVersionFileRole: vi.fn(),
      syncVersionFiles: vi.fn(),
      updateStatus: vi.fn(),
      openVersionFile: vi.fn().mockResolvedValue(undefined),
      openDocumentFolder: vi.fn().mockResolvedValue(undefined),
      openVersionFolder: vi.fn().mockResolvedValue(undefined)
    },
    documentTypes: {
      list: vi.fn().mockResolvedValue(openWorkspaceResult.summary.documentTypes),
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
});
