import type { ApplicationSettings } from '@shared/applicationSettings';
import type {
  AddDocumentVersionFilesInput,
  ChangeDocumentVersionFileRoleInput,
  CreateDocumentInput,
  CreateVersionInput,
  DeleteDocumentVersionFileInput,
  DocumentDetail,
  DocumentListItem,
  DocumentVersion,
  DocumentVersionFile,
  DocumentType,
  DocumentTypeInput,
  OpenWorkspaceResult,
  RecentWorkspace,
  RenameDocumentVersionFileInput,
  UpdateDocumentStatusInput,
  WorkspaceCreateInput,
  WorkspaceInfo
} from '@shared/types';
import type { WorkspaceSettings } from '@shared/workspaceLayout';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceClose: 'workspace:close',
  workspaceListOpen: 'workspace:listOpen',
  workspaceListRecent: 'workspace:listRecent',
  workspaceGetSummary: 'workspace:getSummary',
  workspaceUpdateSettings: 'workspace:updateSettings',
  dialogPickWorkspaceCreatePath: 'dialog:pickWorkspaceCreatePath',
  dialogPickWorkspaceOpenPath: 'dialog:pickWorkspaceOpenPath',
  dialogPickDocumentFiles: 'dialog:pickDocumentFiles',
  documentsList: 'documents:list',
  documentsDetail: 'documents:detail',
  documentsCreate: 'documents:create',
  documentsCreateVersion: 'documents:createVersion',
  documentsAddVersionFiles: 'documents:addVersionFiles',
  documentsRenameVersionFile: 'documents:renameVersionFile',
  documentsDeleteVersionFile: 'documents:deleteVersionFile',
  documentsChangeVersionFileRole: 'documents:changeVersionFileRole',
  documentsSyncVersionFiles: 'documents:syncVersionFiles',
  documentsUpdateStatus: 'documents:updateStatus',
  documentsOpenVersionFile: 'documents:openVersionFile',
  documentsOpenDocumentFolder: 'documents:openDocumentFolder',
  documentsOpenVersionFolder: 'documents:openVersionFolder',
  documentTypesList: 'documentTypes:list',
  documentTypesCreate: 'documentTypes:create',
  documentTypesUpdate: 'documentTypes:update',
  documentTypesDelete: 'documentTypes:delete',
  appSettingsGet: 'appSettings:get',
  appSettingsUpdate: 'appSettings:update'
} as const;

export interface DocTrackApi {
  workspace: {
    create: (input: WorkspaceCreateInput) => Promise<OpenWorkspaceResult>;
    open: (rootPath: string) => Promise<OpenWorkspaceResult>;
    close: (rootPath: string) => Promise<WorkspaceInfo[]>;
    listOpen: () => Promise<WorkspaceInfo[]>;
    listRecent: () => Promise<RecentWorkspace[]>;
    getSummary: (rootPath: string) => Promise<OpenWorkspaceResult>;
    updateSettings: (rootPath: string, settings: WorkspaceSettings) => Promise<OpenWorkspaceResult>;
  };
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName?: string) => Promise<string | null>;
    pickWorkspaceOpenPath: () => Promise<string | null>;
    pickDocumentFiles: () => Promise<string[]>;
  };
  documents: {
    list: (rootPath: string) => Promise<DocumentListItem[]>;
    detail: (rootPath: string, documentRecordId: number) => Promise<DocumentDetail>;
    create: (rootPath: string, input: CreateDocumentInput) => Promise<DocumentDetail>;
    createVersion: (rootPath: string, input: CreateVersionInput) => Promise<DocumentDetail>;
    addVersionFiles: (rootPath: string, input: AddDocumentVersionFilesInput) => Promise<DocumentVersion>;
    renameVersionFile: (
      rootPath: string,
      input: RenameDocumentVersionFileInput
    ) => Promise<DocumentVersion>;
    deleteVersionFile: (
      rootPath: string,
      input: DeleteDocumentVersionFileInput
    ) => Promise<DocumentVersion>;
    changeVersionFileRole: (
      rootPath: string,
      input: ChangeDocumentVersionFileRoleInput
    ) => Promise<DocumentVersion>;
    syncVersionFiles: (rootPath: string, documentVersionId: number) => Promise<DocumentVersion>;
    updateStatus: (rootPath: string, input: UpdateDocumentStatusInput) => Promise<DocumentDetail>;
    openVersionFile: (rootPath: string, fileId: number) => Promise<void>;
    openDocumentFolder: (rootPath: string, documentRecordId: number) => Promise<void>;
    openVersionFolder: (rootPath: string, documentVersionId: number) => Promise<void>;
  };
  documentTypes: {
    list: (rootPath: string) => Promise<DocumentType[]>;
    create: (rootPath: string, input: DocumentTypeInput) => Promise<DocumentType>;
    update: (rootPath: string, id: number, input: DocumentTypeInput) => Promise<DocumentType>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  appSettings: {
    get: () => Promise<ApplicationSettings>;
    update: (settings: ApplicationSettings) => Promise<ApplicationSettings>;
  };
}
