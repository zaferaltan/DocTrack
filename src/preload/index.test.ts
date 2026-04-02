import type { AppUpdateState } from "@shared/appUpdates";
import { IPC_CHANNELS } from "@shared/ipc";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();
const exposeInMainWorld = vi.fn();
const getPathForFile = vi.fn();
let exposedApi: unknown;

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => {
      exposeInMainWorld(name, api);
      exposedApi = api;
    },
  },
  ipcRenderer: {
    invoke,
    on,
    removeListener,
  },
  webUtils: {
    getPathForFile,
  },
}));

await import("@preload/index");

describe("preload app updates bridge", () => {
  beforeEach(() => {
    invoke.mockReset();
    on.mockReset();
    removeListener.mockReset();
    getPathForFile.mockReset();
  });

  it("invokes updater IPC channels through the exposed bridge", async () => {
    const api = exposedApi as {
      appUpdates: {
        getState: () => Promise<unknown>;
        checkForUpdates: () => Promise<unknown>;
        downloadUpdate: () => Promise<unknown>;
        quitAndInstall: () => Promise<void>;
      };
    };

    await api.appUpdates.getState();
    await api.appUpdates.checkForUpdates();
    await api.appUpdates.downloadUpdate();
    await api.appUpdates.quitAndInstall();

    expect(invoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.appUpdatesGetState);
    expect(invoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.appUpdatesCheckForUpdates);
    expect(invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.appUpdatesDownloadUpdate);
    expect(invoke).toHaveBeenNthCalledWith(4, IPC_CHANNELS.appUpdatesQuitAndInstall);
  });

  it("subscribes to updater state changes and cleans up listeners", () => {
    const api = exposedApi as {
      appUpdates: {
        onStateChange: (listener: (state: AppUpdateState) => void) => () => void;
      };
    };
    const listener = vi.fn();

    const unsubscribe = api.appUpdates.onStateChange(listener);
    const wrappedListener = on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: AppUpdateState) => void)
      | undefined;

    expect(on).toHaveBeenCalledWith(
      IPC_CHANNELS.appUpdatesStateChanged,
      expect.any(Function)
    );

    wrappedListener?.({}, {
      status: "idle",
      currentVersion: "0.1.0",
      isSupported: true,
      message: "Ready to check for updates.",
      release: null,
      progress: null,
      lastCheckedAt: null,
      lastCheckSource: null,
      lastUpdatedAt: "2026-04-02T10:00:00.000Z",
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "idle",
      })
    );

    unsubscribe();

    expect(removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.appUpdatesStateChanged,
      wrappedListener
    );
  });
});
