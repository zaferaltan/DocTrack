import type Database from 'better-sqlite3';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import type {
  WorkspaceRoleDefinition,
  WorkspaceRoleRemap,
  WorkspaceRoleSettings,
  WorkspaceRoleSettingsUpdateInput,
} from '@shared/types';
import {
  BUILT_IN_WORKSPACE_ROLE_KEYS,
  buildWorkspacePermissions,
  cloneWorkspaceRoleDefinition,
  createDefaultWorkspaceRoleSettings,
  getWorkspaceRoleName,
  isBuiltInWorkspaceRoleKey,
  isWorkspaceRoleMode,
} from '@shared/workspaceRoles';

interface WorkspaceRoleRow {
  RoleKey: string;
  Name: string;
  SortOrder: number;
  CanViewWorkspace: number;
  CanEditDocuments: number;
  CanManageSharedViews: number;
  CanManageUsers: number;
  CanManageRoles: number;
  CanManageWorkspaceSettings: number;
  CanManageWorkspaceMaintenance: number;
}

const WORKSPACE_ROLE_SELECT_COLUMNS = `
  RoleKey,
  Name,
  SortOrder,
  CanViewWorkspace,
  CanEditDocuments,
  CanManageSharedViews,
  CanManageUsers,
  CanManageRoles,
  CanManageWorkspaceSettings,
  CanManageWorkspaceMaintenance
`;

export class WorkspaceRoleService {
  constructor(private readonly workspaceManager: WorkspaceManager) {}

  list(rootPath: string): WorkspaceRoleSettings {
    const context = this.workspaceManager.getContext(rootPath);
    return this.getRoleSettingsForDb(context.db);
  }

  getRoleName(rootPath: string, roleKey: string): string {
    return getWorkspaceRoleName(this.list(rootPath), roleKey);
  }

  getPermissions(rootPath: string, roleKey: string) {
    return buildWorkspacePermissions(this.list(rootPath), roleKey);
  }

  save(rootPath: string, input: WorkspaceRoleSettingsUpdateInput): WorkspaceRoleSettings {
    const context = this.workspaceManager.getContext(rootPath);
    this.ensureRolesTableInitialized(context.db);
    const transaction = context.db.transaction(() => {
      if (input.mode === 'default') {
        this.saveDefaultMode(context.db, input.roleRemaps ?? []);
      } else {
        this.saveCustomMode(context.db, input.roles ?? []);
      }
    });
    transaction();
    return this.getRoleSettingsForDb(context.db);
  }

  getRoleSettingsForDb(db: Database.Database): WorkspaceRoleSettings {
    this.ensureRolesTableInitialized(db);
    const modeRow = db.prepare('SELECT RoleMode FROM Workspaces WHERE Id = 1').get() as
      | { RoleMode: string }
      | undefined;
    const mode = isWorkspaceRoleMode(modeRow?.RoleMode ?? '') ? modeRow!.RoleMode : 'default';

    if (mode === 'default') {
      return createDefaultWorkspaceRoleSettings('default');
    }

    const rows = db
      .prepare(
        `
          SELECT
            ${WORKSPACE_ROLE_SELECT_COLUMNS}
          FROM WorkspaceRoles
          ORDER BY SortOrder ASC, Name COLLATE NOCASE ASC
        `,
      )
      .all() as WorkspaceRoleRow[];

    if (rows.length === 0) {
      return createDefaultWorkspaceRoleSettings('default');
    }

    return {
      mode: 'custom',
      roles: rows.map((row) => this.mapRow(row)),
    };
  }

  private saveDefaultMode(db: Database.Database, roleRemaps: WorkspaceRoleRemap[]): void {
    const assignedCustomRoleKeys = (
      db
        .prepare(
          `
            SELECT DISTINCT Role
            FROM WorkspaceUsers
            WHERE Role NOT IN (${BUILT_IN_WORKSPACE_ROLE_KEYS.map(() => '?').join(', ')})
            ORDER BY Role ASC
          `,
        )
        .all(...BUILT_IN_WORKSPACE_ROLE_KEYS) as Array<{ Role: string }>
    ).map((row) => row.Role);

    const remapByRoleKey = new Map(roleRemaps.map((remap) => [remap.fromRoleKey, remap.toRoleKey]));
    const missingRemaps = assignedCustomRoleKeys.filter((roleKey) => !remapByRoleKey.has(roleKey));
    if (missingRemaps.length > 0) {
      throw new Error('Reassign every custom role before switching back to default mode.');
    }

    for (const [fromRoleKey, toRoleKey] of remapByRoleKey.entries()) {
      if (!isBuiltInWorkspaceRoleKey(toRoleKey)) {
        throw new Error('Custom roles can only be remapped to built-in roles in default mode.');
      }
      db.prepare('UPDATE WorkspaceUsers SET Role = ? WHERE Role = ?').run(toRoleKey, fromRoleKey);
    }

    db.prepare('UPDATE Workspaces SET RoleMode = ? WHERE Id = 1').run('default');
    db.prepare('DELETE FROM WorkspaceRoles').run();
    this.seedBuiltInRoles(db);
  }

  private saveCustomMode(db: Database.Database, roles: WorkspaceRoleDefinition[]): void {
    const normalizedRoles = roles.map((role, index) => ({
      ...cloneWorkspaceRoleDefinition(role),
      key: role.key.trim(),
      name: role.name.trim(),
      sortOrder: index,
    }));
    this.validateCustomRoles(db, normalizedRoles);

    db.prepare('UPDATE Workspaces SET RoleMode = ? WHERE Id = 1').run('custom');
    db.prepare('DELETE FROM WorkspaceRoles').run();

    const insertRole = db.prepare(
      `
        INSERT INTO WorkspaceRoles (
          RoleKey,
          Name,
          SortOrder,
          CanViewWorkspace,
          CanEditDocuments,
          CanManageSharedViews,
          CanManageUsers,
          CanManageRoles,
          CanManageWorkspaceSettings,
          CanManageWorkspaceMaintenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    for (const role of normalizedRoles) {
      insertRole.run(
        role.key,
        role.name,
        role.sortOrder,
        role.permissions.canViewWorkspace ? 1 : 0,
        role.permissions.canEditDocuments ? 1 : 0,
        role.permissions.canManageSharedViews ? 1 : 0,
        role.permissions.canManageUsers ? 1 : 0,
        role.permissions.canManageRoles ? 1 : 0,
        role.permissions.canManageWorkspaceSettings ? 1 : 0,
        role.permissions.canManageWorkspaceMaintenance ? 1 : 0,
      );
    }
  }

  private validateCustomRoles(db: Database.Database, roles: WorkspaceRoleDefinition[]): void {
    if (roles.length === 0) {
      throw new Error('At least one custom role must remain.');
    }

    const seenKeys = new Set<string>();
    const seenNames = new Set<string>();
    for (const role of roles) {
      if (!role.key) {
        throw new Error('Every role must have a stable key.');
      }
      if (!role.name) {
        throw new Error('Every role must have a name.');
      }
      const normalizedName = role.name.toLocaleLowerCase();
      if (seenKeys.has(role.key)) {
        throw new Error(`The role key "${role.key}" is duplicated.`);
      }
      if (seenNames.has(normalizedName)) {
        throw new Error(`The role name "${role.name}" is duplicated.`);
      }
      seenKeys.add(role.key);
      seenNames.add(normalizedName);
    }

    if (!roles.some((role) => role.permissions.canManageUsers && role.permissions.canManageRoles)) {
      throw new Error('At least one custom role must be able to manage users and roles.');
    }

    const assignedRoleKeys = (
      db.prepare('SELECT DISTINCT Role FROM WorkspaceUsers ORDER BY Role ASC').all() as Array<{
        Role: string;
      }>
    ).map((row) => row.Role);
    const missingAssignedRole = assignedRoleKeys.find((roleKey) => !seenKeys.has(roleKey));
    if (missingAssignedRole) {
      throw new Error(`The role "${this.getRoleNameForDb(db, missingAssignedRole)}" is still assigned to a user.`);
    }
  }

  private getRoleNameForDb(db: Database.Database, roleKey: string): string {
    const roleSettings = this.getRoleSettingsForDb(db);
    return getWorkspaceRoleName(roleSettings, roleKey);
  }

  private ensureRolesTableInitialized(db: Database.Database): void {
    const modeRow = db.prepare('SELECT RoleMode FROM Workspaces WHERE Id = 1').get() as
      | { RoleMode: string }
      | undefined;
    const mode = isWorkspaceRoleMode(modeRow?.RoleMode ?? '') ? modeRow!.RoleMode : 'default';
    const existingRoleCount = (
      db.prepare('SELECT COUNT(*) AS Total FROM WorkspaceRoles').get() as { Total: number }
    ).Total;

    if (existingRoleCount === 0 || mode === 'default') {
      this.seedBuiltInRoles(db);
    }
  }

  private seedBuiltInRoles(db: Database.Database): void {
    const defaultRoleSettings = createDefaultWorkspaceRoleSettings('default');
    db.prepare('DELETE FROM WorkspaceRoles').run();
    const insertRole = db.prepare(
      `
        INSERT INTO WorkspaceRoles (
          RoleKey,
          Name,
          SortOrder,
          CanViewWorkspace,
          CanEditDocuments,
          CanManageSharedViews,
          CanManageUsers,
          CanManageRoles,
          CanManageWorkspaceSettings,
          CanManageWorkspaceMaintenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    for (const role of defaultRoleSettings.roles) {
      insertRole.run(
        role.key,
        role.name,
        role.sortOrder,
        role.permissions.canViewWorkspace ? 1 : 0,
        role.permissions.canEditDocuments ? 1 : 0,
        role.permissions.canManageSharedViews ? 1 : 0,
        role.permissions.canManageUsers ? 1 : 0,
        role.permissions.canManageRoles ? 1 : 0,
        role.permissions.canManageWorkspaceSettings ? 1 : 0,
        role.permissions.canManageWorkspaceMaintenance ? 1 : 0,
      );
    }
  }

  private mapRow(row: WorkspaceRoleRow): WorkspaceRoleDefinition {
    return {
      key: row.RoleKey,
      name: row.Name,
      sortOrder: row.SortOrder,
      permissions: {
        canViewWorkspace: Boolean(row.CanViewWorkspace),
        canEditDocuments: Boolean(row.CanEditDocuments),
        canManageSharedViews: Boolean(row.CanManageSharedViews),
        canManageUsers: Boolean(row.CanManageUsers),
        canManageRoles: Boolean(row.CanManageRoles),
        canManageWorkspaceSettings: Boolean(row.CanManageWorkspaceSettings),
        canManageWorkspaceMaintenance: Boolean(row.CanManageWorkspaceMaintenance),
      },
    };
  }
}
