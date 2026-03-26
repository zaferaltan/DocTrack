import path from 'node:path';
import { app, BrowserWindow, type BrowserWindow as BrowserWindowType } from 'electron';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { registerIpcHandlers } from '@main/ipc';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { WorkspaceService } from '@main/services/workspaceService';

let mainWindow: BrowserWindowType | null = null;

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
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
  const workspaceManager = new WorkspaceManager();
  const fileStorageService = new FileStorageService();
  const documentIdGenerator = new DocumentIdGeneratorService();
  const documentService = new DocumentService(
    workspaceManager,
    documentIdGenerator,
    fileStorageService
  );
  const documentTypeService = new DocumentTypeService(workspaceManager);
  const workspaceService = new WorkspaceService(
    workspaceManager,
    documentService,
    fileStorageService,
    catalogService,
    documentIdGenerator
  );

  registerIpcHandlers({
    workspaceService,
    documentService,
    documentTypeService,
    catalogService
  });

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
