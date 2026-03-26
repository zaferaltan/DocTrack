import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DocTrackApi } from '@shared/ipc';

const api: DocTrackApi = {
  workspace: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.workspaceCreate, input),
    open: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, filePath),
    close: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceClose, filePath),
    listOpen: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListOpen),
    listRecent: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListRecent),
    getSummary: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetSummary, filePath)
  },
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName) =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceCreatePath, workspaceName),
    pickWorkspaceOpenPath: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceOpenPath),
    pickDocumentFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickDocumentFile)
  },
  documents: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.documentsList, filePath),
    detail: (filePath, documentRecordId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDetail, filePath, documentRecordId),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsCreate, filePath, input),
    createVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCreateVersion, filePath, input),
    updateStatus: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsUpdateStatus, filePath, input),
    openFile: (filePath, documentVersionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenFile, filePath, documentVersionId)
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
