import type Database from 'better-sqlite3';
import type { RecentActivityItem } from '@shared/types';
import { nowIso } from '@main/utils/date';

export interface ActivityLogInput {
  eventType: string;
  message: string;
  documentRecordId?: number | null;
  documentVersionId?: number | null;
}

export class ActivityLogService {
  log(db: Database.Database, input: ActivityLogInput): void {
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
  }

  listRecent(db: Database.Database, limit = 12): RecentActivityItem[] {
    const rows = db
      .prepare(
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
          LIMIT @limit
        `
      )
      .all({ limit }) as Array<{
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
}
