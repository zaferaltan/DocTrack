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
    update: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsUpdate, filePath, input),
    createVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCreateVersion, filePath, input),
    updateLatestVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsUpdateLatestVersion, filePath, input),
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
  projects: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.projectsList, filePath),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.projectsCreate, filePath, input),
    update: (filePath, id, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.projectsUpdate, filePath, id, input),
    delete: (filePath, id) => ipcRenderer.invoke(IPC_CHANNELS.projectsDelete, filePath, id)
  },
  confidentialityClasses: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.confidentialityClassesList, filePath),
    create: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.confidentialityClassesCreate, filePath, input),
    update: (filePath, id, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.confidentialityClassesUpdate, filePath, id, input),
    delete: (filePath, id) =>
      ipcRenderer.invoke(IPC_CHANNELS.confidentialityClassesDelete, filePath, id)
  },
  languages: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.languagesList, filePath),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.languagesCreate, filePath, input),
    update: (filePath, id, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.languagesUpdate, filePath, id, input),
    delete: (filePath, id) => ipcRenderer.invoke(IPC_CHANNELS.languagesDelete, filePath, id)
  },
  appSettings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.appSettingsGet),
    update: (settings) => ipcRenderer.invoke(IPC_CHANNELS.appSettingsUpdate, settings)
  }
};

contextBridge.exposeInMainWorld('docTrack', api);
