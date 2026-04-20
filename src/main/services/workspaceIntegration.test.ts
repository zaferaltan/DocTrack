import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import { WorkspaceManager } from '@main/database/workspaceManager';
import { ActivityLogService } from '@main/services/activityLogService';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DocumentService } from '@main/services/documentService';
import { DocumentTypeService } from '@main/services/documentTypeService';
import { FileStorageService } from '@main/services/fileStorageService';
import { SavedViewService } from '@main/services/savedViewService';
import { TemplateService } from '@main/services/templateService';
import { WorkspaceBackupService } from '@main/services/workspaceBackupService';
import { WorkspaceCatalogService } from '@main/services/workspaceCatalogService';
import { WorkspaceService } from '@main/services/workspaceService';
import { WorkspaceUserService } from '@main/services/workspaceUserService';
import { createDefaultWorkspaceLifecycle, type WorkspaceLifecycle } from '@shared/documentLifecycle';
import { DEFAULT_DASHBOARD_LAYOUT, DEFAULT_SAVED_VIEW_PRESENTATION } from '@shared/savedViews';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_DATABASE_DIRECTORY_NAME,
  WORKSPACE_DATABASE_FILE_NAME,
  WORKSPACE_TEMPLATES_DIRECTORY_NAME
} from '@shared/workspaceLayout';

vi.mock('electron', () => ({
  default: {
    shell: {
      openPath: vi.fn()
    }
  },
  shell: {
    openPath: vi.fn()
  }
}));

const INTEGRATION_HOOK_TIMEOUT_MS = process.platform === 'win32' ? 30000 : 10000;
const WINDOWS_FILESYSTEM_TEST_TIMEOUT_MS = process.platform === 'win32' ? 30000 : 5000;

describe('workspace integration', () => {
  let tempRoot: string;
  let workspaceManager: WorkspaceManager;
  let workspaceService: WorkspaceService;
  let documentService: DocumentService;
  let documentTypeService: DocumentTypeService;
  let templateService: TemplateService;
  let savedViewService: SavedViewService;
  let catalogService: AppCatalogService;
  let workspaceUserService: WorkspaceUserService;

  const mapTransitions = (lifecycle: WorkspaceLifecycle): string[] =>
    lifecycle.allowedTransitions
      .map((transition) => `${transition.fromStatusKey}->${transition.toStatusKey}`)
      .sort();

  const buildCustomLifecycle = (): WorkspaceLifecycle => ({
    mode: 'custom',
    statuses: [
      {
        key: 'drafting',
        name: 'Drafting',
        role: 'draft',
        sortOrder: 0,
        requiresReleasedDate: false,
        requiresReviewedBy: false,
        requiresApprovedBy: false
      },
      {
        key: 'review',
        name: 'Review',
        role: 'review',
        sortOrder: 1,
        requiresReleasedDate: false,
        requiresReviewedBy: true,
        requiresApprovedBy: false
      },
      {
        key: 'published',
        name: 'Published',
        role: 'released',
        sortOrder: 2,
        requiresReleasedDate: true,
        requiresReviewedBy: true,
        requiresApprovedBy: true
      },
      {
        key: 'retired',
        name: 'Retired',
        role: 'obsolete',
        sortOrder: 3,
        requiresReleasedDate: false,
        requiresReviewedBy: false,
        requiresApprovedBy: false
      }
    ],
    initialStatusKey: 'drafting',
    autoPreviousVersionStatusKey: 'retired',
    allowedTransitions: [
      { fromStatusKey: 'drafting', toStatusKey: 'review' },
      { fromStatusKey: 'review', toStatusKey: 'published' },
      { fromStatusKey: 'published', toStatusKey: 'retired' }
    ]
  });

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-workspace-'));
    workspaceManager = new WorkspaceManager();
    const fileStorageService = new FileStorageService();
    templateService = new TemplateService(fileStorageService, workspaceManager);
    catalogService = new AppCatalogService(path.join(tempRoot, 'catalog.json'));
    const documentIdGenerator = new DocumentIdGeneratorService();
    const activityLogService = new ActivityLogService();
    const workspaceBackupService = new WorkspaceBackupService(workspaceManager);
    workspaceUserService = new WorkspaceUserService(workspaceManager);
    documentService = new DocumentService(
      workspaceManager,
      documentIdGenerator,
      fileStorageService,
      templateService,
      activityLogService,
      workspaceUserService
    );
    documentTypeService = new DocumentTypeService(workspaceManager, fileStorageService);
    const workspaceCatalogService = new WorkspaceCatalogService(workspaceManager);
    savedViewService = new SavedViewService(workspaceManager, catalogService);
    workspaceService = new WorkspaceService(
      workspaceManager,
      documentService,
      fileStorageService,
      templateService,
      workspaceCatalogService,
      catalogService,
      savedViewService,
      documentIdGenerator,
      activityLogService,
      workspaceBackupService,
      undefined,
      workspaceUserService
    );
  }, INTEGRATION_HOOK_TIMEOUT_MS);

  afterEach(() => {
    workspaceManager.dispose();
    rmSync(tempRoot, { recursive: true, force: true });
  }, INTEGRATION_HOOK_TIMEOUT_MS);

  it('creates a workspace folder with starter type folders and both workspace settings', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = path.join(tempRoot, 'Quality');
    const databasePath = path.join(
      workspaceRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );

    expect(result.workspace.name).toBe('Quality');
    expect(result.workspace.rootPath).toBe(workspaceRootPath);
    expect(result.summary.settings.storageLayoutPreset).toBe('stable-id');
    expect(result.summary.settings.fileOrganizationMode).toBe('flat');
    expect(result.summary.settings.versionManagementMode).toBe('shared-document-id');
    expect(result.summary.settings.documentIdFormatPreset).toBe('legacy-numeric');
    expect(result.summary.settings.documentIdFormatTemplate).toBe('<docTypePrefix><year><sequence:5>');
    expect(result.summary.settings.visibleDocumentColumns).toEqual(
      DEFAULT_WORKSPACE_SETTINGS.visibleDocumentColumns
    );
    expect(result.summary.settings.autoMarkPreviousVersionObsolete).toBe(true);
    expect(result.summary.settings.activityLogEnabled).toBe(true);
    expect(result.summary.settings.activityLogMaxRows).toBe(5000);
    expect(result.summary.documentTypes.map((item) => item.numberPrefix)).toEqual(['01', '02', '03']);
    expect(result.summary.languages.map((item) => item.code)).toEqual(['DE', 'EN', 'NL']);
    expect(result.summary.statuses).toContain('Obsolete');
    expect(existsSync(databasePath)).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Specification'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Procedure'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Report'))).toBe(true);
    expect(existsSync(path.join(workspaceRootPath, WORKSPACE_TEMPLATES_DIRECTORY_NAME))).toBe(true);
    expect(result.summary.templates).toEqual([]);
    expect(result.summary.dashboardLayout).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(result.summary.savedViews).toEqual([]);
  });

  it('deletes the empty document type folder when an unused type is removed', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = result.workspace.rootPath;
    const procedureType = result.summary.documentTypes.find((item) => item.name === 'Procedure');

    expect(procedureType).toBeDefined();
    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Procedure'))).toBe(true);

    documentTypeService.delete(workspaceRootPath, procedureType!.id);

    expect(existsSync(path.join(workspaceRootPath, 'Documents', 'Procedure'))).toBe(false);
  }, WINDOWS_FILESYSTEM_TEST_TIMEOUT_MS);

  it('can create a workspace with the user system disabled', () => {
    const result = workspaceService.create({
      name: 'Open Workspace',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        userSystemEnabled: false
      },
      includeExampleData: true
    });

    expect(result.summary.settings.userSystemEnabled).toBe(false);
    expect(result.summary.users).toEqual([]);
    expect(result.summary.documents.length).toBeGreaterThan(0);

    const userCount =
      (
        workspaceManager
          .getContext(result.workspace.rootPath)
          .db.prepare('SELECT COUNT(*) AS total FROM WorkspaceUsers')
          .get() as { total: number } | undefined
      )?.total ?? 0;

    expect(userCount).toBe(0);
  });

  it('creates documents with a null activity actor when the current actor is a bypass session', () => {
    const result = workspaceService.create({
      name: 'Open Workspace',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        userSystemEnabled: false
      },
      includeExampleData: false
    });
    const workspaceRootPath = result.workspace.rootPath;
    const documentServiceWithBypassActor = new DocumentService(
      workspaceManager,
      new DocumentIdGeneratorService(),
      new FileStorageService(),
      templateService,
      new ActivityLogService({
        getActorUserId: () => 0
      }),
      workspaceUserService
    );

    const createdDocument = documentServiceWithBypassActor.create(workspaceRootPath, {
      title: 'Open Workspace Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const activityRows = workspaceManager
      .getContext(workspaceRootPath)
      .db.prepare(
        `
          SELECT EventType, DocumentRecordId, ActorUserId
          FROM ActivityLog
          WHERE DocumentRecordId = ?
          ORDER BY Id ASC
        `
      )
      .all(createdDocument.id) as Array<{
      EventType: string;
      DocumentRecordId: number;
      ActorUserId: number | null;
    }>;

    expect(createdDocument.title).toBe('Open Workspace Procedure');
    expect(activityRows).toEqual([
      {
        EventType: 'document.created',
        DocumentRecordId: createdDocument.id,
        ActorUserId: null
      }
    ]);
  });

  it('does not allow the final active workspace user to be deactivated', () => {
    const result = workspaceService.create({
      name: 'Protected Workspace',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS
      },
      includeExampleData: false,
      initialAdmin: {
        username: 'admin',
        displayName: 'Workspace Admin',
        password: 'admin1234'
      }
    });

    const [adminUser] = workspaceUserService.list(result.workspace.rootPath);

    expect(() =>
      workspaceUserService.deactivate(result.workspace.rootPath, adminUser.id)
    ).toThrow('At least one active workspace user must remain.');
  });

  it('can recover access by creating a new admin when no active users remain', () => {
    const result = workspaceService.create({
      name: 'Recovery Workspace',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS
      },
      includeExampleData: false,
      initialAdmin: {
        username: 'admin',
        displayName: 'Workspace Admin',
        password: 'admin1234'
      }
    });

    workspaceManager
      .getContext(result.workspace.rootPath)
      .db.prepare('UPDATE WorkspaceUsers SET SignInEnabled = 0')
      .run();

    expect(workspaceUserService.canRecoverAccess(result.workspace.rootPath)).toBe(true);

    const recoveredUser = workspaceUserService.recoverAccess(result.workspace.rootPath, {
      username: 'recovery-admin',
      displayName: 'Recovery Admin',
      password: 'rescue123'
    });

    expect(recoveredUser.role).toBe('admin');
    expect(recoveredUser.signInEnabled).toBe(true);
    expect(workspaceUserService.listSignInUsers(result.workspace.rootPath)).toContainEqual(
      expect.objectContaining({
        username: 'recovery.admin',
        displayName: 'Recovery Admin',
        role: 'admin',
        signInEnabled: true
      })
    );
  });

  it('rejects duplicate usernames during access recovery with a friendly error', () => {
    const result = workspaceService.create({
      name: 'Recovery Workspace Duplicate User',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS
      },
      includeExampleData: false,
      initialAdmin: {
        username: 'admin',
        displayName: 'Workspace Admin',
        password: 'admin1234'
      }
    });

    workspaceManager
      .getContext(result.workspace.rootPath)
      .db.prepare('UPDATE WorkspaceUsers SET SignInEnabled = 0')
      .run();

    expect(() =>
      workspaceUserService.recoverAccess(result.workspace.rootPath, {
        username: 'admin',
        displayName: 'Recovery Admin',
        password: 'rescue123'
      })
    ).toThrow('A workspace user with the username "admin" already exists.');
  });

  it('rejects duplicate display names when creating and updating workspace users', () => {
    const result = workspaceService.create({
      name: 'Unique Display Names',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS
      },
      includeExampleData: false,
      initialAdmin: {
        username: 'admin',
        displayName: 'Workspace Admin',
        password: 'admin1234'
      }
    });
    const workspaceRootPath = result.workspace.rootPath;

    const createdUser = workspaceUserService.create(workspaceRootPath, {
      username: 'taylor',
      displayName: 'Taylor Reed',
      password: '2468',
      role: 'editor'
    });

    expect(() =>
      workspaceUserService.create(workspaceRootPath, {
        username: 'taylor-2',
        displayName: 'Taylor Reed',
        password: '2468',
        role: 'viewer'
      })
    ).toThrow('A workspace user with the display name "Taylor Reed" already exists.');

    expect(() =>
      workspaceUserService.update(workspaceRootPath, createdUser.id, {
        username: 'taylor',
        displayName: 'Workspace Admin',
        role: 'editor'
      })
    ).toThrow('A workspace user with the display name "Workspace Admin" already exists.');
  });

  it('deletes workspace users that are not linked anywhere else', () => {
    const result = workspaceService.create({
      name: 'Delete Workspace User',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        userSystemEnabled: false
      },
      includeExampleData: false
    });
    const workspaceRootPath = result.workspace.rootPath;
    const createdUser = workspaceUserService.ensureImportedUser(
      workspaceManager.getContext(workspaceRootPath).db,
      'Taylor Reed'
    );

    const removal = workspaceUserService.remove(workspaceRootPath, createdUser.id);
    const remainingUserIds = workspaceUserService.list(workspaceRootPath).map((user) => user.id);

    expect(removal).toEqual({
      action: 'deleted',
      userId: createdUser.id
    });
    expect(remainingUserIds).not.toContain(createdUser.id);
  });

  it('archives linked workspace users instead of deleting them', () => {
    const result = workspaceService.create({
      name: 'Archive Workspace User',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        userSystemEnabled: false
      },
      includeExampleData: false
    });
    const workspaceRootPath = result.workspace.rootPath;
    const createdUser = workspaceUserService.ensureImportedUser(
      workspaceManager.getContext(workspaceRootPath).db,
      'Taylor Reed'
    );
    const db = workspaceManager.getContext(workspaceRootPath).db;

    db.prepare(
      `
        INSERT INTO ActivityLog (
          EventType,
          Message,
          DocumentRecordId,
          DocumentVersionId,
          ActorUserId,
          CreatedDate
        ) VALUES (?, ?, NULL, NULL, ?, ?)
      `
    ).run('user.test', 'Linked user activity', createdUser.id, '2026-04-09T09:00:00.000Z');

    const removal = workspaceUserService.remove(workspaceRootPath, createdUser.id);
    const archivedUser = workspaceUserService.getUser(workspaceRootPath, createdUser.id);

    expect(removal.action).toBe('archived');
    expect(removal.user).toEqual(
      expect.objectContaining({
        id: createdUser.id,
        archived: true,
        signInEnabled: false
      })
    );
    expect(archivedUser.archived).toBe(true);
    expect(archivedUser.signInEnabled).toBe(false);
    expect(archivedUser.linkedRecordCount).toBeGreaterThan(0);
    expect(workspaceUserService.listSignInUsers(workspaceRootPath)).not.toContainEqual(
      expect.objectContaining({ id: createdUser.id })
    );
  });

  it('can restore archived workspace users as inactive accounts', () => {
    const result = workspaceService.create({
      name: 'Restore Archived Workspace User',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        userSystemEnabled: false
      },
      includeExampleData: false
    });
    const workspaceRootPath = result.workspace.rootPath;
    const createdUser = workspaceUserService.ensureImportedUser(
      workspaceManager.getContext(workspaceRootPath).db,
      'Taylor Reed'
    );
    const db = workspaceManager.getContext(workspaceRootPath).db;

    db.prepare(
      `
        INSERT INTO ActivityLog (
          EventType,
          Message,
          DocumentRecordId,
          DocumentVersionId,
          ActorUserId,
          CreatedDate
        ) VALUES (?, ?, NULL, NULL, ?, ?)
      `
    ).run('user.test', 'Linked user activity', createdUser.id, '2026-04-09T09:00:00.000Z');

    workspaceUserService.remove(workspaceRootPath, createdUser.id);
    const restoredUser = workspaceUserService.unarchive(workspaceRootPath, createdUser.id);

    expect(restoredUser.archived).toBe(false);
    expect(restoredUser.signInEnabled).toBe(false);
    expect(workspaceUserService.list(workspaceRootPath)).toContainEqual(
      expect.objectContaining({
        id: createdUser.id,
        archived: false,
        signInEnabled: false
      })
    );
  });

  it('persists shared saved views and includes them in workspace summaries', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const savedView = savedViewService.create(created.workspace.rootPath, {
      name: 'Released this month',
      scope: 'shared',
      query: {
        search: '',
        statusFilter: 'Released',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: [
          {
            id: 'rule-1',
            field: 'releasedDate',
            operator: 'thisMonth'
          }
        ]
      },
      presentation: {
        ...DEFAULT_SAVED_VIEW_PRESENTATION,
        visualizationMode: 'timeline'
      }
    });

    const summary = workspaceService.getSummary(created.workspace.rootPath);
    expect(summary.summary.savedViews).toContainEqual(savedView);
    expect(summary.summary.savedViews.map((item) => item.scope)).toContain('shared');
  });

  it('persists custom lifecycle settings across create and reopen flows', () => {
    const lifecycle = buildCustomLifecycle();
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      lifecycle,
      includeExampleData: false
    });

    expect(created.summary.lifecycle.mode).toBe(lifecycle.mode);
    expect(created.summary.lifecycle.statuses).toEqual(lifecycle.statuses);
    expect(mapTransitions(created.summary.lifecycle)).toEqual(mapTransitions(lifecycle));
    expect(created.summary.statuses).toEqual(['Drafting', 'Review', 'Published', 'Retired']);

    workspaceService.close(created.workspace.rootPath);
    const reopened = workspaceService.open(created.workspace.rootPath);

    expect(reopened.summary.lifecycle.mode).toBe(lifecycle.mode);
    expect(reopened.summary.lifecycle.statuses).toEqual(lifecycle.statuses);
    expect(mapTransitions(reopened.summary.lifecycle)).toEqual(mapTransitions(lifecycle));
    expect(reopened.summary.statuses).toEqual(['Drafting', 'Review', 'Published', 'Retired']);
  });

  it('remaps shared and personal saved views when lifecycle statuses are renamed or merged', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    savedViewService.create(created.workspace.rootPath, {
      name: 'Released docs',
      scope: 'shared',
      query: {
        search: '',
        statusFilter: 'Released',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: []
      },
      presentation: DEFAULT_SAVED_VIEW_PRESENTATION
    });
    catalogService.createPersonalSavedView(created.workspace.rootPath, {
      id: 'personal-archived',
      name: 'Archived docs',
      scope: 'personal',
      query: {
        search: '',
        statusFilter: 'Archived',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: []
      },
      presentation: DEFAULT_SAVED_VIEW_PRESENTATION,
      createdDate: '2026-04-07T10:00:00.000Z',
      modifiedDate: '2026-04-07T10:00:00.000Z'
    });

    const nextLifecycle = createDefaultWorkspaceLifecycle();
    nextLifecycle.mode = 'custom';
    nextLifecycle.statuses = nextLifecycle.statuses
      .filter((status) => status.key !== 'archived')
      .map((status) =>
        status.key === 'released'
          ? {
              ...status,
              name: 'Published'
            }
          : status
      );
    nextLifecycle.allowedTransitions = nextLifecycle.allowedTransitions.filter(
      (transition) =>
        transition.fromStatusKey !== 'archived' && transition.toStatusKey !== 'archived'
    );

    const updated = workspaceService.updateSettings(created.workspace.rootPath, {
      settings: created.summary.settings,
      lifecycle: nextLifecycle,
      statusRemaps: [{ fromStatusKey: 'archived', toStatusKey: 'obsolete' }]
    });

    const renamedSharedView = updated.summary.savedViews.find((view) => view.name === 'Released docs');
    const remappedPersonalView = catalogService.listPersonalSavedViews(created.workspace.rootPath)[0];

    expect(updated.summary.statuses).toEqual(['Draft', 'In Review', 'Published', 'Obsolete']);
    expect(renamedSharedView?.query.statusFilter).toBe('Published');
    expect(remappedPersonalView?.query.statusFilter).toBe('Obsolete');
  });

  it('requires status remaps before deleting lifecycle statuses that are still referenced', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    savedViewService.create(created.workspace.rootPath, {
      name: 'Archived docs',
      scope: 'shared',
      query: {
        search: '',
        statusFilter: 'Archived',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: []
      },
      presentation: DEFAULT_SAVED_VIEW_PRESENTATION
    });

    const nextLifecycle = createDefaultWorkspaceLifecycle();
    nextLifecycle.mode = 'custom';
    nextLifecycle.statuses = nextLifecycle.statuses.filter((status) => status.key !== 'archived');
    nextLifecycle.allowedTransitions = nextLifecycle.allowedTransitions.filter(
      (transition) =>
        transition.fromStatusKey !== 'archived' && transition.toStatusKey !== 'archived'
    );

    expect(() =>
      workspaceService.updateSettings(created.workspace.rootPath, {
        settings: created.summary.settings,
        lifecycle: nextLifecycle
      })
    ).toThrow('Map the removed status "Archived" to a replacement status before saving the lifecycle.');
  });

  it('updates the shared dashboard layout and keeps saved-view widgets portable', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const sharedView = savedViewService.create(created.workspace.rootPath, {
      name: 'Drafts with missing files',
      scope: 'shared',
      query: {
        search: '',
        statusFilter: 'Draft',
        projectFilter: 'All',
        healthFilter: 'All',
        rules: [
          {
            id: 'rule-1',
            field: 'healthFlag',
            operator: 'is',
            value: 'missingFiles'
          }
        ]
      },
      presentation: DEFAULT_SAVED_VIEW_PRESENTATION
    });

    const nextLayout = workspaceService.updateDashboardLayout(created.workspace.rootPath, {
      layout: {
        widgets: [
          {
            id: 'saved-view-widget',
            type: 'savedView',
            title: 'Pinned drafts',
            x: 0,
            y: 0,
            w: 6,
            h: 2,
            config: {},
            savedViewId: sharedView.id
          }
        ]
      }
    });

    expect(nextLayout.widgets).toEqual([
      expect.objectContaining({
        id: 'saved-view-widget',
        type: 'savedView',
        savedViewId: sharedView.id
      })
    ]);
    expect(workspaceService.getSummary(created.workspace.rootPath).summary.dashboardLayout).toEqual(
      nextLayout
    );
  });

  it('stores the workspace name separately from a custom workspace folder name', () => {
    const result = workspaceService.create({
      name: 'Quality Workspace',
      folderName: 'Quality Files',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = path.join(tempRoot, 'Quality Files');
    const databasePath = path.join(
      workspaceRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const db = new Database(databasePath, { fileMustExist: true });
    const row = db
      .prepare('SELECT Name, RootPath FROM Workspaces WHERE Id = 1')
      .get() as { Name: string; RootPath: string } | undefined;
    db.close();

    expect(result.workspace.name).toBe('Quality Workspace');
    expect(result.workspace.rootPath).toBe(workspaceRootPath);
    expect(row?.Name).toBe('Quality Workspace');
    expect(row?.RootPath).toBe(workspaceRootPath);
  });

  it('copies and removes the workspace company logo through workspace settings updates', () => {
    const result = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });

    const workspaceRootPath = result.workspace.rootPath;
    const sourceLogoPath = path.join(tempRoot, 'company-logo.png');
    writeFileSync(sourceLogoPath, 'png-data', 'utf8');

    const updated = workspaceService.updateSettings(workspaceRootPath, {
      settings: {
        ...result.summary.settings,
        companyLogoPath: ''
      },
      companyLogoSourceFilePath: sourceLogoPath,
      clearCompanyLogo: false
    });

    expect(updated.summary.settings.companyLogoPath).toBe('Database/branding/company-logo.png');
    expect(
      existsSync(path.join(workspaceRootPath, 'Database', 'branding', 'company-logo.png'))
    ).toBe(true);

    const cleared = workspaceService.updateSettings(workspaceRootPath, {
      settings: {
        ...updated.summary.settings,
        companyLogoPath: ''
      },
      clearCompanyLogo: true
    });

    expect(cleared.summary.settings.companyLogoPath).toBe('');
    expect(
      existsSync(path.join(workspaceRootPath, 'Database', 'branding', 'company-logo.png'))
    ).toBe(false);
  });

  it('supports multiple open workspaces and closing individual tabs by root path', () => {
    const first = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const second = workspaceService.create({
      name: 'Manufacturing',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });

    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual([
      'Quality',
      'Manufacturing'
    ]);

    workspaceService.close(first.workspace.rootPath);
    expect(workspaceService.listOpen().map((workspace) => workspace.name)).toEqual(['Manufacturing']);
    expect(second.workspace.rootPath).toBe(path.join(tempRoot, 'Manufacturing'));
  });

  it('updates workspace metadata when a workspace folder is moved and reopened', () => {
    const originalRootPath = path.join(tempRoot, 'Quality');
    workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    workspaceService.close(originalRootPath);

    const movedRootPath = path.join(tempRoot, 'Archive', 'Quality Renamed');
    mkdirSync(path.dirname(movedRootPath), { recursive: true });
    renameSync(originalRootPath, movedRootPath);

    const reopened = workspaceService.open(movedRootPath);
    const movedDatabasePath = path.join(
      movedRootPath,
      WORKSPACE_DATABASE_DIRECTORY_NAME,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const db = new Database(movedDatabasePath, { fileMustExist: true });
    const row = db
      .prepare('SELECT Name, FilePath, RootPath, FileOrganizationMode FROM Workspaces WHERE Id = 1')
      .get() as
      | { Name: string; FilePath: string; RootPath: string; FileOrganizationMode: string }
      | undefined;
    db.close();

    expect(reopened.workspace.name).toBe('Quality');
    expect(reopened.workspace.rootPath).toBe(movedRootPath);
    expect(row?.Name).toBe('Quality');
    expect(row?.RootPath).toBe(movedRootPath);
    expect(row?.FilePath).toBe(movedDatabasePath);
    expect(row?.FileOrganizationMode).toBe('flat');
  });

  it('migrates workspace file organization settings and records unmanaged path warnings', () => {
    const created = workspaceService.create({
      name: 'Quality',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Operating Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version folder'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'procedure.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'procedure working file', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const unmanagedDirectory = path.join(
      workspaceRootPath,
      ...shellDocument.documentFolderPath.split('/'),
      '001',
      'custom'
    );
    mkdirSync(unmanagedDirectory, { recursive: true });

    const updated = workspaceService.updateSettings(workspaceRootPath, {
      ...DEFAULT_WORKSPACE_SETTINGS,
      storageLayoutPreset: 'friendly-id',
      fileOrganizationMode: 'role-subfolders'
    });
    const reopened = workspaceService.open(workspaceRootPath);

    expect(updated.summary.settings.storageLayoutPreset).toBe('friendly-id');
    expect(updated.summary.settings.fileOrganizationMode).toBe('role-subfolders');
    expect(updated.warnings?.[0]).toContain('unmanaged paths');
    expect(reopened.summary.settings.fileOrganizationMode).toBe('role-subfolders');
  });

  it('persists custom document ID format settings', () => {
    const result = workspaceService.create({
      name: 'Formats',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        documentIdFormatPreset: 'custom',
        documentIdFormatTemplate: '<docType>-<language>-<year>-<sequence:3>'
      },
      includeExampleData: false
    });

    expect(result.summary.settings.documentIdFormatPreset).toBe('custom');
    expect(result.summary.settings.documentIdFormatTemplate).toBe(
      '<docType>-<language>-<year>-<sequence:3>'
    );
  });

  it('prunes activity log rows to the configured workspace retention limit', () => {
    const created = workspaceService.create({
      name: 'Retention Test',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        activityLogMaxRows: 5
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;

    for (let index = 1; index <= 7; index += 1) {
      documentService.create(workspaceRootPath, {
        title: `Retention Procedure ${index}`,
        documentTypeId: 2,
        author: 'Taylor Reed',
        versionScheme: 'numeric-3'
      });
    }

    const db = workspaceManager.getContext(workspaceRootPath).db;
    const countRow = db
      .prepare('SELECT COUNT(*) AS Count FROM ActivityLog')
      .get() as { Count: number };
    const activity = workspaceService.listActivity(workspaceRootPath);

    expect(countRow.Count).toBe(5);
    expect(activity).toHaveLength(5);
    expect(activity[0]?.message).toContain('Retention Procedure 7');
    expect(activity.some((item) => item.message.includes('Retention Procedure 1'))).toBe(false);
    expect(activity.some((item) => item.message.includes('Workspace "Retention Test" was created.'))).toBe(
      false
    );
  });

  it('stops recording new activity after the workspace activity log is disabled', () => {
    const created = workspaceService.create({
      name: 'Disabled Activity',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;

    documentService.create(workspaceRootPath, {
      title: 'Logged Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });

    const db = workspaceManager.getContext(workspaceRootPath).db;
    const beforeDisableCount = (
      db.prepare('SELECT COUNT(*) AS Count FROM ActivityLog').get() as {
        Count: number;
      }
    ).Count;

    workspaceService.updateSettings(workspaceRootPath, {
      ...created.summary.settings,
      activityLogEnabled: false
    });

    documentService.create(workspaceRootPath, {
      title: 'Unlogged Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });

    const afterDisableCount = (
      db.prepare('SELECT COUNT(*) AS Count FROM ActivityLog').get() as {
        Count: number;
      }
    ).Count;
    const summary = workspaceService.getSummary(workspaceRootPath);

    expect(afterDisableCount).toBe(beforeDisableCount);
    expect(workspaceService.listActivity(workspaceRootPath)).toEqual([]);
    expect(summary.summary.dashboard.recentActivity).toEqual([]);
    expect(summary.summary.settings.activityLogEnabled).toBe(false);
  });

  it('creates workspace snapshots and reports integrity issues for missing managed files', () => {
    const created = workspaceService.create({
      name: 'Recoverable',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Recoverable Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'recoverable.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'recoverable working file', 'utf8');
    const detailWithFile = documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'working',
      sourceFilePaths: [sourceFile]
    });

    const backup = workspaceService.createBackup(workspaceRootPath);
    const listedBackups = workspaceService.listBackups(workspaceRootPath);
    const restorePreview = workspaceService.getRestorePreview(
      workspaceRootPath,
      backup.backup.id,
      tempRoot,
      'Recoverable Restored'
    );

    expect(listedBackups).toHaveLength(1);
    expect(restorePreview.destinationExists).toBe(false);
    expect(backup.backup.documentCount).toBe(1);

    rmSync(
      path.join(workspaceRootPath, ...detailWithFile.files[0]!.filePath.split('/')),
      { force: true }
    );
    const integrity = workspaceService.integrityCheck(workspaceRootPath);
    expect(integrity.issueCount).toBeGreaterThan(0);
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(true);
  });

  it('includes workspace user changes in backup restore diffs', () => {
    const created = workspaceService.create({
      name: 'Quality Offline',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const backup = workspaceService.createBackup(workspaceRootPath);

    workspaceUserService.create(workspaceRootPath, {
      username: 'taylor',
      displayName: 'Taylor Reed',
      password: '2468',
      role: 'editor'
    });

    const diff = workspaceService.getRestoreDiff(workspaceRootPath, backup.backup.id);
    const userSection = diff.sections.find((section) => section.id === 'users');

    expect(userSection).toBeDefined();
    expect(userSection?.removedCount).toBe(1);
    expect(userSection?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Taylor Reed',
          changeType: 'removed'
        })
      ])
    );
  });

  it('preserves renamed document root paths when overwriting from a snapshot', () => {
    const created = workspaceService.create({
      name: 'Renamed Docs Recovery',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Internal Audit Procedure',
      documentTypeId: 2,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'audit-concept.pdf');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'audit concept pdf', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'concept-pdf',
      sourceFilePaths: [sourceFile]
    });

    const renamed = workspaceService.updateSettings(workspaceRootPath, {
      ...created.summary.settings,
      documentsDirectoryName: '02 Documents'
    });
    const renamedDetail = documentService.getDetail(workspaceRootPath, shellDocument.id);
    const renamedFile = renamedDetail.versions[0]!.files[0]!;
    expect(renamed.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(renamedDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(renamedFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(workspaceRootPath, ...renamedFile.filePath.split('/')))
    ).toBe(true);

    const backup = workspaceService.createBackup(workspaceRootPath);
    const backupDatabasePath = path.join(
      backup.backup.backupPath,
      renamed.summary.settings.databaseDirectoryName,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const backupDb = new Database(backupDatabasePath, { fileMustExist: true });
    backupDb
      .prepare('UPDATE DocumentVersionFiles SET FilePath = REPLACE(FilePath, ?, ?)')
      .run(
        `${renamed.summary.settings.documentsDirectoryName}/`,
        `${DEFAULT_WORKSPACE_SETTINGS.documentsDirectoryName}/`
      );
    backupDb.close();
    writeFileSync(
      path.join(workspaceRootPath, ...renamedFile.filePath.split('/')),
      'changed after backup',
      'utf8'
    );

    workspaceService.updateSettings(workspaceRootPath, {
      ...renamed.summary.settings,
      defaultCompany: 'Changed After Backup'
    });

    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'overwrite-current-database'
    });
    const restoredDetail = documentService.getDetail(workspaceRootPath, shellDocument.id);
    const restoredFile = restoredDetail.versions[0]!.files[0]!;
    const integrity = workspaceService.integrityCheck(workspaceRootPath);

    expect(restored.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(restored.summary.settings.defaultCompany).toBe('');
    expect(restoredDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(restoredFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(workspaceRootPath, ...restoredFile.filePath.split('/')))
    ).toBe(true);
    expect(
      readFileSync(path.join(workspaceRootPath, ...restoredFile.filePath.split('/')), 'utf8')
    ).toBe('audit concept pdf');
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(false);
  });

  it('relinks tracked files automatically when restoring a snapshot into a new workspace', () => {
    const created = workspaceService.create({
      name: 'Relink Restored Files',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'friendly-id',
        fileOrganizationMode: 'role-subfolders'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const shellDocument = documentService.create(workspaceRootPath, {
      title: 'Supplier Assessment Report',
      documentTypeId: 3,
      author: 'Taylor Reed',
      versionScheme: 'numeric-3'
    });
    const versioned = documentService.createVersion(workspaceRootPath, {
      documentRecordId: shellDocument.id,
      revisionDescription: 'Initial version'
    });
    const sourceFile = path.join(tempRoot, 'incoming', 'supplier-report.pdf');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'supplier report pdf', 'utf8');
    documentService.addVersionFiles(workspaceRootPath, {
      documentVersionId: versioned.versions[0]!.id,
      role: 'final-pdf',
      sourceFilePaths: [sourceFile]
    });

    const renamed = workspaceService.updateSettings(workspaceRootPath, {
      ...created.summary.settings,
      documentsDirectoryName: '02 Documents'
    });
    const backup = workspaceService.createBackup(workspaceRootPath);
    const backupDatabasePath = path.join(
      backup.backup.backupPath,
      renamed.summary.settings.databaseDirectoryName,
      WORKSPACE_DATABASE_FILE_NAME
    );
    const backupDb = new Database(backupDatabasePath, { fileMustExist: true });
    backupDb
      .prepare('UPDATE DocumentVersionFiles SET FilePath = REPLACE(FilePath, ?, ?)')
      .run(
        `${renamed.summary.settings.documentsDirectoryName}/`,
        `${DEFAULT_WORKSPACE_SETTINGS.documentsDirectoryName}/`
      );
    backupDb.close();

    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'export-to-new-workspace',
      destinationParentPath: tempRoot,
      destinationFolderName: 'Relink Restored Files Copy'
    });
    const restoredDetail = documentService.getDetail(restored.workspace.rootPath, shellDocument.id);
    const restoredFile = restoredDetail.versions[0]!.files[0]!;
    const integrity = workspaceService.integrityCheck(restored.workspace.rootPath);

    expect(restored.summary.settings.documentsDirectoryName).toBe('02 Documents');
    expect(restoredDetail.documentFolderPath.startsWith('02 Documents/')).toBe(true);
    expect(restoredFile.filePath.startsWith('02 Documents/')).toBe(true);
    expect(
      existsSync(path.join(restored.workspace.rootPath, ...restoredFile.filePath.split('/')))
    ).toBe(true);
    expect(integrity.issues.some((issue) => issue.code === 'missing-managed-file')).toBe(false);
  });

  it('preserves templates across backup and restore', () => {
    const created = workspaceService.create({
      name: 'Template Recovery',
      parentPath: tempRoot,
      settings: {
        ...DEFAULT_WORKSPACE_SETTINGS,
        storageLayoutPreset: 'stable-id',
        fileOrganizationMode: 'flat'
      },
      includeExampleData: false
    });
    const workspaceRootPath = created.workspace.rootPath;
    const sourceFile = path.join(tempRoot, 'incoming', 'template-procedure.docx');
    mkdirSync(path.dirname(sourceFile), { recursive: true });
    writeFileSync(sourceFile, 'template procedure', 'utf8');

    const template = templateService.create(workspaceRootPath, {
      name: 'Procedure Starter'
    });
    templateService.addFiles(workspaceRootPath, {
      templateId: template.id,
      sourceFilePaths: [sourceFile]
    });

    const backup = workspaceService.createBackup(workspaceRootPath);
    const restored = workspaceService.restoreBackup(workspaceRootPath, {
      backupId: backup.backup.id,
      mode: 'export-to-new-workspace',
      destinationParentPath: tempRoot,
      destinationFolderName: 'Template Recovery Restored'
    });

    expect(restored.summary.templates).toHaveLength(1);
    expect(restored.summary.templates[0]?.name).toBe('Procedure Starter');
    expect(restored.summary.templates[0]?.files[0]?.fileName).toBe('template-procedure.docx');
    expect(
      existsSync(
        path.join(
          restored.workspace.rootPath,
          'Templates',
          'Procedure Starter',
          'template-procedure.docx'
        )
      )
    ).toBe(true);
  });
});
