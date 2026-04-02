export const APP_UPDATE_STATUSES = [
  "unsupported",
  "disabled",
  "idle",
  "checking",
  "available",
  "not-available",
  "downloading",
  "downloaded",
  "error",
] as const;

export type AppUpdateStatus = (typeof APP_UPDATE_STATUSES)[number];

export const APP_UPDATE_CHECK_SOURCES = ["launch", "manual"] as const;

export type AppUpdateCheckSource =
  (typeof APP_UPDATE_CHECK_SOURCES)[number];

export interface AppUpdateRelease {
  version: string;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
}

export interface AppUpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersion: string;
  isSupported: boolean;
  message: string | null;
  release: AppUpdateRelease | null;
  progress: AppUpdateProgress | null;
  lastCheckedAt: string | null;
  lastCheckSource: AppUpdateCheckSource | null;
  lastUpdatedAt: string | null;
}
