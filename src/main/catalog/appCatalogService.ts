import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_APPLICATION_SETTINGS,
  isApplicationLaunchBehavior,
  isDocumentDetailViewMode,
  isDocumentsVisualizationMode,
  isDocumentTableDensity,
  isThemeMode,
  isWorkspaceTabDensity,
  isWorkspaceView,
  normalizeKeyboardShortcuts,
  normalizeDocumentTableVisibleColumns,
  type ApplicationSettings
} from '@shared/applicationSettings';
import { isDocumentVersionScheme } from '@shared/documentModel';
import {
  normalizeSavedViews,
  remapSavedViewStatuses,
  type SavedView,
  type SavedViewStatusNameRemap
} from '@shared/savedViews';
import type { AppCatalogState, RecentWorkspace } from '@shared/types';
import { nowIso } from '@main/utils/date';

const DEFAULT_STATE: AppCatalogState = {
  recentWorkspaces: [],
  applicationSettings: { ...DEFAULT_APPLICATION_SETTINGS },
  personalSavedViewsByWorkspace: {}
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

  dismissRecentWorkspace(rootPath: string): RecentWorkspace[] {
    const state = this.readState();
    state.recentWorkspaces = state.recentWorkspaces.filter((item) => item.rootPath !== rootPath);
    this.writeState(state);
    return state.recentWorkspaces;
  }

  getApplicationSettings(): ApplicationSettings {
    return this.readState().applicationSettings;
  }

  updateApplicationSettings(settings: ApplicationSettings): ApplicationSettings {
    const state = this.readState();
    state.applicationSettings = this.normalizeApplicationSettings(settings);
    this.writeState(state);
    return state.applicationSettings;
  }

  listPersonalSavedViews(rootPath: string): SavedView[] {
    return this.readState().personalSavedViewsByWorkspace[rootPath] ?? [];
  }

  createPersonalSavedView(rootPath: string, savedView: SavedView): SavedView {
    const state = this.readState();
    const currentViews = state.personalSavedViewsByWorkspace[rootPath] ?? [];
    state.personalSavedViewsByWorkspace[rootPath] = normalizeSavedViews(
      [...currentViews, savedView],
      'personal'
    );
    this.writeState(state);
    return savedView;
  }

  updatePersonalSavedView(rootPath: string, savedView: SavedView): SavedView {
    const state = this.readState();
    const currentViews = state.personalSavedViewsByWorkspace[rootPath] ?? [];
    state.personalSavedViewsByWorkspace[rootPath] = normalizeSavedViews(
      currentViews.map((item) => (item.id === savedView.id ? savedView : item)),
      'personal'
    );
    this.writeState(state);
    return savedView;
  }

  deletePersonalSavedView(rootPath: string, savedViewId: string): void {
    const state = this.readState();
    const currentViews = state.personalSavedViewsByWorkspace[rootPath] ?? [];
    state.personalSavedViewsByWorkspace[rootPath] = currentViews.filter(
      (item) => item.id !== savedViewId
    );
    if (state.personalSavedViewsByWorkspace[rootPath]?.length === 0) {
      delete state.personalSavedViewsByWorkspace[rootPath];
    }
    this.writeState(state);
  }

  remapPersonalSavedViewStatuses(
    rootPath: string,
    remaps: SavedViewStatusNameRemap[]
  ): SavedView[] {
    if (remaps.length === 0) {
      return this.listPersonalSavedViews(rootPath);
    }

    const state = this.readState();
    const currentViews = state.personalSavedViewsByWorkspace[rootPath] ?? [];
    if (currentViews.length === 0) {
      return [];
    }

    state.personalSavedViewsByWorkspace[rootPath] = normalizeSavedViews(
      currentViews.map((savedView) => remapSavedViewStatuses(savedView, remaps)),
      'personal'
    );
    this.writeState(state);
    return state.personalSavedViewsByWorkspace[rootPath] ?? [];
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
        applicationSettings: this.normalizeApplicationSettings(value.applicationSettings, value),
        personalSavedViewsByWorkspace: this.normalizePersonalSavedViewsByWorkspace(
          value.personalSavedViewsByWorkspace
        )
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private normalizeApplicationSettings(
    settings?: Partial<ApplicationSettings>,
    legacyValue?: Partial<AppCatalogState> & { themeMode?: unknown }
  ): ApplicationSettings {
    const nextSettings = settings ?? {};
    const legacyThemeMode = legacyValue?.themeMode;

    return {
      themeMode:
        typeof nextSettings.themeMode === 'string' && isThemeMode(nextSettings.themeMode)
          ? nextSettings.themeMode
          : typeof legacyThemeMode === 'string' && isThemeMode(legacyThemeMode)
            ? legacyThemeMode
            : DEFAULT_APPLICATION_SETTINGS.themeMode,
      launchBehavior:
        typeof nextSettings.launchBehavior === 'string' &&
        isApplicationLaunchBehavior(nextSettings.launchBehavior)
          ? nextSettings.launchBehavior
          : DEFAULT_APPLICATION_SETTINGS.launchBehavior,
      defaultWorkspaceView:
        typeof nextSettings.defaultWorkspaceView === 'string' &&
        isWorkspaceView(nextSettings.defaultWorkspaceView)
          ? nextSettings.defaultWorkspaceView
          : DEFAULT_APPLICATION_SETTINGS.defaultWorkspaceView,
      documentDetailViewMode:
        typeof nextSettings.documentDetailViewMode === 'string' &&
        isDocumentDetailViewMode(nextSettings.documentDetailViewMode)
          ? nextSettings.documentDetailViewMode
          : DEFAULT_APPLICATION_SETTINGS.documentDetailViewMode,
      defaultDocumentsVisualization:
        typeof nextSettings.defaultDocumentsVisualization === 'string' &&
        isDocumentsVisualizationMode(nextSettings.defaultDocumentsVisualization)
          ? nextSettings.defaultDocumentsVisualization
          : DEFAULT_APPLICATION_SETTINGS.defaultDocumentsVisualization,
      documentDetailSidebarWidth:
        typeof nextSettings.documentDetailSidebarWidth === 'number' &&
        Number.isFinite(nextSettings.documentDetailSidebarWidth) &&
        nextSettings.documentDetailSidebarWidth > 0
          ? Math.round(nextSettings.documentDetailSidebarWidth)
          : DEFAULT_APPLICATION_SETTINGS.documentDetailSidebarWidth,
      documentTableDensity:
        typeof nextSettings.documentTableDensity === 'string' &&
        isDocumentTableDensity(nextSettings.documentTableDensity)
          ? nextSettings.documentTableDensity
          : DEFAULT_APPLICATION_SETTINGS.documentTableDensity,
      workspaceTabDensity:
        typeof nextSettings.workspaceTabDensity === 'string' &&
        isWorkspaceTabDensity(nextSettings.workspaceTabDensity)
          ? nextSettings.workspaceTabDensity
          : DEFAULT_APPLICATION_SETTINGS.workspaceTabDensity,
      documentTableVisibleColumns: normalizeDocumentTableVisibleColumns(
        nextSettings.documentTableVisibleColumns
      ),
      keyboardShortcuts: normalizeKeyboardShortcuts(nextSettings.keyboardShortcuts),
      defaultIncludeExampleData:
        typeof nextSettings.defaultIncludeExampleData === 'boolean'
          ? nextSettings.defaultIncludeExampleData
          : DEFAULT_APPLICATION_SETTINGS.defaultIncludeExampleData,
      defaultDocumentAuthor:
        typeof nextSettings.defaultDocumentAuthor === 'string'
          ? nextSettings.defaultDocumentAuthor
          : DEFAULT_APPLICATION_SETTINGS.defaultDocumentAuthor,
      defaultDocumentVersionScheme:
        typeof nextSettings.defaultDocumentVersionScheme === 'string' &&
        isDocumentVersionScheme(nextSettings.defaultDocumentVersionScheme)
          ? nextSettings.defaultDocumentVersionScheme
          : DEFAULT_APPLICATION_SETTINGS.defaultDocumentVersionScheme,
      confirmDestructiveActions:
        typeof nextSettings.confirmDestructiveActions === 'boolean'
          ? nextSettings.confirmDestructiveActions
          : DEFAULT_APPLICATION_SETTINGS.confirmDestructiveActions,
      autoDismissSuccessNotifications:
        typeof nextSettings.autoDismissSuccessNotifications === 'boolean'
          ? nextSettings.autoDismissSuccessNotifications
          : DEFAULT_APPLICATION_SETTINGS.autoDismissSuccessNotifications,
      autoUpdateEnabled:
        typeof nextSettings.autoUpdateEnabled === 'boolean'
          ? nextSettings.autoUpdateEnabled
          : DEFAULT_APPLICATION_SETTINGS.autoUpdateEnabled,
      checkForUpdatesOnLaunch:
        typeof nextSettings.checkForUpdatesOnLaunch === 'boolean'
          ? nextSettings.checkForUpdatesOnLaunch
          : DEFAULT_APPLICATION_SETTINGS.checkForUpdatesOnLaunch
    };
  }

  private normalizePersonalSavedViewsByWorkspace(value: unknown): Record<string, SavedView[]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([rootPath]) => typeof rootPath === 'string' && rootPath.trim().length > 0)
        .map(([rootPath, savedViews]) => [rootPath, normalizeSavedViews(savedViews, 'personal')])
        .filter(([, savedViews]) => savedViews.length > 0)
    );
  }

  private writeState(state: AppCatalogState): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}
