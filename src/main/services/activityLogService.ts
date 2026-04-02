import type Database from 'better-sqlite3';
import type { RecentActivityItem } from '@shared/types';
import { nowIso } from '@main/utils/date';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  normalizeWorkspaceActivityLogMaxRows
} from '@shared/workspaceLayout';

export interface ActivityLogInput {
  eventType: string;
  message: string;
  documentRecordId?: number | null;
  documentVersionId?: number | null;
}

export class ActivityLogService {
  log(db: Database.Database, input: ActivityLogInput): void {
    const settings = this.readSettings(db);
    if (!settings.enabled) {
      return;
    }

    db.prepare(
      `
        INSERT INTO ActivityLog (
          EventType,
          Message,
          DocumentRecordId,
          DocumentVersionId,
          CreatedDate
        ) VALUES (?, ?, ?, ?, ?)
      `
    ).run(
      input.eventType.trim(),
      input.message.trim(),
      input.documentRecordId ?? null,
      input.documentVersionId ?? null,
      nowIso()
    );

    this.prune(db, settings.maxRows);
  }

  listRecent(db: Database.Database, limit = 12): RecentActivityItem[] {
    return this.list(db, limit);
  }

  listAll(db: Database.Database): RecentActivityItem[] {
    return this.list(db);
  }

  prune(db: Database.Database, maxRows: number): void {
    db.prepare(
      `
        DELETE FROM ActivityLog
        WHERE Id IN (
          SELECT Id
          FROM ActivityLog
          ORDER BY CreatedDate DESC, Id DESC
          LIMIT -1 OFFSET @maxRows
        )
      `
    ).run({
      maxRows: normalizeWorkspaceActivityLogMaxRows(maxRows)
    });
  }

  private list(db: Database.Database, limit?: number): RecentActivityItem[] {
    const hasLimit = typeof limit === 'number';
    const statement = db.prepare(
      `
        SELECT
          Id,
          EventType,
          Message,
          CreatedDate,
          DocumentRecordId,
          DocumentVersionId
        FROM ActivityLog
        ORDER BY CreatedDate DESC, Id DESC
        ${hasLimit ? 'LIMIT @limit' : ''}
      `
    );
    const rows = (hasLimit ? statement.all({ limit }) : statement.all()) as Array<{
      Id: number;
      EventType: string;
      Message: string;
      CreatedDate: string;
      DocumentRecordId: number | null;
      DocumentVersionId: number | null;
    }>;

    return rows.map((row) => ({
      id: row.Id,
      eventType: row.EventType,
      message: row.Message,
      createdDate: row.CreatedDate,
      documentRecordId: row.DocumentRecordId,
      documentVersionId: row.DocumentVersionId
    }));
  }

  private readSettings(db: Database.Database): { enabled: boolean; maxRows: number } {
    const row = db
      .prepare(
        `
          SELECT ActivityLogEnabled, ActivityLogMaxRows
          FROM Workspaces
          WHERE Id = 1
        `
      )
      .get() as
      | {
          ActivityLogEnabled: number;
          ActivityLogMaxRows: number;
        }
      | undefined;

    return {
      enabled:
        typeof row?.ActivityLogEnabled === 'number'
          ? Boolean(row.ActivityLogEnabled)
          : DEFAULT_WORKSPACE_SETTINGS.activityLogEnabled,
      maxRows: normalizeWorkspaceActivityLogMaxRows(row?.ActivityLogMaxRows)
    };
  }
}
