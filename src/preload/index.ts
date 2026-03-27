import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DocTrackApi } from '@shared/ipc';

const api: DocTrackApi = {
  workspace: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.workspaceCreate, input),
    open: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, rootPath),
    close: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceClose, rootPath),
    listOpen: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListOpen),
    listRecent: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListRecent),
    getSummary: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetSummary, rootPath),
    updateSettings: (rootPath, settings) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceUpdateSettings, rootPath, settings)
  },
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName) =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceCreatePath, workspaceName),
    pickWorkspaceOpenPath: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceOpenPath),
    pickDocumentFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickDocumentFiles)
  },
  documents: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.documentsList, filePath),
    detail: (filePath, documentRecordId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDetail, filePath, documentRecordId),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsCreate, filePath, input),
    createVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCreateVersion, filePath, input),
    addVersionFiles: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsAddVersionFiles, filePath, input),
    renameVersionFile: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsRenameVersionFile, filePath, input),
    deleteVersionFile: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDeleteVersionFile, filePath, input),
    changeVersionFileRole: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsChangeVersionFileRole, filePath, input),
    syncVersionFiles: (filePath, documentVersionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsSyncVersionFiles, filePath, documentVersionId),
    updateStatus: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsUpdateStatus, filePath, input),
    openVersionFile: (filePath, fileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenVersionFile, filePath, fileId),
    openDocumentFolder: (filePath, documentRecordId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenDocumentFolder, filePath, documentRecordId),
    openVersionFolder: (filePath, documentVersionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenVersionFolder, filePath, documentVersionId)
  },
  documentTypes: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.documentTypesList, filePath),
    create: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentTypesCreate, filePath, input),
    update: (filePath, id, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentTypesUpdate, filePath, id, input),
    delete: (filePath, id) => ipcRenderer.invoke(IPC_CHANNELS.documentTypesDelete, filePath, id)
  },
  theme: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.themeGet),
    set: (themeMode) => ipcRenderer.invoke(IPC_CHANNELS.themeSet, themeMode)
  }
};

contextBridge.exposeInMainWorld('docTrack', api);
