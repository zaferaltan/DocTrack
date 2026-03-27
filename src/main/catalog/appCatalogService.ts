import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppCatalogState, RecentWorkspace, ThemeMode } from '@shared/types';
import { nowIso } from '@main/utils/date';

const DEFAULT_STATE: AppCatalogState = {
  recentWorkspaces: [],
  themeMode: 'system'
};

export class AppCatalogService {
  constructor(private readonly filePath: string) {}

  listRecentWorkspaces(): RecentWorkspace[] {
    return this.readState().recentWorkspaces;
  }

  touchRecentWorkspace(workspace: Pick<RecentWorkspace, 'rootPath' | 'name'>): RecentWorkspace[] {
    const state = this.readState();
    const updated: RecentWorkspace = {
      ...workspace,
      lastOpenedDate: nowIso()
    };

    state.recentWorkspaces = [
      updated,
      ...state.recentWorkspaces.filter((item) => item.rootPath !== workspace.rootPath)
    ].slice(0, 12);

    this.writeState(state);
    return state.recentWorkspaces;
  }

  getThemeMode(): ThemeMode {
    return this.readState().themeMode;
  }

  setThemeMode(themeMode: ThemeMode): ThemeMode {
    const state = this.readState();
    state.themeMode = themeMode;
    this.writeState(state);
    return themeMode;
  }

  private readState(): AppCatalogState {
    if (!existsSync(this.filePath)) {
      return { ...DEFAULT_STATE };
    }

    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<AppCatalogState>;
      const recentWorkspaces = Array.isArray(value.recentWorkspaces)
        ? value.recentWorkspaces
            .map((item) => {
              if (!item || typeof item !== 'object') {
                return undefined;
              }

              const candidate = item as Partial<RecentWorkspace> & { filePath?: string };
              const rootPath =
                typeof candidate.rootPath === 'string'
                  ? candidate.rootPath
                  : typeof candidate.filePath === 'string'
                    ? candidate.filePath
                    : undefined;

              if (
                !rootPath ||
                typeof candidate.name !== 'string' ||
                typeof candidate.lastOpenedDate !== 'string'
              ) {
                return undefined;
              }

              return {
                rootPath,
                name: candidate.name,
                lastOpenedDate: candidate.lastOpenedDate
              };
            })
            .filter((item): item is RecentWorkspace => item !== undefined)
        : [];

      return {
        recentWorkspaces,
        themeMode:
          value.themeMode === 'light' || value.themeMode === 'dark' || value.themeMode === 'system'
            ? value.themeMode
            : 'system'
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private writeState(state: AppCatalogState): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}
