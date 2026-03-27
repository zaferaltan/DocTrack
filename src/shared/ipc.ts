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
    pickDocumentFile: () => Promise<string | null>;
  };
  documents: {
    list: (rootPath: string) => Promise<DocumentListItem[]>;
    detail: (rootPath: string, documentRecordId: number) => Promise<DocumentDetail>;
    create: (rootPath: string, input: CreateDocumentInput) => Promise<DocumentDetail>;
    createVersion: (rootPath: string, input: CreateVersionInput) => Promise<DocumentDetail>;
    updateStatus: (rootPath: string, input: UpdateDocumentStatusInput) => Promise<DocumentDetail>;
    openFile: (rootPath: string, documentVersionId: number) => Promise<void>;
  };
  documentTypes: {
    list: (rootPath: string) => Promise<DocumentType[]>;
    create: (rootPath: string, input: DocumentTypeInput) => Promise<DocumentType>;
    update: (rootPath: string, id: number, input: DocumentTypeInput) => Promise<DocumentType>;
    delete: (rootPath: string, id: number) => Promise<void>;
  };
  theme: {
    get: () => Promise<ThemeMode>;
    set: (themeMode: ThemeMode) => Promise<ThemeMode>;
  };
}
