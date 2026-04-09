import type {
  WorkspacePermissions,
  WorkspaceRole,
  WorkspaceRoleDefinition,
  WorkspaceRoleMode,
  WorkspaceRolePermissions,
  WorkspaceRoleSettings,
} from '@shared/types';

export const BUILT_IN_WORKSPACE_ROLE_KEYS = ['admin', 'editor', 'viewer'] as const;

export const WORKSPACE_ROLE_PERMISSION_KEYS = [
  'canViewWorkspace',
  'canEditDocuments',
  'canManageSharedViews',
  'canManageUsers',
  'canManageRoles',
  'canManageWorkspaceSettings',
  'canManageWorkspaceMaintenance',
] as const;

export const DEFAULT_WORKSPACE_ROLE_DEFINITIONS: readonly WorkspaceRoleDefinition[] = [
  {
    key: 'admin',
    name: 'Admin',
    sortOrder: 0,
    permissions: {
      canViewWorkspace: true,
      canEditDocuments: true,
      canManageSharedViews: true,
      canManageUsers: true,
      canManageRoles: true,
      canManageWorkspaceSettings: true,
      canManageWorkspaceMaintenance: true,
    },
  },
  {
    key: 'editor',
    name: 'Editor',
    sortOrder: 1,
    permissions: {
      canViewWorkspace: true,
      canEditDocuments: true,
      canManageSharedViews: true,
      canManageUsers: false,
      canManageRoles: false,
      canManageWorkspaceSettings: false,
      canManageWorkspaceMaintenance: false,
    },
  },
  {
    key: 'viewer',
    name: 'Viewer',
    sortOrder: 2,
    permissions: {
      canViewWorkspace: true,
      canEditDocuments: false,
      canManageSharedViews: false,
      canManageUsers: false,
      canManageRoles: false,
      canManageWorkspaceSettings: false,
      canManageWorkspaceMaintenance: false,
    },
  },
] as const;

export const cloneWorkspaceRolePermissions = (
  permissions: WorkspaceRolePermissions,
): WorkspaceRolePermissions => ({
  ...permissions,
});

export const cloneWorkspaceRoleDefinition = (
  role: WorkspaceRoleDefinition,
): WorkspaceRoleDefinition => ({
  ...role,
  permissions: cloneWorkspaceRolePermissions(role.permissions),
});

export const cloneWorkspaceRoleSettings = (
  roleSettings: WorkspaceRoleSettings,
): WorkspaceRoleSettings => ({
  mode: roleSettings.mode,
  roles: roleSettings.roles.map(cloneWorkspaceRoleDefinition),
});

export const createDefaultWorkspaceRoleSettings = (
  mode: WorkspaceRoleMode = 'default',
): WorkspaceRoleSettings => ({
  mode,
  roles: DEFAULT_WORKSPACE_ROLE_DEFINITIONS.map(cloneWorkspaceRoleDefinition),
});

export const isWorkspaceRoleMode = (value: string): value is WorkspaceRoleMode =>
  value === 'default' || value === 'custom';

export const isBuiltInWorkspaceRoleKey = (
  value: string,
): value is (typeof BUILT_IN_WORKSPACE_ROLE_KEYS)[number] =>
  BUILT_IN_WORKSPACE_ROLE_KEYS.includes(
    value as (typeof BUILT_IN_WORKSPACE_ROLE_KEYS)[number],
  );

export const getWorkspaceRolePermissions = (
  roleSettings: WorkspaceRoleSettings | null | undefined,
  roleKey: WorkspaceRole,
): WorkspaceRolePermissions => {
  const effectiveSettings = roleSettings ?? createDefaultWorkspaceRoleSettings();
  const matchingRole = effectiveSettings.roles.find((role) => role.key === roleKey);

  if (matchingRole) {
    return cloneWorkspaceRolePermissions(matchingRole.permissions);
  }

  return cloneWorkspaceRolePermissions(
    DEFAULT_WORKSPACE_ROLE_DEFINITIONS.find((role) => role.key === 'viewer')!
      .permissions,
  );
};

export const getWorkspaceRoleName = (
  roleSettings: WorkspaceRoleSettings | null | undefined,
  roleKey: WorkspaceRole,
): string =>
  roleSettings?.roles.find((role) => role.key === roleKey)?.name ??
  DEFAULT_WORKSPACE_ROLE_DEFINITIONS.find((role) => role.key === roleKey)?.name ??
  roleKey;

export const buildWorkspacePermissions = (
  roleSettings: WorkspaceRoleSettings | null | undefined,
  roleKey: WorkspaceRole,
): WorkspacePermissions => {
  const rolePermissions = getWorkspaceRolePermissions(roleSettings, roleKey);
  const canManageWorkspace =
    rolePermissions.canManageUsers ||
    rolePermissions.canManageRoles ||
    rolePermissions.canManageWorkspaceSettings ||
    rolePermissions.canManageWorkspaceMaintenance;

  return {
    canReadWorkspace: rolePermissions.canViewWorkspace,
    canEditWorkspace: rolePermissions.canEditDocuments,
    canManageWorkspace,
    ...rolePermissions,
  };
};
