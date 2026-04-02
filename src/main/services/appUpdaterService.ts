import electronUpdater, {
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from "electron-updater";
import { app } from "electron";
import type { ApplicationSettings } from "@shared/applicationSettings";
import type { AppUpdateRelease, AppUpdateState } from "@shared/appUpdates";

type UpdaterSettings = Pick<
  ApplicationSettings,
  "autoUpdateEnabled" | "checkForUpdatesOnLaunch"
>;

type AppUpdaterEventMap = {
  "checking-for-update": [];
  "update-available": [UpdateInfo];
  "update-not-available": [UpdateInfo];
  "download-progress": [ProgressInfo];
  "update-downloaded": [UpdateDownloadedEvent];
  error: [Error];
};

interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on<E extends keyof AppUpdaterEventMap>(
    event: E,
    listener: (...args: AppUpdaterEventMap[E]) => void
  ): this;
}

interface AppUpdaterServiceOptions {
  updater?: AutoUpdaterLike;
  currentVersion?: string;
  isPackaged?: boolean;
  platform?: NodeJS.Platform;
  launchCheckDelayMs?: number;
  now?: () => string;
  setTimeoutFn?: (
    callback: () => void,
    delay: number
  ) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (timeoutId: ReturnType<typeof setTimeout>) => void;
}

const DEFAULT_SETTINGS: UpdaterSettings = {
  autoUpdateEnabled: true,
  checkForUpdatesOnLaunch: true,
};

const DEFAULT_LAUNCH_CHECK_DELAY_MS = 5_000;
const SUPPORTED_PLATFORMS = new Set<NodeJS.Platform>(["darwin", "win32"]);

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "DocTrack could not complete the update request.";

const getDefaultAutoUpdater = (): AutoUpdaterLike =>
  electronUpdater.autoUpdater as unknown as AutoUpdaterLike;

const toRelease = (info: UpdateInfo): AppUpdateRelease => ({
  version: info.version,
  releaseName: info.releaseName ?? null,
  releaseDate: info.releaseDate ?? null,
  releaseNotes:
    typeof info.releaseNotes === "string"
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes
            .map((entry) =>
              typeof entry === "string"
                ? entry
                : `${entry.version}: ${entry.note}`
            )
            .join("\n\n")
        : null,
});

export class AppUpdaterService {
  private readonly updater: AutoUpdaterLike;
  private readonly currentVersion: string;
  private readonly isPackaged: boolean;
  private readonly platform: NodeJS.Platform;
  private readonly now: () => string;
  private readonly launchCheckDelayMs: number;
  private readonly setTimeoutFn: (
    callback: () => void,
    delay: number
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimeoutFn: (
    timeoutId: ReturnType<typeof setTimeout>
  ) => void;
  private readonly listeners = new Set<(state: AppUpdateState) => void>();
  private settings: UpdaterSettings = { ...DEFAULT_SETTINGS };
  private launchCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private state: AppUpdateState;

  constructor({
    updater = getDefaultAutoUpdater(),
    currentVersion = app.getVersion(),
    isPackaged = app.isPackaged,
    platform = process.platform,
    launchCheckDelayMs = DEFAULT_LAUNCH_CHECK_DELAY_MS,
    now = () => new Date().toISOString(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }: AppUpdaterServiceOptions = {}) {
    this.updater = updater;
    this.currentVersion = currentVersion;
    this.isPackaged = isPackaged;
    this.platform = platform;
    this.launchCheckDelayMs = launchCheckDelayMs;
    this.now = now;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.state = this.createBaseState(
      this.isSupported()
        ? {
            status: "idle",
            message: "Ready to check for updates.",
          }
        : {
            status: "unsupported",
            message:
              "App updates are only available in packaged Windows and macOS builds.",
          }
    );

    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.registerUpdaterListeners();
  }

  getState(): AppUpdateState {
    return {
      ...this.state,
      release: this.state.release ? { ...this.state.release } : null,
      progress: this.state.progress ? { ...this.state.progress } : null,
    };
  }

  subscribe(listener: (state: AppUpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  syncSettings(settings: UpdaterSettings): AppUpdateState {
    this.settings = {
      autoUpdateEnabled: settings.autoUpdateEnabled,
      checkForUpdatesOnLaunch: settings.checkForUpdatesOnLaunch,
    };

    if (!this.settings.autoUpdateEnabled && this.state.status === "idle") {
      this.setState({
        message: "Automatic updates are disabled in settings.",
      });
    } else if (this.settings.autoUpdateEnabled && this.state.status === "idle") {
      this.setState({
        message: "Ready to check for updates.",
      });
    }

    if (!this.settings.autoUpdateEnabled || !this.settings.checkForUpdatesOnLaunch) {
      this.clearLaunchCheck();
    }

    return this.getState();
  }

  start(): void {
    this.clearLaunchCheck();

    if (
      !this.isSupported() ||
      !this.settings.autoUpdateEnabled ||
      !this.settings.checkForUpdatesOnLaunch
    ) {
      return;
    }

    this.launchCheckTimeout = this.setTimeoutFn(() => {
      this.launchCheckTimeout = null;
      void this.checkForUpdates().catch(() => undefined);
    }, this.launchCheckDelayMs);
  }

  async checkForUpdates(): Promise<AppUpdateState> {
    if (!this.isSupported()) {
      return this.getState();
    }

    if (!this.settings.autoUpdateEnabled) {
      this.setState({
        status: "idle",
        message: "Automatic updates are disabled in settings.",
        progress: null,
      });
      return this.getState();
    }

    try {
      await this.updater.checkForUpdates();
      return this.getState();
    } catch (error) {
      this.setState({
        status: "error",
        message: formatErrorMessage(error),
        lastCheckedAt: this.now(),
        progress: null,
      });
      throw error;
    }
  }

  async downloadUpdate(): Promise<AppUpdateState> {
    if (!this.isSupported()) {
      return this.getState();
    }

    if (!this.settings.autoUpdateEnabled) {
      this.setState({
        status: "idle",
        message: "Automatic updates are disabled in settings.",
      });
      return this.getState();
    }

    if (!this.state.release) {
      throw new Error("No update is available to download.");
    }

    try {
      await this.updater.downloadUpdate();
      return this.getState();
    } catch (error) {
      this.setState({
        status: "error",
        message: formatErrorMessage(error),
        progress: null,
      });
      throw error;
    }
  }

  quitAndInstall(): void {
    if (this.state.status !== "downloaded") {
      throw new Error("An update must finish downloading before DocTrack can restart.");
    }

    this.updater.quitAndInstall();
  }

  dispose(): void {
    this.clearLaunchCheck();
    this.listeners.clear();
  }

  private isSupported(): boolean {
    return this.isPackaged && SUPPORTED_PLATFORMS.has(this.platform);
  }

  private createBaseState(
    overrides: Partial<AppUpdateState> = {}
  ): AppUpdateState {
    return {
      status: "idle",
      currentVersion: this.currentVersion,
      isSupported: this.isSupported(),
      message: null,
      release: null,
      progress: null,
      lastCheckedAt: null,
      lastUpdatedAt: this.now(),
      ...overrides,
    };
  }

  private setState(overrides: Partial<AppUpdateState>): void {
    this.state = {
      ...this.state,
      ...overrides,
      release:
        overrides.release === undefined
          ? this.state.release
          : overrides.release
            ? { ...overrides.release }
            : null,
      progress:
        overrides.progress === undefined
          ? this.state.progress
          : overrides.progress
            ? { ...overrides.progress }
            : null,
      lastUpdatedAt: this.now(),
    };

    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private clearLaunchCheck(): void {
    if (!this.launchCheckTimeout) {
      return;
    }

    this.clearTimeoutFn(this.launchCheckTimeout);
    this.launchCheckTimeout = null;
  }

  private registerUpdaterListeners(): void {
    this.updater.on("checking-for-update", () => {
      this.setState({
        status: "checking",
        message: "Checking for updates...",
        progress: null,
      });
    });

    this.updater.on("update-available", (info) => {
      this.setState({
        status: "available",
        message: `DocTrack ${info.version} is available to download.`,
        release: toRelease(info),
        lastCheckedAt: this.now(),
        progress: null,
      });
    });

    this.updater.on("update-not-available", (info) => {
      this.setState({
        status: "not-available",
        message: "DocTrack is up to date.",
        release: toRelease(info),
        lastCheckedAt: this.now(),
        progress: null,
      });
    });

    this.updater.on("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        message: this.state.release
          ? `Downloading DocTrack ${this.state.release.version}...`
          : "Downloading update...",
        progress: {
          bytesPerSecond: progress.bytesPerSecond,
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
        },
      });
    });

    this.updater.on("update-downloaded", (info) => {
      this.setState({
        status: "downloaded",
        message: `DocTrack ${info.version} is ready to install.`,
        release: toRelease(info),
        progress: null,
      });
    });

    this.updater.on("error", (error) => {
      this.setState({
        status: "error",
        message: formatErrorMessage(error),
        progress: null,
      });
    });
  }
}
