import { describe, expect, it, vi, beforeEach } from "vitest";
import { IPC_CHANNELS } from "@shared/ipc";
import { registerIpcHandlers } from "@main/ipc";

const { handle, showOpenDialog } = vi.hoisted(() => ({
  handle: vi.fn(),
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog,
  },
  ipcMain: {
    handle,
  },
}));

const createServiceStub = () =>
  new Proxy(
    {} as Record<string, ReturnType<typeof vi.fn>>,
    {
      get(target, property: string) {
        if (!(property in target)) {
          target[property] = vi.fn();
        }

        return target[property];
      },
    }
  ) as Record<string, ReturnType<typeof vi.fn>>;

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handle.mockReset();
  });

  it("routes updater IPC requests through the updater service", async () => {
    const appUpdaterService = createServiceStub();
    const catalogService = createServiceStub();
    const prepareForAppQuit = vi.fn();
    const nextSettings = {
      themeMode: "system",
      launchBehavior: "home",
      defaultWorkspaceView: "documents",
      documentDetailViewMode: "sidebar",
      documentDetailSidebarWidth: 800,
      documentTableDensity: "comfortable",
      workspaceTabDensity: "comfortable",
      documentTableVisibleColumns: ["documentId"],
      keyboardShortcuts: {
        openCommandPalette: "Mod+K",
        openSettings: "Mod+,",
        newWorkspace: "Mod+Shift+N",
        openWorkspaceFolder: "Mod+O",
        newDocument: "Mod+N",
        focusSearch: "Mod+F",
      },
      defaultIncludeExampleData: true,
      defaultDocumentAuthor: "",
      defaultDocumentVersionScheme: "numeric-3",
      confirmDestructiveActions: true,
      autoDismissSuccessNotifications: true,
      autoUpdateEnabled: true,
      checkForUpdatesOnLaunch: true,
    };

    catalogService.updateApplicationSettings.mockReturnValue(nextSettings);
    appUpdaterService.getState.mockReturnValue({
      status: "downloaded",
      currentVersion: "0.1.0",
      isSupported: true,
      message: "DocTrack 0.2.0 is ready to install.",
      release: {
        version: "0.2.0",
        releaseName: "0.2.0",
        releaseDate: "2026-04-02T10:00:00.000Z",
        releaseNotes: "A new build is ready.",
      },
      progress: null,
      lastCheckedAt: "2026-04-02T10:00:00.000Z",
      lastCheckSource: "manual",
      lastUpdatedAt: "2026-04-02T10:01:00.000Z",
    });

    registerIpcHandlers({
      workspaceService: createServiceStub() as never,
      documentService: createServiceStub() as never,
      documentExportService: createServiceStub() as never,
      documentTypeService: createServiceStub() as never,
      workspaceCatalogService: createServiceStub() as never,
      templateService: createServiceStub() as never,
      savedViewService: createServiceStub() as never,
      catalogService: catalogService as never,
      appUpdaterService: appUpdaterService as never,
      prepareForAppQuit,
    });

    const handlers = new Map(
      handle.mock.calls.map(([channel, handler]) => [channel, handler as (...args: unknown[]) => unknown])
    );

    await handlers.get(IPC_CHANNELS.appSettingsUpdate)?.({}, nextSettings);
    await handlers.get(IPC_CHANNELS.appUpdatesGetState)?.({});
    await handlers.get(IPC_CHANNELS.appUpdatesGetCompletedUpdate)?.({});
    await handlers.get(IPC_CHANNELS.appUpdatesCheckForUpdates)?.({});
    await handlers.get(IPC_CHANNELS.appUpdatesDownloadUpdate)?.({});
    await handlers.get(IPC_CHANNELS.appUpdatesClearCompletedUpdate)?.({});
    await handlers.get(IPC_CHANNELS.appUpdatesQuitAndInstall)?.({});

    expect(catalogService.updateApplicationSettings).toHaveBeenCalledWith(nextSettings);
    expect(appUpdaterService.syncSettings).toHaveBeenCalledWith(nextSettings);
    expect(appUpdaterService.getState).toHaveBeenCalledTimes(2);
    expect(catalogService.getCompletedAppUpdate).toHaveBeenCalledTimes(1);
    expect(appUpdaterService.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(appUpdaterService.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(catalogService.clearCompletedAppUpdate).toHaveBeenCalledTimes(1);
    expect(prepareForAppQuit).toHaveBeenCalledTimes(1);
    expect(catalogService.setCompletedAppUpdate).toHaveBeenCalledTimes(1);
    expect(appUpdaterService.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
