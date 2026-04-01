import type Database from 'better-sqlite3';
import initialMigration from '../../../migrations/001_initial.sql?raw';
import workspaceLayoutMigration from '../../../migrations/002_workspace_layout.sql?raw';
import documentMetadataMigration from '../../../migrations/003_document_metadata.sql?raw';
import versionManagementMigration from '../../../migrations/004_version_management.sql?raw';
import documentIdFormatMigration from '../../../migrations/005_document_id_format.sql?raw';
import workspaceBrandingMigration from '../../../migrations/006_workspace_branding.sql?raw';
import activityLogMigration from '../../../migrations/007_activity_log.sql?raw';
import { nowIso } from '@main/utils/date';

const MIGRATIONS = [
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

    db.exec(migration.sql);
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
