import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME
} from '@shared/workspaceLayout';
import type { WorkspaceSettings } from '@shared/workspaceLayout';
import type { WorkspaceFilesystemDriftEvent } from '@shared/types';
import { nowIso } from '@main/utils/date';
import { isIgnoredWorkspaceFilesystemEntryName } from '@main/utils/filesystemEntries';

interface WatchRegistration {
  watcher: FSWatcher | null;
  debounceTimer: NodeJS.Timeout | null;
  pendingPaths: Set<string>;
  settings: Pick<WorkspaceSettings, 'documentsDirectoryName' | 'templatesDirectoryName'>;
  pauseDepth: number;
}

export class WorkspaceFilesystemWatcherService {
  private readonly registrations = new Map<string, WatchRegistration>();
  private readonly suppressedUntilByRootPath = new Map<string, number>();

  constructor(
    private readonly emit: (event: WorkspaceFilesystemDriftEvent) => void,
    private readonly debounceMs = 250
  ) {}

  ensureWatching(
    rootPath: string,
    settings: Pick<WorkspaceSettings, 'documentsDirectoryName' | 'templatesDirectoryName'> = DEFAULT_WORKSPACE_SETTINGS
  ): void {
    const resolvedRootPath = path.resolve(rootPath);
    const existingRegistration = this.registrations.get(resolvedRootPath);
    if (existingRegistration) {
      existingRegistration.settings = settings;
      if (!existingRegistration.watcher && existingRegistration.pauseDepth === 0) {
        existingRegistration.watcher = this.createWatcher(resolvedRootPath, existingRegistration);
      }
      return;
    }

    const registration: WatchRegistration = {
      watcher: null,
      debounceTimer: null,
      pendingPaths: new Set<string>(),
      settings,
      pauseDepth: 0
    };
    registration.watcher = this.createWatcher(resolvedRootPath, registration);
    this.registrations.set(resolvedRootPath, registration);
  }

  closeWatching(rootPath: string): void {
    const resolvedRootPath = path.resolve(rootPath);
    const registration = this.registrations.get(resolvedRootPath);
    if (!registration) {
      return;
    }

    if (registration.debounceTimer) {
      clearTimeout(registration.debounceTimer);
    }

    registration.pendingPaths.clear();
    registration.watcher?.close();
    this.registrations.delete(resolvedRootPath);
    this.suppressedUntilByRootPath.delete(resolvedRootPath);
  }

  suppressEvents(rootPath: string, durationMs = 750): void {
    const resolvedRootPath = path.resolve(rootPath);
    this.suppressedUntilByRootPath.set(
      resolvedRootPath,
      Math.max(this.suppressedUntilByRootPath.get(resolvedRootPath) ?? 0, Date.now() + durationMs)
    );
  }

  pauseWatching(rootPath: string): void {
    const resolvedRootPath = path.resolve(rootPath);
    const registration = this.registrations.get(resolvedRootPath);
    if (!registration) {
      return;
    }

    registration.pauseDepth += 1;
    if (registration.pauseDepth > 1 || !registration.watcher) {
      return;
    }

    if (registration.debounceTimer) {
      clearTimeout(registration.debounceTimer);
      registration.debounceTimer = null;
    }

    registration.pendingPaths.clear();
    registration.watcher.close();
    registration.watcher = null;
  }

  resumeWatching(rootPath: string): void {
    const resolvedRootPath = path.resolve(rootPath);
    const registration = this.registrations.get(resolvedRootPath);
    if (!registration || registration.pauseDepth === 0) {
      return;
    }

    registration.pauseDepth -= 1;
    if (registration.pauseDepth > 0 || registration.watcher) {
      return;
    }

    registration.watcher = this.createWatcher(resolvedRootPath, registration);
  }

  dispose(): void {
    for (const rootPath of [...this.registrations.keys()]) {
      this.closeWatching(rootPath);
    }
  }

  private createWatcher(resolvedRootPath: string, registration: WatchRegistration): FSWatcher {
    const watcher = chokidar.watch(
      [
        path.join(
          resolvedRootPath,
          registration.settings.documentsDirectoryName || WORKSPACE_DOCUMENTS_DIRECTORY_NAME
        ),
        path.join(
          resolvedRootPath,
          registration.settings.templatesDirectoryName || WORKSPACE_TEMPLATES_DIRECTORY_NAME
        )
      ],
      {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50
        }
      }
    );

    const queue = (changedPath: string): void => {
      if (isIgnoredWorkspaceFilesystemEntryName(path.basename(changedPath))) {
        return;
      }

      if (Date.now() < (this.suppressedUntilByRootPath.get(resolvedRootPath) ?? 0)) {
        return;
      }

      registration.pendingPaths.add(path.resolve(changedPath));
      if (registration.debounceTimer) {
        clearTimeout(registration.debounceTimer);
      }

      registration.debounceTimer = setTimeout(() => {
        registration.debounceTimer = null;
        const paths = [...registration.pendingPaths].sort((left, right) => left.localeCompare(right));
        registration.pendingPaths.clear();
        if (paths.length === 0) {
          return;
        }

        this.emit({
          rootPath: resolvedRootPath,
          paths,
          changedAt: nowIso()
        });
      }, this.debounceMs);
    };

    watcher.on('add', queue);
    watcher.on('addDir', queue);
    watcher.on('change', queue);
    watcher.on('unlink', queue);
    watcher.on('unlinkDir', queue);
    return watcher;
  }
}
