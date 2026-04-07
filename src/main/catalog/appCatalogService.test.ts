import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
import { DEFAULT_SAVED_VIEW_PRESENTATION, type SavedView } from '@shared/savedViews';
import { afterEach, describe, expect, it } from 'vitest';
import { AppCatalogService } from '@main/catalog/appCatalogService';

describe('app catalog service', () => {
  let tempRoot = '';

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  const createService = (): AppCatalogService => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-catalog-'));
    return new AppCatalogService(path.join(tempRoot, 'catalog.json'));
  };

  it('returns default application settings when the catalog file does not exist', () => {
    const service = createService();

    expect(service.listRecentWorkspaces()).toEqual([]);
    expect(service.getApplicationSettings()).toEqual(DEFAULT_APPLICATION_SETTINGS);
  });

  it('persists application settings and recent workspaces', () => {
    const service = createService();
    const settings: ApplicationSettings = {
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'dark',
      launchBehavior: 'reopen-last-workspace',
      defaultWorkspaceView: 'documentTypes',
      documentDetailViewMode: 'modal',
      defaultDocumentsVisualization: 'kanban',
      documentDetailSidebarWidth: 820,
      documentTableDensity: 'compact',
      workspaceTabDensity: 'compact',
      keyboardShortcuts: {
        ...DEFAULT_KEYBOARD_SHORTCUTS,
        openWorkspaceFolder: 'Mod+Shift+O',
        newDocument: null
      },
      defaultIncludeExampleData: false,
      defaultDocumentAuthor: 'Taylor Reed',
      defaultDocumentVersionScheme: 'alpha-uppercase',
      confirmDestructiveActions: false,
      autoDismissSuccessNotifications: false,
      autoUpdateEnabled: false,
      checkForUpdatesOnLaunch: false
    };

    service.touchRecentWorkspace({
      rootPath: '/Workspaces/Quality',
      name: 'Quality'
    });
    service.updateApplicationSettings(settings);

    const reopened = new AppCatalogService(path.join(tempRoot, 'catalog.json'));

    expect(reopened.listRecentWorkspaces()).toEqual([
      expect.objectContaining({
        rootPath: '/Workspaces/Quality',
        name: 'Quality'
      })
    ]);
    expect(reopened.getApplicationSettings()).toEqual(settings);
  });

  it('preserves sidebar widths below the old fixed pixel minimum', () => {
    const service = createService();

    service.updateApplicationSettings({
      ...DEFAULT_APPLICATION_SETTINGS,
      documentDetailSidebarWidth: 420
    });

    expect(service.getApplicationSettings()).toEqual({
      ...DEFAULT_APPLICATION_SETTINGS,
      documentDetailSidebarWidth: 420
    });
  });

  it('migrates legacy theme mode catalogs into application settings', () => {
    const service = createService();
    const catalogPath = path.join(tempRoot, 'catalog.json');

    writeFileSync(
      catalogPath,
      JSON.stringify(
        {
          recentWorkspaces: [
            {
              rootPath: '/Workspaces/Quality',
              name: 'Quality',
              lastOpenedDate: '2026-03-28T12:00:00.000Z'
            }
          ],
          themeMode: 'dark'
        },
        null,
        2
      ),
      'utf8'
    );

    expect(service.getApplicationSettings()).toEqual({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'dark'
    });
    expect(service.listRecentWorkspaces()).toEqual([
      {
        rootPath: '/Workspaces/Quality',
        name: 'Quality',
        lastOpenedDate: '2026-03-28T12:00:00.000Z'
      }
    ]);
  });

  it('normalizes new UI settings and invalid shortcut data safely', () => {
    const service = createService();
    const catalogPath = path.join(tempRoot, 'catalog.json');

    writeFileSync(
      catalogPath,
      JSON.stringify(
        {
          applicationSettings: {
            documentDetailViewMode: 'invalid',
            defaultDocumentsVisualization: 'matrix',
            documentDetailSidebarWidth: -40,
            workspaceTabDensity: 'dense',
            keyboardShortcuts: {
              openCommandPalette: 'meta + k',
              openSettings: 'ctrl + ,',
              newWorkspace: 'meta + shift + n',
              openWorkspaceFolder: 'bad+value+pair',
              newDocument: '',
              focusSearch: 'mod + f'
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    expect(service.getApplicationSettings()).toEqual({
      ...DEFAULT_APPLICATION_SETTINGS,
      keyboardShortcuts: {
        ...DEFAULT_KEYBOARD_SHORTCUTS,
        openCommandPalette: 'Mod+K',
        openSettings: 'Mod+,',
        newWorkspace: 'Mod+Shift+N',
        openWorkspaceFolder: null,
        newDocument: null,
        focusSearch: 'Mod+F'
      }
    });
  });

  it('defaults updater settings when older catalogs do not include them', () => {
    const service = createService();
    const catalogPath = path.join(tempRoot, 'catalog.json');

    writeFileSync(
      catalogPath,
      JSON.stringify(
        {
          applicationSettings: {
            themeMode: 'dark',
            autoDismissSuccessNotifications: false
          }
        },
        null,
        2
      ),
      'utf8'
    );

    expect(service.getApplicationSettings()).toEqual({
      ...DEFAULT_APPLICATION_SETTINGS,
      themeMode: 'dark',
      autoDismissSuccessNotifications: false
    });
  });

  it('persists personal saved views per workspace', () => {
    const service = createService();
    const savedView: SavedView = {
      id: 'view-1',
      name: 'Overdue procedures',
      scope: 'personal',
      query: {
        search: '',
        statusFilter: 'All',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: [
          {
            id: 'rule-1',
            field: 'documentType',
            operator: 'is',
            value: 'Procedure'
          },
          {
            id: 'rule-2',
            field: 'healthFlag',
            operator: 'is',
            value: 'overdueReview'
          }
        ]
      },
      presentation: {
        ...DEFAULT_SAVED_VIEW_PRESENTATION,
        visualizationMode: 'kanban'
      },
      createdDate: '2026-04-06T09:00:00.000Z',
      modifiedDate: '2026-04-06T09:00:00.000Z'
    };

    service.createPersonalSavedView('/Workspaces/Quality', savedView);

    const reopened = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    expect(reopened.listPersonalSavedViews('/Workspaces/Quality')).toEqual([savedView]);
    expect(reopened.listPersonalSavedViews('/Workspaces/Other')).toEqual([]);
  });

  it('normalizes invalid personal saved view payloads safely', () => {
    const service = createService();
    const catalogPath = path.join(tempRoot, 'catalog.json');

    writeFileSync(
      catalogPath,
      JSON.stringify(
        {
          personalSavedViewsByWorkspace: {
            '/Workspaces/Quality': [
              {
                id: 'view-1',
                name: 'Released this month',
                scope: 'personal',
                query: {
                  statusFilter: 'bad',
                  rules: [
                    {
                      id: 'rule-1',
                      field: 'releasedDate',
                      operator: 'thisMonth'
                    }
                  ]
                },
                presentation: {
                  visualizationMode: 'invalid'
                },
                createdDate: '2026-04-06T09:00:00.000Z',
                modifiedDate: '2026-04-06T09:00:00.000Z'
              },
              {
                bad: true
              }
            ]
          }
        },
        null,
        2
      ),
      'utf8'
    );

    expect(service.listPersonalSavedViews('/Workspaces/Quality')).toEqual([
      {
        id: 'view-1',
        name: 'Released this month',
        scope: 'personal',
        query: {
          search: '',
          statusFilter: 'bad',
          projectFilter: 'All',
          healthFilter: 'All',
          rules: [
            {
              id: 'rule-1',
              field: 'releasedDate',
              operator: 'thisMonth',
              value: undefined,
              secondaryValue: undefined,
              amount: undefined
            }
          ]
        },
        presentation: DEFAULT_SAVED_VIEW_PRESENTATION,
        createdDate: '2026-04-06T09:00:00.000Z',
        modifiedDate: '2026-04-06T09:00:00.000Z'
      }
    ]);
  });
});
