import type Database from 'better-sqlite3';
import initialMigration from '../../../migrations/001_initial.sql?raw';
import { nowIso } from '@main/utils/date';

const MIGRATIONS = [
  {
    id: '001_initial',
    sql: initialMigration
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

export const hasWorkspaceSignature = (db: Database.Database): boolean => {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Workspaces', '__Migrations')"
    )
    .all() as Array<{ name: string }>;
  const tableNames = rows.map((row) => row.name);

  return tableNames.includes('Workspaces') || tableNames.includes('__Migrations');
};
