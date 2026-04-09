import path from 'node:path';
import { app, BrowserWindow, type BrowserWindow as BrowserWindowType } from 'electron';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { registerIpcHandlers } from '@main/ipc';
import { AppUpdaterService } from '@main/services/appUpdaterService';
import { ActivityLogService } from '@main/services/activityLogService';
import { ActorContextService } from '@main/services/actorContextService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentExportService } from '@main/services/documentExportService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { SavedViewService } from '@main/services/savedViewService';
import { TemplateService } from '@main/services/templateService';
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { WorkspaceFilesystemWatcherService } from '@main/services/workspaceFilesystemWatcherService';
import { WorkspaceSessionService } from '@main/services/workspaceSessionService';
import { WorkspaceUserService } from '@main/services/workspaceUserService';
import { WorkspaceService } from '@main/services/workspaceService';
import { IPC_CHANNELS } from '@shared/ipc';

let mainWindow: BrowserWindowType | null = null;

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    movable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(async () => {
  const catalogService = new AppCatalogService(path.join(app.getPath('userData'), 'catalog.json'));
  const appUpdaterService = new AppUpdaterService();
  const workspaceManager = new WorkspaceManager();
  const actorContextService = new ActorContextService();
  const workspaceSessionService = new WorkspaceSessionService();
  const workspaceFilesystemWatcherService = new WorkspaceFilesystemWatcherService((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.workspaceFilesystemDrift, event);
    }
  });
  const fileStorageService = new FileStorageService(workspaceFilesystemWatcherService);
  const templateService = new TemplateService(fileStorageService, workspaceManager);
  const documentIdGenerator = new DocumentIdGeneratorService();
  const activityLogService = new ActivityLogService(actorContextService);
  const workspaceUserService = new WorkspaceUserService(workspaceManager);
  const workspaceBackupService = new WorkspaceBackupService(workspaceManager);
  const documentExportService = new DocumentExportService();
  const documentService = new DocumentService(
    workspaceManager,
    documentIdGenerator,
    fileStorageService,
    templateService,
    activityLogService,
    workspaceUserService,
    workspaceBackupService
  );
  const documentTypeService = new DocumentTypeService(workspaceManager, fileStorageService);
  const workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
  const savedViewService = new SavedViewService(workspaceManager, catalogService);
  const workspaceService = new WorkspaceService(
    workspaceManager,
    documentService,
    fileStorageService,
    templateService,
    workspaceCatalogService,
    catalogService,
    savedViewService,
    documentIdGenerator,
    activityLogService,
    workspaceBackupService,
    workspaceUserService,
    workspaceFilesystemWatcherService
  );

  appUpdaterService.syncSettings(catalogService.getApplicationSettings());

  let isShuttingDown = false;
  let unsubscribeUpdater: () => void = () => {};
  const disposeServices = () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    unsubscribeUpdater();
    appUpdaterService.dispose();
    workspaceFilesystemWatcherService.dispose();
    workspaceSessionService.clearAll();
    workspaceManager.dispose();
  };

  registerIpcHandlers({
    workspaceService,
    documentService,
    documentExportService,
    documentTypeService,
    workspaceCatalogService,
    templateService,
    savedViewService,
    workspaceUserService,
    catalogService,
    appUpdaterService,
    workspaceSessionService,
    actorContextService,
    prepareForAppQuit: disposeServices
  });

  const broadcastAppUpdateState = (): void => {
    const state = appUpdaterService.getState();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.appUpdatesStateChanged, state);
    }
  };
  unsubscribeUpdater = appUpdaterService.subscribe(() => {
    broadcastAppUpdateState();
  });

  await createWindow();
  broadcastAppUpdateState();
  appUpdaterService.start();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
      broadcastAppUpdateState();
    }
  });

  app.on('before-quit', disposeServices);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
