import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { AppCatalogService } from '@main/catalog/appCatalogService';
import { ActorContextService } from '@main/services/actorContextService';
import type { AppUpdaterService } from '@main/services/appUpdaterService';
import type { DocumentExportService } from '@main/services/documentExportService';
import type { DocumentService } from '@main/services/documentService';
import type { DocumentTypeService } from '@main/services/documentTypeService';
import type { SavedViewService } from '@main/services/savedViewService';
import type { TemplateService } from '@main/services/templateService';
import { WorkspaceRoleService } from '@main/services/workspaceRoleService';
import { WorkspaceSessionService } from '@main/services/workspaceSessionService';
import { WorkspaceUserService } from '@main/services/workspaceUserService';
import type { WorkspaceService, WorkspaceSummaryResult } from '@main/services/workspaceService';
import type { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { IPC_CHANNELS } from '@shared/ipc';
import type {
  OpenWorkspaceResult,
  WorkspaceAccessRecoveryInput,
  WorkspaceSession,
  WorkspaceUser,
  WorkspaceUserCredentialsInput
} from '@shared/types';

type WorkspaceAccessRequirement =
  | 'viewer'
  | 'editDocuments'
  | 'manageUsers'
  | 'manageRoles'
  | 'manageWorkspaceSettings'
  | 'manageWorkspaceMaintenance'
  | 'manageSharedViews';

const BYPASS_WORKSPACE_USER: WorkspaceUser = {
  id: 0,
  username: 'workspace',
  displayName: 'Workspace Access',
  role: 'admin',
  roleName: 'Admin',
  signInEnabled: false,
  archived: false,
  linkedRecordCount: 0,
  lastSignedInDate: null,
  createdDate: '',
  modifiedDate: ''
};

const buildBypassSession = (): WorkspaceSession => ({
  user: BYPASS_WORKSPACE_USER,
  permissions: {
    canReadWorkspace: true,
    canEditWorkspace: true,
    canManageWorkspace: true,
    canViewWorkspace: true,
    canEditDocuments: true,
    canManageSharedViews: true,
    canManageUsers: true,
    canManageRoles: true,
    canManageWorkspaceSettings: true,
    canManageWorkspaceMaintenance: true
  },
  signedInAt: new Date().toISOString()
});

interface ServiceContainer {
  workspaceService: WorkspaceService;
  documentService: DocumentService;
  documentExportService: DocumentExportService;
  documentTypeService: DocumentTypeService;
  workspaceCatalogService: WorkspaceCatalogService;
  templateService: TemplateService;
  savedViewService: SavedViewService;
  workspaceRoleService?: WorkspaceRoleService;
  workspaceUserService?: WorkspaceUserService;
  catalogService: AppCatalogService;
  appUpdaterService: AppUpdaterService;
  workspaceSessionService?: WorkspaceSessionService;
  actorContextService?: ActorContextService;
  prepareForAppQuit: () => void;
}

type RuntimeWorkspaceUserService = Pick<
  WorkspaceUserService,
  | 'listSignInUsers'
  | 'canRecoverAccess'
  | 'list'
  | 'signIn'
  | 'recoverAccess'
  | 'create'
  | 'update'
  | 'activate'
  | 'deactivate'
  | 'remove'
  | 'unarchive'
  | 'resetPassword'
>;

type RuntimeWorkspaceRoleService = Pick<WorkspaceRoleService, 'list' | 'save'>;

type RuntimeWorkspaceSessionService = Pick<
  WorkspaceSessionService,
  | 'getSession'
  | 'setSession'
  | 'clearSession'
  | 'clearWorkspace'
  | 'replaceSessionsForUser'
  | 'clearSessionsForUser'
>;

type RuntimeActorContextService = Pick<ActorContextService, 'runWithActor'>;

type RuntimeServiceContainer = Omit<
  ServiceContainer,
  'workspaceRoleService' | 'workspaceUserService' | 'workspaceSessionService' | 'actorContextService'
> & {
  workspaceRoleService: RuntimeWorkspaceRoleService;
  workspaceUserService: RuntimeWorkspaceUserService;
  workspaceSessionService: RuntimeWorkspaceSessionService;
  actorContextService: RuntimeActorContextService;
};

const assertWorkspaceAccess = (
  services: RuntimeServiceContainer,
  event: IpcMainInvokeEvent,
  rootPath: string,
  requirement: WorkspaceAccessRequirement
): WorkspaceSession => {
  if (!services.workspaceService.isUserSystemEnabled(rootPath)) {
    return buildBypassSession();
  }

  const session = services.workspaceSessionService.getSession(event.sender.id, rootPath);
  if (!session) {
    throw new Error('Sign in to continue.');
  }

  if (
    (requirement === 'viewer' && !session.permissions.canViewWorkspace) ||
    (requirement === 'editDocuments' && !session.permissions.canEditDocuments) ||
    (requirement === 'manageUsers' && !session.permissions.canManageUsers) ||
    (requirement === 'manageRoles' && !session.permissions.canManageRoles) ||
    (requirement === 'manageWorkspaceSettings' &&
      !session.permissions.canManageWorkspaceSettings) ||
    (requirement === 'manageWorkspaceMaintenance' &&
      !session.permissions.canManageWorkspaceMaintenance) ||
    (requirement === 'manageSharedViews' && !session.permissions.canManageSharedViews)
  ) {
    switch (requirement) {
      case 'editDocuments':
        throw new Error('Document editing access is required for this action.');
      case 'manageUsers':
        throw new Error('Workspace user management access is required for this action.');
      case 'manageRoles':
        throw new Error('Workspace role management access is required for this action.');
      case 'manageWorkspaceSettings':
        throw new Error('Workspace settings access is required for this action.');
      case 'manageWorkspaceMaintenance':
        throw new Error('Workspace maintenance access is required for this action.');
      case 'manageSharedViews':
        throw new Error('Shared view management access is required for this action.');
      default:
        throw new Error('Workspace access is required for this action.');
    }
  }

  return session;
};

const runAsActor = <T>(
  services: RuntimeServiceContainer,
  actorUserId: number | null,
  action: () => T
): T => services.actorContextService.runWithActor(actorUserId, action);

const toOpenWorkspaceResult = (
  services: RuntimeServiceContainer,
  event: IpcMainInvokeEvent,
  result: WorkspaceSummaryResult
): OpenWorkspaceResult => {
  if (!result.summary.settings.userSystemEnabled) {
    return {
      kind: 'authenticated',
      workspace: result.workspace,
      summary: result.summary,
      session: buildBypassSession(),
      warnings: result.warnings
    };
  }

  const session = services.workspaceSessionService.getSession(event.sender.id, result.workspace.rootPath);
  if (!session) {
    return {
      kind: 'unauthenticated',
      workspace: result.workspace,
      summary: result.summary,
      users: services.workspaceUserService.listSignInUsers(result.workspace.rootPath),
      canRecoverAccess: services.workspaceUserService.canRecoverAccess(result.workspace.rootPath),
      session: null,
      warnings: result.warnings
    };
  }

  return {
    kind: 'authenticated',
    workspace: result.workspace,
    summary: result.summary,
    session,
    warnings: result.warnings
  };
};

const toLockedWorkspaceResult = (
  services: RuntimeServiceContainer,
  rootPath: string,
  result: WorkspaceSummaryResult
): OpenWorkspaceResult =>
  result.summary.settings.userSystemEnabled
    ? {
        kind: 'unauthenticated',
        workspace: result.workspace,
        summary: result.summary,
        users: services.workspaceUserService.listSignInUsers(rootPath),
        canRecoverAccess: services.workspaceUserService.canRecoverAccess(rootPath),
        session: null,
        warnings: result.warnings
      }
    : {
        kind: 'authenticated',
        workspace: result.workspace,
        summary: result.summary,
        session: buildBypassSession(),
        warnings: result.warnings
      };

export const registerIpcHandlers = (services: ServiceContainer): void => {
  const runtimeServices: RuntimeServiceContainer = {
    ...services,
    workspaceRoleService:
      services.workspaceRoleService ??
      ({
        list: () => {
          throw new Error('Workspace role service is unavailable.');
        },
        save: () => {
          throw new Error('Workspace role service is unavailable.');
        }
      } as RuntimeWorkspaceRoleService),
    workspaceUserService:
      services.workspaceUserService ??
      ({
        listSignInUsers: () => [],
        canRecoverAccess: () => false,
        list: () => [],
        signIn: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        recoverAccess: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        create: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        update: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        activate: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        deactivate: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        remove: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        unarchive: () => {
          throw new Error('Workspace user service is unavailable.');
        },
        resetPassword: () => {
          throw new Error('Workspace user service is unavailable.');
        }
      } as RuntimeWorkspaceUserService),
    workspaceSessionService:
      services.workspaceSessionService ??
      ({
        getSession: () => null,
        setSession: () => {
          throw new Error('Workspace session service is unavailable.');
        },
        clearSession: () => undefined,
        clearWorkspace: () => undefined,
        replaceSessionsForUser: () => undefined,
        clearSessionsForUser: () => undefined
      } as RuntimeWorkspaceSessionService),
    actorContextService:
      services.actorContextService ??
      ({
        runWithActor: <T>(_actorUserId: number | null, action: () => T): T => action()
      } as RuntimeActorContextService)
  };

  ipcMain.handle(IPC_CHANNELS.workspaceCreate, (event, input) => {
    const result = runtimeServices.workspaceService.create(input);
    if (result.summary.settings.userSystemEnabled) {
      const initialAdmin = input.initialAdmin ?? {
        username: 'admin',
        password: 'admin'
      };
      const user = runtimeServices.workspaceUserService.signIn(
        result.workspace.rootPath,
        initialAdmin.username,
        initialAdmin.password
      );
      runtimeServices.workspaceSessionService.setSession(event.sender.id, result.workspace.rootPath, user);
    }
    return toOpenWorkspaceResult(runtimeServices, event, result);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceOpen, (event, rootPath: string) => {
    const result = runtimeServices.workspaceService.open(rootPath);
    return toOpenWorkspaceResult(runtimeServices, event, result);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceClose, (_event, rootPath: string) => {
    runtimeServices.workspaceSessionService.clearWorkspace(rootPath);
    return runtimeServices.workspaceService.close(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceListOpen, () => runtimeServices.workspaceService.listOpen());
  ipcMain.handle(IPC_CHANNELS.workspaceListRecent, () => runtimeServices.workspaceService.listRecent());
  ipcMain.handle(IPC_CHANNELS.workspaceListPreviousSession, () =>
    runtimeServices.catalogService.listPreviousSessionWorkspaces()
  );
  ipcMain.handle(IPC_CHANNELS.workspaceDismissRecent, (_event, rootPath: string) =>
    runtimeServices.workspaceService.dismissRecent(rootPath)
  );

  ipcMain.handle(IPC_CHANNELS.workspaceSignIn, (event, rootPath: string, credentials: WorkspaceUserCredentialsInput) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      return toOpenWorkspaceResult(runtimeServices, event, runtimeServices.workspaceService.getSummary(rootPath));
    }

    const user = runtimeServices.workspaceUserService.signIn(rootPath, credentials.username, credentials.password);
    runtimeServices.workspaceSessionService.setSession(event.sender.id, rootPath, user);
    return toOpenWorkspaceResult(runtimeServices, event, runtimeServices.workspaceService.getSummary(rootPath));
  });

  ipcMain.handle(IPC_CHANNELS.workspaceSignOut, (event, rootPath: string) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      return;
    }

    runtimeServices.workspaceSessionService.clearSession(event.sender.id, rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceGetSession, (event, rootPath: string) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      return buildBypassSession();
    }

    return runtimeServices.workspaceSessionService.getSession(event.sender.id, rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceListUsers, (event, rootPath: string) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      return [];
    }

    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return runtimeServices.workspaceUserService.list(rootPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.workspaceRecoverAccess,
    (event, rootPath: string, input: WorkspaceAccessRecoveryInput) => {
      if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
        throw new Error('The user system is disabled for this workspace.');
      }

      const user = runtimeServices.workspaceUserService.recoverAccess(rootPath, input);
      runtimeServices.workspaceSessionService.setSession(event.sender.id, rootPath, user);
      return toOpenWorkspaceResult(runtimeServices, event, runtimeServices.workspaceService.getSummary(rootPath));
    }
  );

  ipcMain.handle(IPC_CHANNELS.workspaceCreateUser, (event, rootPath: string, input) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    return runAsActor(runtimeServices, session.user.id, () => runtimeServices.workspaceUserService.create(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.workspaceUpdateUser, (event, rootPath: string, userId: number, input) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    const user = runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceUserService.update(rootPath, userId, input)
    );
    runtimeServices.workspaceSessionService.replaceSessionsForUser(rootPath, user);
    return user;
  });

  ipcMain.handle(IPC_CHANNELS.workspaceActivateUser, (event, rootPath: string, userId: number) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    return runAsActor(runtimeServices, session.user.id, () => runtimeServices.workspaceUserService.activate(rootPath, userId));
  });

  ipcMain.handle(IPC_CHANNELS.workspaceDeactivateUser, (event, rootPath: string, userId: number) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    if (session.user.id === userId) {
      throw new Error('You cannot deactivate the account that is currently signed in.');
    }

    const user = runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceUserService.deactivate(rootPath, userId)
    );
    runtimeServices.workspaceSessionService.clearSessionsForUser(rootPath, userId);
    return user;
  });

  ipcMain.handle(IPC_CHANNELS.workspaceDeleteUser, (event, rootPath: string, userId: number) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    if (session.user.id === userId) {
      throw new Error('You cannot delete the account that is currently signed in.');
    }

    const result = runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceUserService.remove(rootPath, userId)
    );
    runtimeServices.workspaceSessionService.clearSessionsForUser(rootPath, userId);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.workspaceUnarchiveUser, (event, rootPath: string, userId: number) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    return runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceUserService.unarchive(rootPath, userId)
    );
  });

  ipcMain.handle(IPC_CHANNELS.workspaceResetUserPassword, (event, rootPath: string, input) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageUsers');
    return runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceUserService.resetPassword(rootPath, input.userId, input.password)
    );
  });

  ipcMain.handle(IPC_CHANNELS.workspaceListRoles, (event, rootPath: string) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      return runtimeServices.workspaceRoleService.list(rootPath);
    }

    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return runtimeServices.workspaceRoleService.list(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceSaveRoleSettings, (event, rootPath: string, input) => {
    if (!runtimeServices.workspaceService.isUserSystemEnabled(rootPath)) {
      throw new Error('The user system is disabled for this workspace.');
    }

    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageRoles');
    const roleSettings = runAsActor(runtimeServices, session.user.id, () =>
      runtimeServices.workspaceRoleService.save(rootPath, input)
    );
    for (const user of runtimeServices.workspaceUserService.list(rootPath)) {
      runtimeServices.workspaceSessionService.replaceSessionsForUser(rootPath, user);
    }
    return roleSettings;
  });

  ipcMain.handle(IPC_CHANNELS.workspaceGetSummary, (event, rootPath: string) => {
    const session = runtimeServices.workspaceSessionService.getSession(event.sender.id, rootPath);
    const result = runtimeServices.workspaceService.getSummary(rootPath);
    if (!session) {
      return toLockedWorkspaceResult(runtimeServices, rootPath, result);
    }

    return toOpenWorkspaceResult(runtimeServices, event, result);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceGetDashboard, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceService.getDashboard(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceGetDashboardLayout, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceService.getDashboardLayout(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceListActivity, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceService.listActivity(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceUpdateSettings, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceSettings');
    const result = runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceService.updateSettings(rootPath, input)
    );
    return toOpenWorkspaceResult(runtimeServices, event, result);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceUpdateDashboardLayout, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceSettings');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceService.updateDashboardLayout(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.workspaceListBackups, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    return services.workspaceService.listBackups(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceCreateBackup, (event, rootPath: string) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceService.createBackup(rootPath));
  });

  ipcMain.handle(
    IPC_CHANNELS.workspaceGetRestorePreview,
    (event, rootPath: string, backupId: string, destinationParentPath: string, destinationFolderName?: string) => {
      assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
      return services.workspaceService.getRestorePreview(
        rootPath,
        backupId,
        destinationParentPath,
        destinationFolderName
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.workspaceGetRestoreDiff, (event, rootPath: string, backupId: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    return services.workspaceService.getRestoreDiff(rootPath, backupId);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceRestoreBackup, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    const result = runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceService.restoreBackup(rootPath, input)
    );
    return toOpenWorkspaceResult(runtimeServices, event, result);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceIntegrityCheck, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    return services.workspaceService.integrityCheck(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceScanForRepairs, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
    return services.workspaceService.scanForRepairs(rootPath);
  });

  ipcMain.handle(
    IPC_CHANNELS.workspaceApplyRepairs,
    (event, rootPath: string, issues: import('@shared/types').WorkspaceRepairIssue[]) => {
      assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageWorkspaceMaintenance');
      return services.workspaceService.applyRepairs(rootPath, issues);
    }
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

  ipcMain.handle(IPC_CHANNELS.dialogPickWorkspaceLogoFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Company Logo',
      properties: ['openFile'],
      filters: [
        {
          name: 'Image Files',
          extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp']
        }
      ]
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

  ipcMain.handle(IPC_CHANNELS.documentsList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.list(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.documentsDetail, (event, rootPath: string, documentRecordId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.getDetail(rootPath, documentRecordId);
  });

  ipcMain.handle(IPC_CHANNELS.documentsCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.create(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsUpdate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.updateDocument(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsCreateVersion, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.createVersion(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsDelete, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.deleteDocument(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsDeleteVersion, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.deleteVersion(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsUpdateLatestVersion, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.updateLatestVersion(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsUpdateVersion, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.updateVersion(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsAddVersionFiles, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentService.addVersionFiles(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentsRenameVersionFile, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.renameVersionFile(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsDeleteVersionFile, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.deleteVersionFile(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsChangeVersionFileRole, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.changeVersionFileRole(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsSyncVersionFiles, (event, rootPath: string, documentVersionId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.syncVersionFiles(rootPath, documentVersionId);
  });

  ipcMain.handle(IPC_CHANNELS.documentsGetVersionFilesystemPreview, (event, rootPath: string, documentVersionId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.getVersionFilesystemPreview(rootPath, documentVersionId);
  });

  ipcMain.handle(
    IPC_CHANNELS.documentsApplyVersionFilesystemReconciliation,
    (event, rootPath: string, documentVersionId: number, input) => {
      const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
      return runAsActor(runtimeServices, session.user.id, () =>
        services.documentService.applyVersionFilesystemReconciliation(rootPath, documentVersionId, input)
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.documentsOpenVersionFile, (event, rootPath: string, fileId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.openVersionFile(rootPath, fileId);
  });

  ipcMain.handle(IPC_CHANNELS.documentsOpenDocumentFolder, (event, rootPath: string, documentRecordId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.openDocumentFolder(rootPath, documentRecordId);
  });

  ipcMain.handle(IPC_CHANNELS.documentsOpenVersionFolder, (event, rootPath: string, documentVersionId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.openVersionFolder(rootPath, documentVersionId);
  });

  ipcMain.handle(IPC_CHANNELS.documentsOpenStoredPath, (event, rootPath: string, relativePath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.openStoredPath(rootPath, relativePath);
  });

  ipcMain.handle(IPC_CHANNELS.documentsExport, (event, rootPath: string, request) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentExportService.export(rootPath, request);
  });

  ipcMain.handle(IPC_CHANNELS.documentsPreviewVersionFile, (event, rootPath: string, fileId: number) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentService.previewVersionFile(rootPath, fileId);
  });

  ipcMain.handle(
    IPC_CHANNELS.documentsCompareVersions,
    (event, rootPath: string, currentVersionId: number, previousVersionId: number) => {
      assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
      return services.documentService.compareVersions(rootPath, currentVersionId, previousVersionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.documentsPlanVersionFileImport,
    (event, rootPath: string, documentVersionId: number, sourceFilePaths: string[]) => {
      assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
      return services.documentService.planVersionFileImport(rootPath, documentVersionId, sourceFilePaths);
    }
  );

  ipcMain.handle(IPC_CHANNELS.documentsReconcileUnmanagedPath, (event, rootPath: string, documentVersionId: number, relativePath: string) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.reconcileUnmanagedPath(rootPath, documentVersionId, relativePath)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentsIgnoreUnmanagedPath, (event, rootPath: string, documentVersionId: number, relativePath: string) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.documentService.ignoreUnmanagedPath(rootPath, documentVersionId, relativePath)
    );
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.savedViewService.list(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(
      runtimeServices,
      event,
      rootPath,
      input.scope === 'shared' ? 'manageSharedViews' : 'viewer'
    );
    return runAsActor(runtimeServices, session.user.id, () => services.savedViewService.create(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsUpdate, (event, rootPath: string, savedViewId: string, scope, input) => {
    const session = assertWorkspaceAccess(
      runtimeServices,
      event,
      rootPath,
      scope === 'shared' ? 'manageSharedViews' : 'viewer'
    );
    return runAsActor(runtimeServices, session.user.id, () =>
      services.savedViewService.update(rootPath, savedViewId, scope, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsDelete, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(
      runtimeServices,
      event,
      rootPath,
      input.scope === 'shared' ? 'manageSharedViews' : 'viewer'
    );
    return runAsActor(runtimeServices, session.user.id, () => services.savedViewService.delete(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsDuplicate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(
      runtimeServices,
      event,
      rootPath,
      input.scope === 'shared' ? 'manageSharedViews' : 'viewer'
    );
    return runAsActor(runtimeServices, session.user.id, () => services.savedViewService.duplicate(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.savedViewsPromoteToShared, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'manageSharedViews');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.savedViewService.promoteToShared(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.documentTypesList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.documentTypeService.list(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.documentTypesCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentTypeService.create(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentTypesUpdate, (event, rootPath: string, id: number, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentTypeService.update(rootPath, id, input));
  });

  ipcMain.handle(IPC_CHANNELS.documentTypesDelete, (event, rootPath: string, id: number) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.documentTypeService.delete(rootPath, id));
  });

  ipcMain.handle(IPC_CHANNELS.groupsList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceCatalogService.listGroups(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.groupsCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.createGroup(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.groupsUpdate, (event, rootPath: string, id: number, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceCatalogService.updateGroup(rootPath, id, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.groupsDelete, (event, rootPath: string, id: number) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.deleteGroup(rootPath, id));
  });

  ipcMain.handle(IPC_CHANNELS.projectsList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceCatalogService.listProjects(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.projectsCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.createProject(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.projectsUpdate, (event, rootPath: string, id: number, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceCatalogService.updateProject(rootPath, id, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.projectsDelete, (event, rootPath: string, id: number) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.deleteProject(rootPath, id));
  });

  ipcMain.handle(IPC_CHANNELS.templatesList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.templateService.list(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.templatesCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.templateService.create(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.templatesAddFiles, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.templateService.addFiles(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.templatesDelete, (event, rootPath: string, templateId: string) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.templateService.delete(rootPath, templateId));
  });

  ipcMain.handle(IPC_CHANNELS.confidentialityClassesList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceCatalogService.listConfidentialityClasses(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.confidentialityClassesCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceCatalogService.createConfidentialityClass(rootPath, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.confidentialityClassesUpdate, (event, rootPath: string, id: number, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceCatalogService.updateConfidentialityClass(rootPath, id, input)
    );
  });

  ipcMain.handle(IPC_CHANNELS.confidentialityClassesDelete, (event, rootPath: string, id: number) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () =>
      services.workspaceCatalogService.deleteConfidentialityClass(rootPath, id)
    );
  });

  ipcMain.handle(IPC_CHANNELS.languagesList, (event, rootPath: string) => {
    assertWorkspaceAccess(runtimeServices, event, rootPath, 'viewer');
    return services.workspaceCatalogService.listLanguages(rootPath);
  });

  ipcMain.handle(IPC_CHANNELS.languagesCreate, (event, rootPath: string, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.createLanguage(rootPath, input));
  });

  ipcMain.handle(IPC_CHANNELS.languagesUpdate, (event, rootPath: string, id: number, input) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.updateLanguage(rootPath, id, input));
  });

  ipcMain.handle(IPC_CHANNELS.languagesDelete, (event, rootPath: string, id: number) => {
    const session = assertWorkspaceAccess(runtimeServices, event, rootPath, 'editDocuments');
    return runAsActor(runtimeServices, session.user.id, () => services.workspaceCatalogService.deleteLanguage(rootPath, id));
  });

  ipcMain.handle(IPC_CHANNELS.appSettingsGet, () => services.catalogService.getApplicationSettings());
  ipcMain.handle(IPC_CHANNELS.appSettingsUpdate, (_event, settings) => {
    const nextSettings = services.catalogService.updateApplicationSettings(settings);
    services.appUpdaterService.syncSettings(nextSettings);
    return nextSettings;
  });
  ipcMain.handle(IPC_CHANNELS.appUpdatesGetState, () => services.appUpdaterService.getState());
  ipcMain.handle(IPC_CHANNELS.appUpdatesCheckForUpdates, () => services.appUpdaterService.checkForUpdates());
  ipcMain.handle(IPC_CHANNELS.appUpdatesDownloadUpdate, () => services.appUpdaterService.downloadUpdate());
  ipcMain.handle(IPC_CHANNELS.appUpdatesGetCompletedUpdate, () =>
    services.catalogService.getCompletedAppUpdate()
  );
  ipcMain.handle(IPC_CHANNELS.appUpdatesClearCompletedUpdate, () => {
    services.catalogService.clearCompletedAppUpdate();
  });
  ipcMain.handle(IPC_CHANNELS.appUpdatesQuitAndInstall, () => {
    const updateState = services.appUpdaterService.getState();
    if (updateState.status === 'downloaded' && updateState.release) {
      services.catalogService.setCompletedAppUpdate({
        previousVersion: updateState.currentVersion,
        currentVersion: updateState.release.version,
        completedAt: new Date().toISOString()
      });
    }

    services.prepareForAppQuit();
    services.appUpdaterService.quitAndInstall();
  });
};
