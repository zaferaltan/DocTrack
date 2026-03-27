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
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, (_event, rootPath: string) =>
    services.workspaceService.open(rootPath)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceClose, (_event, rootPath: string) =>
    services.workspaceService.close(rootPath)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceListOpen, () => services.workspaceService.listOpen());
  ipcMain.handle(IPC_CHANNELS.workspaceListRecent, () => services.workspaceService.listRecent());
  ipcMain.handle(IPC_CHANNELS.workspaceGetSummary, (_event, rootPath: string) =>
    services.workspaceService.getSummary(rootPath)
  );
  ipcMain.handle(IPC_CHANNELS.workspaceUpdateSettings, (_event, rootPath: string, settings) =>
    services.workspaceService.updateSettings(rootPath, settings)
  );

  ipcMain.handle(IPC_CHANNELS.dialogPickWorkspaceCreatePath, async (_event, workspaceName?: string) => {
    const result = await dialog.showOpenDialog({
      title: workspaceName ? `Choose a location for "${workspaceName}"` : 'Choose Workspace Location',
      properties: ['openDirectory', 'createDirectory']
    });

    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.dialogPickWorkspaceOpenPath, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Workspace Folder',
      properties: ['openDirectory']
    });

    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.dialogPickDocumentFiles, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Document Files',
      properties: ['openFile', 'multiSelections']
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.documentsList, (_event, rootPath: string) =>
    services.documentService.list(rootPath)
  );
  ipcMain.handle(IPC_CHANNELS.documentsDetail, (_event, rootPath: string, documentRecordId: number) =>
    services.documentService.getDetail(rootPath, documentRecordId)
  );
  ipcMain.handle(IPC_CHANNELS.documentsCreate, (_event, rootPath: string, input) =>
    services.documentService.create(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsCreateVersion, (_event, rootPath: string, input) =>
    services.documentService.createVersion(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsAddVersionFiles, (_event, rootPath: string, input) =>
    services.documentService.addVersionFiles(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsRenameVersionFile, (_event, rootPath: string, input) =>
    services.documentService.renameVersionFile(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsDeleteVersionFile, (_event, rootPath: string, input) =>
    services.documentService.deleteVersionFile(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsChangeVersionFileRole, (_event, rootPath: string, input) =>
    services.documentService.changeVersionFileRole(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsSyncVersionFiles, (_event, rootPath: string, documentVersionId: number) =>
    services.documentService.syncVersionFiles(rootPath, documentVersionId)
  );
  ipcMain.handle(IPC_CHANNELS.documentsUpdateStatus, (_event, rootPath: string, input) =>
    services.documentService.updateStatus(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentsOpenVersionFile, (_event, rootPath: string, fileId: number) =>
    services.documentService.openVersionFile(rootPath, fileId)
  );
  ipcMain.handle(IPC_CHANNELS.documentsOpenDocumentFolder, (_event, rootPath: string, documentRecordId: number) =>
    services.documentService.openDocumentFolder(rootPath, documentRecordId)
  );
  ipcMain.handle(IPC_CHANNELS.documentsOpenVersionFolder, (_event, rootPath: string, documentVersionId: number) =>
    services.documentService.openVersionFolder(rootPath, documentVersionId)
  );

  ipcMain.handle(IPC_CHANNELS.documentTypesList, (_event, rootPath: string) =>
    services.documentTypeService.list(rootPath)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesCreate, (_event, rootPath: string, input) =>
    services.documentTypeService.create(rootPath, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesUpdate, (_event, rootPath: string, id: number, input) =>
    services.documentTypeService.update(rootPath, id, input)
  );
  ipcMain.handle(IPC_CHANNELS.documentTypesDelete, (_event, rootPath: string, id: number) =>
    services.documentTypeService.delete(rootPath, id)
  );

  ipcMain.handle(IPC_CHANNELS.themeGet, () => services.catalogService.getThemeMode());
  ipcMain.handle(IPC_CHANNELS.themeSet, (_event, themeMode: ThemeMode) =>
    services.catalogService.setThemeMode(themeMode)
  );
};
