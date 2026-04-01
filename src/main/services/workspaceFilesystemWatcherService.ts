import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import {
  WORKSPACE_DOCUMENTS_DIRECTORY_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME
} from '@shared/workspaceLayout';
import type { WorkspaceFilesystemDriftEvent } from '@shared/types';
import { nowIso } from '@main/utils/date';

interface WatchRegistration {
  watcher: FSWatcher;
  debounceTimer: NodeJS.Timeout | null;
  pendingPaths: Set<string>;
}

export class WorkspaceFilesystemWatcherService {
  private readonly registrations = new Map<string, WatchRegistration>();
  private readonly suppressedUntilByRootPath = new Map<string, number>();

  constructor(
    private readonly emit: (event: WorkspaceFilesystemDriftEvent) => void,
    private readonly debounceMs = 250
  ) {}

  ensureWatching(rootPath: string): void {
    const resolvedRootPath = path.resolve(rootPath);
    if (this.registrations.has(resolvedRootPath)) {
      return;
    }

    const watcher = chokidar.watch(
      [
        path.join(resolvedRootPath, WORKSPACE_DOCUMENTS_DIRECTORY_NAME),
        path.join(resolvedRootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME)
      ],
      {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50
        }
      }
    );

    const registration: WatchRegistration = {
      watcher,
      debounceTimer: null,
      pendingPaths: new Set<string>()
    };
    const queue = (changedPath: string): void => {
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

    registration.watcher.close();
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

  dispose(): void {
    for (const rootPath of [...this.registrations.keys()]) {
      this.closeWatching(rootPath);
    }
  }
}
