import type {
  CreateDocumentInput,
  CreateVersionInput,
  DocumentDetail,
  DocumentListItem,
  DocumentType,
  DocumentTypeInput,
  OpenWorkspaceResult,
  RecentWorkspace,
  ThemeMode,
  UpdateDocumentStatusInput,
  WorkspaceCreateInput,
  WorkspaceInfo
} from '@shared/types';

export const IPC_CHANNELS = {
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceClose: 'workspace:close',
  workspaceListOpen: 'workspace:listOpen',
  workspaceListRecent: 'workspace:listRecent',
  workspaceGetSummary: 'workspace:getSummary',
  dialogPickWorkspaceCreatePath: 'dialog:pickWorkspaceCreatePath',
  dialogPickWorkspaceOpenPath: 'dialog:pickWorkspaceOpenPath',
  dialogPickDocumentFile: 'dialog:pickDocumentFile',
  documentsList: 'documents:list',
  documentsDetail: 'documents:detail',
  documentsCreate: 'documents:create',
  documentsCreateVersion: 'documents:createVersion',
  documentsUpdateStatus: 'documents:updateStatus',
  documentsOpenFile: 'documents:openFile',
  documentTypesList: 'documentTypes:list',
  documentTypesCreate: 'documentTypes:create',
  documentTypesUpdate: 'documentTypes:update',
  documentTypesDelete: 'documentTypes:delete',
  themeGet: 'theme:get',
  themeSet: 'theme:set'
} as const;

export interface DocTrackApi {
  workspace: {
    create: (input: WorkspaceCreateInput) => Promise<OpenWorkspaceResult>;
    open: (filePath: string) => Promise<OpenWorkspaceResult>;
    close: (filePath: string) => Promise<WorkspaceInfo[]>;
    listOpen: () => Promise<WorkspaceInfo[]>;
    listRecent: () => Promise<RecentWorkspace[]>;
    getSummary: (filePath: string) => Promise<OpenWorkspaceResult>;
  };
  dialogs: {
    pickWorkspaceCreatePath: (workspaceName?: string) => Promise<string | null>;
    pickWorkspaceOpenPath: () => Promise<string | null>;
    pickDocumentFile: () => Promise<string | null>;
  };
  documents: {
    list: (filePath: string) => Promise<DocumentListItem[]>;
    detail: (filePath: string, documentRecordId: number) => Promise<DocumentDetail>;
    create: (filePath: string, input: CreateDocumentInput) => Promise<DocumentDetail>;
    createVersion: (filePath: string, input: CreateVersionInput) => Promise<DocumentDetail>;
    updateStatus: (filePath: string, input: UpdateDocumentStatusInput) => Promise<DocumentDetail>;
    openFile: (filePath: string, documentVersionId: number) => Promise<void>;
  };
  documentTypes: {
    list: (filePath: string) => Promise<DocumentType[]>;
    create: (filePath: string, input: DocumentTypeInput) => Promise<DocumentType>;
    update: (filePath: string, id: number, input: DocumentTypeInput) => Promise<DocumentType>;
    delete: (filePath: string, id: number) => Promise<void>;
  };
  theme: {
    get: () => Promise<ThemeMode>;
    set: (themeMode: ThemeMode) => Promise<ThemeMode>;
  };
}
