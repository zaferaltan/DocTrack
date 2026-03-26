import { dialog, ipcMain } from 'electron';
import type { AppCatalogService } from '@main/catalog/appCatalogService';
import type { DocumentService } from '@main/services/documentService';
import type { DocumentTypeService } from '@main/services/documentTypeService';
import type { WorkspaceService } from '@main/services/workspaceService';
import { IPC_CHANNELS } from '@shared/ipc';
import type { ThemeMode } from '@shared/types';

interface ServiceContainer {
  workspaceService: WorkspaceService;
  documentService: DocumentService;
  documentTypeService: DocumentTypeService;
  catalogService: AppCatalogService;
}

export const registerIpcHandlers = (services: ServiceContainer): void => {
  ipcMain.handle(IPC_CHANNELS.workspaceCreate, (_event, input) =>
    services.workspaceService.create(input)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, (_event, filePath: string) =>
    services.workspaceService.open(filePath)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceClose, (_event, filePath: string) =>
    services.workspaceService.close(filePath)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceListOpen, () => services.workspaceService.listOpen());
  ipcMain.handle(IPC_CHANNELS.workspaceListRecent, () => services.workspaceService.listRecent());
  ipcMain.handle(IPC_CHANNELS.workspaceGetSummary, (_event, filePath: string) =>
    services.workspaceService.getSummary(filePath)
  );

  ipcMain.handle(IPC_CHANNELS.dialogPickWorkspaceCreatePath, async (_event, workspaceName?: string) => {
    const result = await dialog.showSaveDialog({
      title: 'Create Workspace',
      defaultPath: workspaceName ? `${workspaceName}.sqlite` : 'DocTrack Workspace.sqlite',
      filters: [{ name: 'SQLite Workspace', extensions: ['sqlite', 'db'] }]
    });

    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle(IPC_CHANNELS.dialogPickWorkspaceOpenPath, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Workspace',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Workspace', extensions: ['sqlite', 'db'] }]
    });

    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.dialogPickDocumentFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Document File',
      properties: ['openFile']
    });

    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.documentsList, (_event, filePath: string) =>
    services.documentService.list(filePath)
  );
  ipcMain.handle(IPC_CHANNELS.documentsDetail, (_event, filePath: string, documentRecordId: number) =>
    services.documentService.getDetail(filePath, documentRecordId)
  );
  ipcMain.handle(IPC_CHANNELS.documentsCreate, (_event, filePath: string, input) =>
    services.documentService.create(filePath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsCreateVersion, (_event, filePath: string, input) =>
    services.documentService.createVersion(filePath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsUpdateStatus, (_event, filePath: string, input) =>
    services.documentService.updateStatus(filePath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsOpenFile, (_event, filePath: string, documentVersionId: number) =>
    services.documentService.openFile(filePath, documentVersionId)
  );

  ipcMain.handle(IPC_CHANNELS.documentTypesList, (_event, filePath: string) =>
    services.documentTypeService.list(filePath)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesCreate, (_event, filePath: string, input) =>
    services.documentTypeService.create(filePath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesUpdate, (_event, filePath: string, id: number, input) =>
    services.documentTypeService.update(filePath, id, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesDelete, (_event, filePath: string, id: number) =>
    services.documentTypeService.delete(filePath, id)
  );

  ipcMain.handle(IPC_CHANNELS.themeGet, () => services.catalogService.getThemeMode());
  ipcMain.handle(IPC_CHANNELS.themeSet, (_event, themeMode: ThemeMode) =>
    services.catalogService.setThemeMode(themeMode)
  );
};
