import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  DEFAULT_APPLICATION_SETTINGS,
  type ApplicationSettings
} from '@shared/applicationSettings';
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
      defaultDocumentVersionScheme: 'major-minor',
      confirmDestructiveActions: false,
      autoDismissSuccessNotifications: false
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
            documentDetailSidebarWidth: 2400,
            workspaceTabDensity: 'dense',
            keyboardShortcuts: {
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
      documentDetailSidebarWidth: 2000,
      keyboardShortcuts: {
        ...DEFAULT_KEYBOARD_SHORTCUTS,
        openSettings: 'Mod+,',
        newWorkspace: 'Mod+Shift+N',
        openWorkspaceFolder: null,
        newDocument: null,
        focusSearch: 'Mod+F'
      }
    });
  });
});
