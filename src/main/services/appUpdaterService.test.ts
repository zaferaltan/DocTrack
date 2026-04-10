import { EventEmitter } from "node:events";
import { DEFAULT_APPLICATION_SETTINGS } from "@shared/applicationSettings";
import { describe, expect, it, vi } from "vitest";
import { AppUpdaterService } from "@main/services/appUpdaterService";

class FakeAutoUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  checkForUpdates = vi.fn(async () => {
    this.emit("checking-for-update");
    this.emit("update-available", {
      version: "0.2.0",
      releaseName: "0.2.0",
      releaseDate: "2026-04-02T10:00:00.000Z",
      releaseNotes: "A new build is ready.",
    });
    return null;
  });
  downloadUpdate = vi.fn(async () => {
    this.emit("download-progress", {
      bytesPerSecond: 1024,
      percent: 50,
      transferred: 512,
      total: 1024,
    });
    this.emit("update-downloaded", {
      version: "0.2.0",
      releaseName: "0.2.0",
      releaseDate: "2026-04-02T10:00:00.000Z",
      releaseNotes: "A new build is ready.",
    });
    return null;
  });
  quitAndInstall = vi.fn();
}

describe("AppUpdaterService", () => {
  it("starts in an unsupported state when the app is not packaged", () => {
    const service = new AppUpdaterService({
      updater: new FakeAutoUpdater(),
      isPackaged: false,
      currentVersion: "0.1.0",
    });

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "unsupported",
        isSupported: false,
      })
    );
  });

  it("checks for updates and records available releases", async () => {
    const updater = new FakeAutoUpdater();
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "win32",
      now: () => "2026-04-02T10:00:00.000Z",
    });

    await service.checkForUpdates();

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "available",
        release: expect.objectContaining({
          version: "0.2.0",
        }),
        lastCheckedAt: "2026-04-02T10:00:00.000Z",
        lastCheckSource: "manual",
      })
    );
  });

  it("marks launch-triggered update checks with the launch source", async () => {
    const updater = new FakeAutoUpdater();
    const scheduledCallbacks: Array<() => void> = [];
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "win32",
      now: () => "2026-04-02T10:00:00.000Z",
      setTimeoutFn: ((callback: () => void) => {
        scheduledCallbacks.push(callback);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimeoutFn: vi.fn(),
    });

    service.start();
    scheduledCallbacks[0]?.();
    await Promise.resolve();

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "available",
        lastCheckSource: "launch",
      })
    );
  });

  it("downloads a discovered update and marks it ready to install", async () => {
    const updater = new FakeAutoUpdater();
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "darwin",
      now: () => "2026-04-02T10:00:00.000Z",
    });

    await service.checkForUpdates();
    await service.downloadUpdate();

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "downloaded",
        release: expect.objectContaining({
          version: "0.2.0",
        }),
        progress: null,
      })
    );
  });

  it("enters a downloading state before the first progress event arrives", async () => {
    const updater = new FakeAutoUpdater();
    let finishDownload: (() => void) | undefined;
    updater.downloadUpdate = vi.fn(
      () =>
        new Promise((resolve) => {
          finishDownload = () => {
            updater.emit("download-progress", {
              bytesPerSecond: 1024,
              percent: 50,
              transferred: 512,
              total: 1024,
            });
            updater.emit("update-downloaded", {
              version: "0.2.0",
              releaseName: "0.2.0",
              releaseDate: "2026-04-02T10:00:00.000Z",
              releaseNotes: "A new build is ready.",
            });
            resolve(null);
          };
        })
    );
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "darwin",
      now: () => "2026-04-02T10:00:00.000Z",
    });

    await service.checkForUpdates();
    const downloadPromise = service.downloadUpdate();

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "downloading",
        message: "Preparing DocTrack 0.2.0 download...",
        progress: null,
      })
    );

    finishDownload?.();
    await downloadPromise;

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "downloaded",
      })
    );
  });

  it("surfaces not-available events", async () => {
    const updater = new FakeAutoUpdater();
    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit("checking-for-update");
      updater.emit("update-not-available", {
        version: "0.1.0",
        releaseName: "0.1.0",
        releaseDate: "2026-04-02T10:00:00.000Z",
        releaseNotes: "No new updates.",
      });
      return null;
    });

    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "win32",
      now: () => "2026-04-02T10:00:00.000Z",
    });

    await service.checkForUpdates();

    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "not-available",
        message: "DocTrack is up to date.",
        lastCheckSource: "manual",
      })
    );
  });

  it("records updater errors", async () => {
    const updater = new FakeAutoUpdater();
    updater.checkForUpdates.mockImplementationOnce(async () => {
      updater.emit("checking-for-update");
      throw new Error("Network unavailable");
    });

    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "win32",
      now: () => "2026-04-02T10:00:00.000Z",
    });

    await expect(service.checkForUpdates()).rejects.toThrow("Network unavailable");
    expect(service.getState()).toEqual(
      expect.objectContaining({
        status: "error",
        message: "Network unavailable",
        lastCheckSource: "manual",
      })
    );
  });

  it("skips the launch check when automatic updates are disabled", () => {
    const updater = new FakeAutoUpdater();
    const setTimeoutFn = vi.fn(() => setTimeout(() => undefined, 0));
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "win32",
      setTimeoutFn,
    });

    service.syncSettings({
      ...DEFAULT_APPLICATION_SETTINGS,
      autoUpdateEnabled: false,
      checkForUpdatesOnLaunch: true,
    });
    service.start();

    expect(setTimeoutFn).not.toHaveBeenCalled();
  });

  it("restarts into the downloaded update", async () => {
    const updater = new FakeAutoUpdater();
    const service = new AppUpdaterService({
      updater,
      currentVersion: "0.1.0",
      isPackaged: true,
      platform: "darwin",
    });

    await service.checkForUpdates();
    await service.downloadUpdate();
    service.quitAndInstall();

    expect(updater.quitAndInstall).toHaveBeenCalledWith();
  });
});
