import type Database from 'better-sqlite3';
import initialMigration from '../../../migrations/001_initial.sql?raw';
import workspaceLayoutMigration from '../../../migrations/002_workspace_layout.sql?raw';
import documentMetadataMigration from '../../../migrations/003_document_metadata.sql?raw';
import versionManagementMigration from '../../../migrations/004_version_management.sql?raw';
import documentIdFormatMigration from '../../../migrations/005_document_id_format.sql?raw';
import workspaceBrandingMigration from '../../../migrations/006_workspace_branding.sql?raw';
import activityLogMigration from '../../../migrations/007_activity_log.sql?raw';
import documentReviewMetadataMigration from '../../../migrations/008_document_review_metadata.sql?raw';
import workspaceRootDirectoriesMigration from '../../../migrations/009_workspace_root_directories.sql?raw';
import activityLogSettingsMigration from '../../../migrations/010_activity_log_settings.sql?raw';
import alphaVersionSchemeMigration from '../../../migrations/011_alpha_version_scheme.sql?raw';
import savedViewsAndDashboardMigration from '../../../migrations/012_saved_views_and_dashboard.sql?raw';
import workspaceLifecycleMigration from '../../../migrations/013_workspace_lifecycle.sql?raw';
import { nowIso } from '@main/utils/date';

interface Migration {
  id: string;
  sql?: string;
  run?: (db: Database.Database) => void;
}

const columnExists = (db: Database.Database, tableName: string, columnName: string): boolean => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
};

const normalizeImportedUsernameBase = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  return normalized.length > 0 ? normalized : 'user';
};

const getUniqueImportedUsername = (baseName: string, usedUsernames: Set<string>): string => {
  let nextUsername = normalizeImportedUsernameBase(baseName);
  let suffix = 2;
  while (usedUsernames.has(nextUsername)) {
    nextUsername = `${normalizeImportedUsernameBase(baseName)}.${suffix}`;
    suffix += 1;
  }

  usedUsernames.add(nextUsername);
  return nextUsername;
};

const migrateWorkspaceUsers = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS WorkspaceUsers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Username TEXT NOT NULL UNIQUE,
      DisplayName TEXT NOT NULL,
      Role TEXT NOT NULL CHECK (Role IN ('admin', 'editor', 'viewer')),
      SignInEnabled INTEGER NOT NULL DEFAULT 0 CHECK (SignInEnabled IN (0, 1)),
      Archived INTEGER NOT NULL DEFAULT 0 CHECK (Archived IN (0, 1)),
      PasswordSalt TEXT,
      PasswordHash TEXT,
      LastSignedInDate TEXT,
      CreatedDate TEXT NOT NULL,
      ModifiedDate TEXT NOT NULL
    );
  `);

  if (!columnExists(db, 'ActivityLog', 'ActorUserId')) {
    db.exec('ALTER TABLE ActivityLog ADD COLUMN ActorUserId INTEGER REFERENCES WorkspaceUsers (Id) ON DELETE SET NULL;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_actor_user_id ON ActivityLog (ActorUserId);');
  }

  if (!columnExists(db, 'Documents', 'AuthorUserId')) {
    db.exec('ALTER TABLE Documents ADD COLUMN AuthorUserId INTEGER REFERENCES WorkspaceUsers (Id) ON DELETE SET NULL;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_documents_author_user_id ON Documents (AuthorUserId);');
  }

  if (!columnExists(db, 'DocumentVersions', 'ReviewedByUserId')) {
    db.exec(
      'ALTER TABLE DocumentVersions ADD COLUMN ReviewedByUserId INTEGER REFERENCES WorkspaceUsers (Id) ON DELETE SET NULL;'
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_document_versions_reviewed_by_user_id ON DocumentVersions (ReviewedByUserId);');
  }

  if (!columnExists(db, 'DocumentVersions', 'ApprovedByUserId')) {
    db.exec(
      'ALTER TABLE DocumentVersions ADD COLUMN ApprovedByUserId INTEGER REFERENCES WorkspaceUsers (Id) ON DELETE SET NULL;'
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_document_versions_approved_by_user_id ON DocumentVersions (ApprovedByUserId);');
  }

  const existingUsers = db.prepare('SELECT Id, Username, DisplayName FROM WorkspaceUsers').all() as Array<{
    Id: number;
    Username: string;
    DisplayName: string;
  }>;
  const userIdByDisplayName = new Map(existingUsers.map((row) => [row.DisplayName, row.Id]));
  const usedUsernames = new Set(existingUsers.map((row) => row.Username));
  const now = nowIso();
  const insertUser = db.prepare(
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
  );

  const distinctNames = new Set<string>();
  const nameRows = db
    .prepare(
      `
        SELECT Author AS Name FROM Documents
        UNION
        SELECT ReviewedBy AS Name FROM DocumentVersions
        UNION
        SELECT ApprovedBy AS Name FROM DocumentVersions
      `
    )
    .all() as Array<{ Name: string | null }>;
  for (const row of nameRows) {
    const name = row.Name?.trim();
    if (name) {
      distinctNames.add(name);
    }
  }

  for (const displayName of [...distinctNames].sort((left, right) => left.localeCompare(right))) {
    if (userIdByDisplayName.has(displayName)) {
      continue;
    }

    const username = getUniqueImportedUsername(displayName, usedUsernames);
    const result = insertUser.run(username, displayName, now, now);
    userIdByDisplayName.set(displayName, Number(result.lastInsertRowid));
  }

  const updateDocumentAuthor = db.prepare(
    'UPDATE Documents SET AuthorUserId = ? WHERE Id = ? AND (AuthorUserId IS NULL OR AuthorUserId <= 0)'
  );
  const documentRows = db.prepare('SELECT Id, Author FROM Documents').all() as Array<{
    Id: number;
    Author: string | null;
  }>;
  for (const row of documentRows) {
    const displayName = row.Author?.trim();
    if (!displayName) {
      continue;
    }

    const userId = userIdByDisplayName.get(displayName);
    if (userId) {
      updateDocumentAuthor.run(userId, row.Id);
    }
  }

  const updateVersionUsers = db.prepare(
    `
      UPDATE DocumentVersions
      SET ReviewedByUserId = COALESCE(?, ReviewedByUserId), ApprovedByUserId = COALESCE(?, ApprovedByUserId)
      WHERE Id = ?
    `
  );
  const versionRows = db
    .prepare('SELECT Id, ReviewedBy, ApprovedBy FROM DocumentVersions')
    .all() as Array<{ Id: number; ReviewedBy: string | null; ApprovedBy: string | null }>;
  for (const row of versionRows) {
    const reviewedByUserId = row.ReviewedBy?.trim()
      ? userIdByDisplayName.get(row.ReviewedBy.trim()) ?? null
      : null;
    const approvedByUserId = row.ApprovedBy?.trim()
      ? userIdByDisplayName.get(row.ApprovedBy.trim()) ?? null
      : null;
    updateVersionUsers.run(reviewedByUserId, approvedByUserId, row.Id);
  }
};

const migrateWorkspaceUserSystemSetting = (db: Database.Database): void => {
  if (!columnExists(db, 'Workspaces', 'UserSystemEnabled')) {
    db.exec(
      'ALTER TABLE Workspaces ADD COLUMN UserSystemEnabled INTEGER NOT NULL DEFAULT 1 CHECK (UserSystemEnabled IN (0, 1));'
    );
  }
};

const migrateWorkspaceUserArchiveState = (db: Database.Database): void => {
  if (!columnExists(db, 'WorkspaceUsers', 'Archived')) {
    db.exec(
      'ALTER TABLE WorkspaceUsers ADD COLUMN Archived INTEGER NOT NULL DEFAULT 0 CHECK (Archived IN (0, 1));'
    );
  }
};

const MIGRATIONS: readonly Migration[] = [
  {
    id: '001_initial',
    sql: initialMigration
  },
  {
    id: '002_workspace_layout',
    sql: workspaceLayoutMigration
  },
  {
    id: '003_document_metadata',
    sql: documentMetadataMigration
  },
  {
    id: '004_version_management',
    sql: versionManagementMigration
  },
  {
    id: '005_document_id_format',
    sql: documentIdFormatMigration
  },
  {
    id: '006_workspace_branding',
    sql: workspaceBrandingMigration
  },
  {
    id: '007_activity_log',
    sql: activityLogMigration
  },
  {
    id: '008_document_review_metadata',
    sql: documentReviewMetadataMigration
  },
  {
    id: '009_workspace_root_directories',
    sql: workspaceRootDirectoriesMigration
  },
  {
    id: '010_activity_log_settings',
    sql: activityLogSettingsMigration
  },
  {
    id: '011_alpha_version_scheme',
    sql: alphaVersionSchemeMigration
  },
  {
    id: '012_saved_views_and_dashboard',
    sql: savedViewsAndDashboardMigration
  },
  {
    id: '013_workspace_lifecycle',
    sql: workspaceLifecycleMigration
  },
  {
    id: '014_workspace_users',
    run: migrateWorkspaceUsers
  },
  {
    id: '015_workspace_user_system_setting',
    run: migrateWorkspaceUserSystemSetting
  },
  {
    id: '016_workspace_user_archive_state',
    run: migrateWorkspaceUserArchiveState
  }
] as const;

export const configureDatabaseConnection = (db: Database.Database): void => {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
};

export const applyMigrations = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __Migrations (
      Id TEXT PRIMARY KEY,
      AppliedDate TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT Id FROM __Migrations ORDER BY Id').all() as Array<{
    Id: string;
  }>;
  const appliedMigrationIds = new Set(appliedRows.map((row) => row.Id));
  const insertMigration = db.prepare('INSERT INTO __Migrations (Id, AppliedDate) VALUES (?, ?)');

  for (const migration of MIGRATIONS) {
    if (appliedMigrationIds.has(migration.id)) {
      continue;
    }

    if (migration.run) {
      migration.run(db);
    } else if (migration.sql) {
      db.exec(migration.sql);
    } else {
      throw new Error(`Migration ${migration.id} is missing an implementation.`);
    }
    insertMigration.run(migration.id, nowIso());
  }
};

export const getPendingMigrationIds = (db: Database.Database): string[] => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __Migrations (
      Id TEXT PRIMARY KEY,
      AppliedDate TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT Id FROM __Migrations ORDER BY Id').all() as Array<{
    Id: string;
  }>;
  const appliedMigrationIds = new Set(appliedRows.map((row) => row.Id));

  return MIGRATIONS.filter((migration) => !appliedMigrationIds.has(migration.id)).map(
    (migration) => migration.id
  );
};

export const hasWorkspaceSignature = (db: Database.Database): boolean => {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Workspaces', '__Migrations')"
    )
    .all() as Array<{ name: string }>;
  const tableNames = rows.map((row) => row.name);

  return tableNames.includes('Workspaces') || tableNames.includes('__Migrations');
};
