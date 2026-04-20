import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceFilesystemDriftEvent } from '@shared/types';
import { WorkspaceFilesystemWatcherService } from '@main/services/workspaceFilesystemWatcherService';

const { watcherHandlers, closeMock, watchMock } = vi.hoisted(() => {
  const handlers = new Map<string, (changedPath: string) => void>();
  const close = vi.fn();
  const watch = vi.fn(() => {
    const watcher = {
      on: vi.fn((event: string, handler: (changedPath: string) => void) => {
        handlers.set(event, handler);
        return watcher;
      }),
      close
    };
    return watcher;
  });

  return {
    watcherHandlers: handlers,
    closeMock: close,
    watchMock: watch
  };
});

vi.mock('chokidar', () => ({
  default: {
    watch: watchMock
  }
}));

describe('WorkspaceFilesystemWatcherService', () => {
  beforeEach(() => {
    watcherHandlers.clear();
    closeMock.mockReset();
    watchMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces filesystem events into a single drift notification', () => {
    const emitted: WorkspaceFilesystemDriftEvent[] = [];
    const service = new WorkspaceFilesystemWatcherService((event) => {
      emitted.push(event);
    }, 50);

    service.ensureWatching('/workspace');
    watcherHandlers.get('add')?.('/workspace/Documents/a.txt');
    watcherHandlers.get('change')?.('/workspace/Documents/b.txt');
    vi.advanceTimersByTime(49);
    expect(emitted).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.rootPath).toBe(path.resolve('/workspace'));
    expect(emitted[0]?.paths).toEqual([
      path.resolve('/workspace/Documents/a.txt'),
      path.resolve('/workspace/Documents/b.txt')
    ]);
  });

  it('suppresses app-originated writes during the suppression window', () => {
    const emitted: WorkspaceFilesystemDriftEvent[] = [];
    const service = new WorkspaceFilesystemWatcherService((event) => {
      emitted.push(event);
    }, 50);

    service.ensureWatching('/workspace');
    service.suppressEvents('/workspace', 100);
    watcherHandlers.get('change')?.('/workspace/Documents/managed.txt');
    vi.advanceTimersByTime(100);

    expect(emitted).toHaveLength(0);
  });

  it('ignores transient Office lock files', () => {
    const emitted: WorkspaceFilesystemDriftEvent[] = [];
    const service = new WorkspaceFilesystemWatcherService((event) => {
      emitted.push(event);
    }, 50);

    service.ensureWatching('/workspace');
    watcherHandlers.get('add')?.('/workspace/Documents/~$maintenance-plan.docx');
    watcherHandlers.get('change')?.('/workspace/Documents/~WRD0000.tmp');
    watcherHandlers.get('change')?.('/workspace/Documents/working-copy.docx');
    vi.advanceTimersByTime(50);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.paths).toEqual([path.resolve('/workspace/Documents/working-copy.docx')]);
  });

  it('can pause and resume watching without losing the registration', () => {
    const emitted: WorkspaceFilesystemDriftEvent[] = [];
    const service = new WorkspaceFilesystemWatcherService((event) => {
      emitted.push(event);
    }, 50);

    service.ensureWatching('/workspace');
    expect(watchMock).toHaveBeenCalledTimes(1);

    service.pauseWatching('/workspace');
    expect(closeMock).toHaveBeenCalledTimes(1);

    service.resumeWatching('/workspace');
    expect(watchMock).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(0);
  });
});
