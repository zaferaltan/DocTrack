import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS, type DocTrackApi } from '@shared/ipc';

const api: DocTrackApi = {
  workspace: {
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.workspaceCreate, input),
    open: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen, rootPath),
    close: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceClose, rootPath),
    listOpen: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListOpen),
    listRecent: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceListRecent),
    dismissRecent: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceDismissRecent, rootPath),
    getSummary: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetSummary, rootPath),
    getDashboard: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceGetDashboard, rootPath),
    updateSettings: (rootPath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceUpdateSettings, rootPath, input),
    listBackups: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceListBackups, rootPath),
    createBackup: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceCreateBackup, rootPath),
    getRestorePreview: (rootPath, backupId, destinationParentPath, destinationFolderName) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.workspaceGetRestorePreview,
        rootPath,
        backupId,
        destinationParentPath,
        destinationFolderName
      ),
    getRestoreDiff: (rootPath, backupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceGetRestoreDiff, rootPath, backupId),
    restoreBackup: (rootPath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.workspaceRestoreBackup, rootPath, input),
    integrityCheck: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.workspaceIntegrityCheck, rootPath),
    onFilesystemDrift: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
        listener(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.workspaceFilesystemDrift, wrappedListener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.workspaceFilesystemDrift, wrappedListener);
      };
    }
  },
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName) =>
      ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceCreatePath, workspaceName),
    pickWorkspaceOpenPath: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceOpenPath),
    pickWorkspaceLogoFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickWorkspaceLogoFile),
    pickDocumentFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogPickDocumentFiles),
    resolveDroppedFilePaths: async (files) =>
      Array.from(files)
        .map((file) => webUtils.getPathForFile(file))
        .filter((value): value is string => value.trim().length > 0)
  },
  documents: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.documentsList, filePath),
    detail: (filePath, documentRecordId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDetail, filePath, documentRecordId),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsCreate, filePath, input),
    update: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsUpdate, filePath, input),
    createVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsCreateVersion, filePath, input),
    delete: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.documentsDelete, filePath, input),
    deleteVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDeleteVersion, filePath, input),
    updateLatestVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsUpdateLatestVersion, filePath, input),
    updateVersion: (filePath, input) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsUpdateVersion, filePath, input),
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
    getVersionFilesystemPreview: (filePath, documentVersionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsGetVersionFilesystemPreview, filePath, documentVersionId),
    applyVersionFilesystemReconciliation: (filePath, documentVersionId, input) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsApplyVersionFilesystemReconciliation,
        filePath,
        documentVersionId,
        input
      ),
    openVersionFile: (filePath, fileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenVersionFile, filePath, fileId),
    openDocumentFolder: (filePath, documentRecordId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenDocumentFolder, filePath, documentRecordId),
    openVersionFolder: (filePath, documentVersionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenVersionFolder, filePath, documentVersionId),
    openStoredPath: (filePath, relativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenStoredPath, filePath, relativePath),
    export: (filePath, request) => ipcRenderer.invoke(IPC_CHANNELS.documentsExport, filePath, request),
    previewVersionFile: (filePath, fileId) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsPreviewVersionFile, filePath, fileId),
    compareVersions: (filePath, currentVersionId, previousVersionId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsCompareVersions,
        filePath,
        currentVersionId,
        previousVersionId
      ),
    planVersionFileImport: (filePath, documentVersionId, sourceFilePaths) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsPlanVersionFileImport,
        filePath,
        documentVersionId,
        sourceFilePaths
      ),
    reconcileUnmanagedPath: (filePath, documentVersionId, relativePath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsReconcileUnmanagedPath,
        filePath,
        documentVersionId,
        relativePath
      ),
    ignoreUnmanagedPath: (filePath, documentVersionId, relativePath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.documentsIgnoreUnmanagedPath,
        filePath,
        documentVersionId,
        relativePath
      )
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
  templates: {
    list: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.templatesList, filePath),
    create: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.templatesCreate, filePath, input),
    addFiles: (filePath, input) => ipcRenderer.invoke(IPC_CHANNELS.templatesAddFiles, filePath, input),
    delete: (filePath, templateId) => ipcRenderer.invoke(IPC_CHANNELS.templatesDelete, filePath, templateId)
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
