import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { WorkspaceRoleService } from '@main/services/workspaceRoleService';
import { nowIso } from '@main/utils/date';
import type {
  WorkspaceAccessRecoveryInput,
  WorkspaceInitialAdminInput,
  WorkspaceRoleSettings,
  WorkspaceRole,
  WorkspaceUser,
  WorkspaceUserRemovalResult,
  WorkspaceUserCreateInput,
  WorkspaceUserUpdateInput
} from '@shared/types';
import { getWorkspaceRoleName } from '@shared/workspaceRoles';

interface WorkspaceUserRow {
  Id: number;
  Username: string;
  DisplayName: string;
  Role: WorkspaceRole;
  SignInEnabled: number;
  Archived: number;
  PasswordSalt: string | null;
  PasswordHash: string | null;
  LinkedRecordCount: number;
  LastSignedInDate: string | null;
  CreatedDate: string;
  ModifiedDate: string;
}

const normalizeUsername = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

const ensurePassword = (password: string): string => {
  const normalized = password.trim();
  if (normalized.length < 4) {
    throw new Error('Password or PIN must be at least 4 characters.');
  }

  return normalized;
};

const hashPassword = (password: string, salt = randomBytes(16).toString('hex')): { salt: string; hash: string } => ({
  salt,
  hash: scryptSync(password, salt, 64).toString('hex')
});

const verifyPassword = (password: string, salt: string, hash: string): boolean => {
  const actual = Buffer.from(hash, 'hex');
  const expected = scryptSync(password, salt, actual.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const WORKSPACE_USER_SELECT_COLUMNS = `
  Id,
  Username,
  DisplayName,
  Role,
  SignInEnabled,
  Archived,
  PasswordSalt,
  PasswordHash,
  LastSignedInDate,
  CreatedDate,
  ModifiedDate,
  (
    (SELECT COUNT(*) FROM Documents WHERE AuthorUserId = WorkspaceUsers.Id) +
    (SELECT COUNT(*) FROM DocumentVersions WHERE ReviewedByUserId = WorkspaceUsers.Id) +
    (SELECT COUNT(*) FROM DocumentVersions WHERE ApprovedByUserId = WorkspaceUsers.Id) +
    (SELECT COUNT(*) FROM ActivityLog WHERE ActorUserId = WorkspaceUsers.Id)
  ) AS LinkedRecordCount
`;

export class WorkspaceUserService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly workspaceRoleService = new WorkspaceRoleService(workspaceManager)
  ) {}

  list(rootPath: string): WorkspaceUser[] {
    const context = this.workspaceManager.getContext(rootPath);
    const roleSettings = this.workspaceRoleService.list(rootPath);
    const roleSortOrder = new Map(
      roleSettings.roles.map((role) => [role.key, role.sortOrder])
    );
    const rows = context.db
      .prepare(
        `
          SELECT
            ${WORKSPACE_USER_SELECT_COLUMNS}
          FROM WorkspaceUsers
          ORDER BY
            Archived ASC,
            DisplayName COLLATE NOCASE ASC,
            Username COLLATE NOCASE ASC
        `
      )
      .all() as WorkspaceUserRow[];

    return rows
      .map((row) => this.mapRow(row, roleSettings))
      .sort((left, right) => {
        if (left.archived !== right.archived) {
          return left.archived ? 1 : -1;
        }

        const leftOrder = roleSortOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = roleSortOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        const displayNameCompare = left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: 'base'
        });
        if (displayNameCompare !== 0) {
          return displayNameCompare;
        }

        return left.username.localeCompare(right.username, undefined, {
          sensitivity: 'base'
        });
      });
  }

  listSignInUsers(rootPath: string): WorkspaceUser[] {
    return this.list(rootPath).filter((user) => user.signInEnabled && !user.archived);
  }

  canRecoverAccess(rootPath: string): boolean {
    const context = this.workspaceManager.getContext(rootPath);
    return this.countActiveUsers(context.db) === 0;
  }

  createInitialAdmin(db: Database.Database, input: WorkspaceInitialAdminInput): WorkspaceUser {
    return this.insertUser(db, {
      username: input.username,
      displayName: input.displayName,
      role: 'admin',
      password: input.password,
      signInEnabled: true
    });
  }

  ensureImportedUser(db: Database.Database, displayName: string): WorkspaceUser {
    const normalizedDisplayName = this.normalizeAndValidateDisplayName(displayName);
    const existing = db
      .prepare(
        `
          SELECT
            ${WORKSPACE_USER_SELECT_COLUMNS}
          FROM WorkspaceUsers
          WHERE DisplayName = @displayName COLLATE NOCASE
        `
      )
      .get({ displayName: normalizedDisplayName }) as WorkspaceUserRow | undefined;

    if (existing) {
      return this.mapRow(existing, this.workspaceRoleService.getRoleSettingsForDb(db));
    }

    const timestamp = nowIso();
    const baseUsername = normalizeUsername(normalizedDisplayName) || 'user';
    let username = baseUsername;
    let suffix = 2;
    while (
      db
        .prepare('SELECT Id FROM WorkspaceUsers WHERE Username = @username')
        .get({ username }) as { Id: number } | undefined
    ) {
      username = `${baseUsername}.${suffix}`;
      suffix += 1;
    }

    const result = db
      .prepare(
        `
          INSERT INTO WorkspaceUsers (
            Username,
            DisplayName,
            Role,
            SignInEnabled,
            PasswordSalt,
            PasswordHash,
            LastSignedInDate,
            CreatedDate,
            ModifiedDate
          ) VALUES (?, ?, 'viewer', 0, NULL, NULL, NULL, ?, ?)
        `
      )
      .run(username, normalizedDisplayName, timestamp, timestamp);

    return this.getUserById(db, Number(result.lastInsertRowid));
  }

  create(rootPath: string, input: WorkspaceUserCreateInput): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    return this.insertUser(context.db, {
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      password: input.password,
      signInEnabled: input.signInEnabled ?? true
    });
  }

  update(rootPath: string, userId: number, input: WorkspaceUserUpdateInput): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const existing = this.getUserRowById(context.db, userId);
    const username = this.normalizeAndValidateUsername(input.username);
    const displayName = this.normalizeAndValidateDisplayName(input.displayName);
    const modifiedDate = nowIso();
    this.assertUserIsNotArchived(existing, 'Archived users cannot be edited.');

    this.ensureUsernameIsAvailable(context.db, username, userId);
    this.ensureDisplayNameIsAvailable(context.db, displayName, userId);
    this.ensureRoleExists(context.db, input.role);

    context.db
      .prepare(
        `
          UPDATE WorkspaceUsers
          SET Username = ?, DisplayName = ?, Role = ?, ModifiedDate = ?
          WHERE Id = ?
        `
      )
      .run(username, displayName, input.role, modifiedDate, userId);

    this.syncReferencedDisplayName(context.db, userId, displayName, existing.DisplayName);
    return this.getUser(rootPath, userId);
  }

  activate(rootPath: string, userId: number): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const user = this.getUserRowById(context.db, userId);
    this.assertUserIsNotArchived(user, 'Archived users cannot be activated.');
    if (!user.PasswordSalt || !user.PasswordHash) {
      throw new Error('Set a password before activating this user.');
    }

    context.db
      .prepare('UPDATE WorkspaceUsers SET SignInEnabled = 1, ModifiedDate = ? WHERE Id = ?')
      .run(nowIso(), userId);
    return this.getUser(rootPath, userId);
  }

  deactivate(rootPath: string, userId: number): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const user = this.getUserRowById(context.db, userId);
    this.assertUserIsNotArchived(user, 'Archived users cannot be updated.');

    if (Boolean(user.SignInEnabled) && this.countActiveUsers(context.db) <= 1) {
      throw new Error('At least one active workspace user must remain.');
    }

    context.db
      .prepare('UPDATE WorkspaceUsers SET SignInEnabled = 0, ModifiedDate = ? WHERE Id = ?')
      .run(nowIso(), userId);
    return this.getUser(rootPath, userId);
  }

  recoverAccess(rootPath: string, input: WorkspaceAccessRecoveryInput): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    if (this.countActiveUsers(context.db) > 0) {
      throw new Error('Recovery is only available when no active workspace users remain.');
    }

    return this.insertUser(context.db, {
      username: input.username,
      displayName: input.displayName,
      role: 'admin',
      password: input.password,
      signInEnabled: true
    });
  }

  remove(rootPath: string, userId: number): WorkspaceUserRemovalResult {
    const context = this.workspaceManager.getContext(rootPath);
    const user = this.getUserRowById(context.db, userId);
    this.assertUserIsNotArchived(user, 'Archived users cannot be deleted.');

    if (Boolean(user.SignInEnabled) && this.countActiveUsers(context.db) <= 1) {
      throw new Error('At least one active workspace user must remain.');
    }

    if (user.LinkedRecordCount > 0) {
      context.db
        .prepare('UPDATE WorkspaceUsers SET Archived = 1, SignInEnabled = 0, ModifiedDate = ? WHERE Id = ?')
        .run(nowIso(), userId);
      return {
        action: 'archived',
        userId,
        user: this.getUser(rootPath, userId)
      };
    }

    context.db.prepare('DELETE FROM WorkspaceUsers WHERE Id = ?').run(userId);
    return {
      action: 'deleted',
      userId
    };
  }

  unarchive(rootPath: string, userId: number): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const user = this.getUserRowById(context.db, userId);
    if (!Boolean(user.Archived)) {
      throw new Error('This user is not archived.');
    }

    context.db
      .prepare('UPDATE WorkspaceUsers SET Archived = 0, ModifiedDate = ? WHERE Id = ?')
      .run(nowIso(), userId);
    return this.getUser(rootPath, userId);
  }

  resetPassword(rootPath: string, userId: number, password: string): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const user = this.getUserRowById(context.db, userId);
    this.assertUserIsNotArchived(user, 'Archived users cannot be updated.');
    const normalizedPassword = ensurePassword(password);
    const hashed = hashPassword(normalizedPassword);

    context.db
      .prepare(
        `
          UPDATE WorkspaceUsers
          SET PasswordSalt = ?, PasswordHash = ?, ModifiedDate = ?
          WHERE Id = ?
        `
      )
      .run(hashed.salt, hashed.hash, nowIso(), userId);
    return this.getUser(rootPath, userId);
  }

  signIn(rootPath: string, username: string, password: string): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    const normalizedUsername = this.normalizeAndValidateUsername(username);
    const user = context.db
      .prepare(
        `
          SELECT
            ${WORKSPACE_USER_SELECT_COLUMNS}
          FROM WorkspaceUsers
          WHERE Username = @username
        `
      )
      .get({ username: normalizedUsername }) as WorkspaceUserRow | undefined;

    if (!user || !user.PasswordSalt || !user.PasswordHash) {
      throw new Error('Incorrect username or password.');
    }

    if (Boolean(user.Archived)) {
      throw new Error('This user has been archived.');
    }

    if (!Boolean(user.SignInEnabled)) {
      throw new Error('This user is currently inactive.');
    }

    if (!verifyPassword(ensurePassword(password), user.PasswordSalt, user.PasswordHash)) {
      throw new Error('Incorrect username or password.');
    }

    const signedInDate = nowIso();
    context.db
      .prepare('UPDATE WorkspaceUsers SET LastSignedInDate = ?, ModifiedDate = ? WHERE Id = ?')
      .run(signedInDate, signedInDate, user.Id);
    return this.getUser(rootPath, user.Id);
  }

  getUser(rootPath: string, userId: number): WorkspaceUser {
    const context = this.workspaceManager.getContext(rootPath);
    return this.mapRow(this.getUserRowById(context.db, userId), this.workspaceRoleService.list(rootPath));
  }

  getUserById(db: Database.Database, userId: number, errorMessage = 'The selected user could not be found.'): WorkspaceUser {
    const row = this.getUserRowById(db, userId, errorMessage);
    return this.mapRow(row, this.workspaceRoleService.getRoleSettingsForDb(db));
  }

  requireUserById(
    db: Database.Database,
    userId: number | null | undefined,
    errorMessage = 'The selected user could not be found.'
  ): WorkspaceUser {
    if (typeof userId !== 'number' || userId <= 0) {
      throw new Error(errorMessage);
    }

    return this.getUserById(db, userId, errorMessage);
  }

  optionalUserById(
    db: Database.Database,
    userId: number | null | undefined,
    errorMessage = 'The selected user could not be found.'
  ): WorkspaceUser | null {
    if (userId === null || userId === undefined) {
      return null;
    }

    return this.requireUserById(db, userId, errorMessage);
  }

  private insertUser(
    db: Database.Database,
    input: {
      username: string;
      displayName: string;
      role: WorkspaceRole;
      password: string;
      signInEnabled: boolean;
    }
  ): WorkspaceUser {
    const username = this.normalizeAndValidateUsername(input.username);
    const displayName = this.normalizeAndValidateDisplayName(input.displayName);
    const normalizedPassword = ensurePassword(input.password);
    const hashed = hashPassword(normalizedPassword);
    const timestamp = nowIso();

    this.ensureUsernameIsAvailable(db, username);
    this.ensureDisplayNameIsAvailable(db, displayName);
    this.ensureRoleExists(db, input.role);

    const result = db
      .prepare(
        `
          INSERT INTO WorkspaceUsers (
            Username,
            DisplayName,
            Role,
            SignInEnabled,
            PasswordSalt,
            PasswordHash,
            LastSignedInDate,
            CreatedDate,
            ModifiedDate
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
        `
      )
      .run(
        username,
        displayName,
        input.role,
        input.signInEnabled ? 1 : 0,
        hashed.salt,
        hashed.hash,
        timestamp,
        timestamp
      );

    return this.getUserById(db, Number(result.lastInsertRowid));
  }

  private syncReferencedDisplayName(
    db: Database.Database,
    userId: number,
    displayName: string,
    previousDisplayName: string
  ): void {
    if (displayName === previousDisplayName) {
      return;
    }

    db.prepare(
      `
        UPDATE Documents
        SET Author = ?
        WHERE AuthorUserId = ?
      `
    ).run(displayName, userId);
    db.prepare(
      `
        UPDATE DocumentVersions
        SET ReviewedBy = ?
        WHERE ReviewedByUserId = ?
      `
    ).run(displayName, userId);
    db.prepare(
      `
        UPDATE DocumentVersions
        SET ApprovedBy = ?
        WHERE ApprovedByUserId = ?
      `
    ).run(displayName, userId);
  }

  private getUserRowById(
    db: Database.Database,
    userId: number,
    errorMessage = 'The selected user could not be found.'
  ): WorkspaceUserRow {
    const row = db
      .prepare(
        `
          SELECT
            ${WORKSPACE_USER_SELECT_COLUMNS}
          FROM WorkspaceUsers
          WHERE Id = @userId
        `
      )
      .get({ userId }) as WorkspaceUserRow | undefined;

    if (!row) {
      throw new Error(errorMessage);
    }

    return row;
  }

  private mapRow(row: WorkspaceUserRow, roleSettings: WorkspaceRoleSettings): WorkspaceUser {
    return {
      id: row.Id,
      username: row.Username,
      displayName: row.DisplayName,
      role: row.Role,
      roleName: getWorkspaceRoleName(roleSettings, row.Role),
      signInEnabled: Boolean(row.SignInEnabled),
      archived: Boolean(row.Archived),
      linkedRecordCount: row.LinkedRecordCount,
      lastSignedInDate: row.LastSignedInDate,
      createdDate: row.CreatedDate,
      modifiedDate: row.ModifiedDate
    };
  }

  private ensureRoleExists(db: Database.Database, role: WorkspaceRole): void {
    const roleExists = this.workspaceRoleService
      .getRoleSettingsForDb(db)
      .roles.some((candidate) => candidate.key === role);
    if (!roleExists) {
      throw new Error('Select a valid workspace role.');
    }
  }

  private normalizeAndValidateUsername(value: string): string {
    const username = normalizeUsername(value);
    if (username.length < 2) {
      throw new Error('Username must contain at least 2 letters or numbers.');
    }

    return username;
  }

  private normalizeAndValidateDisplayName(value: string): string {
    const displayName = value.trim();
    if (displayName.length === 0) {
      throw new Error('Display name is required.');
    }

    return displayName;
  }

  private assertUserIsNotArchived(row: Pick<WorkspaceUserRow, 'Archived'>, errorMessage: string): void {
    if (Boolean(row.Archived)) {
      throw new Error(errorMessage);
    }
  }

  private ensureUsernameIsAvailable(
    db: Database.Database,
    username: string,
    currentUserId?: number
  ): void {
    const existing = db
      .prepare('SELECT Id FROM WorkspaceUsers WHERE Username = @username')
      .get({ username }) as { Id: number } | undefined;

    if (existing && existing.Id !== currentUserId) {
      throw new Error(`A workspace user with the username "${username}" already exists.`);
    }
  }

  private ensureDisplayNameIsAvailable(
    db: Database.Database,
    displayName: string,
    currentUserId?: number
  ): void {
    const existing = db
      .prepare('SELECT Id FROM WorkspaceUsers WHERE DisplayName = @displayName COLLATE NOCASE')
      .get({ displayName }) as { Id: number } | undefined;

    if (existing && existing.Id !== currentUserId) {
      throw new Error(`A workspace user with the display name "${displayName}" already exists.`);
    }
  }

  private countActiveUsers(db: Database.Database): number {
    return (
      (
        db
          .prepare('SELECT COUNT(*) AS total FROM WorkspaceUsers WHERE SignInEnabled = 1 AND Archived = 0')
          .get() as { total: number } | undefined
      )?.total ?? 0
    );
  }
}
