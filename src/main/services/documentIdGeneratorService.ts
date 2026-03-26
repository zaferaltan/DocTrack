import type Database from 'better-sqlite3';
import { getYearString } from '@main/utils/date';

export class DocumentIdGeneratorService {
  assertNumberPrefix(numberPrefix: string): string {
    if (!/^\d{2}$/.test(numberPrefix)) {
      throw new Error('Document type number prefix must be exactly 2 digits.');
    }

    return numberPrefix;
  }

  generateNextDocumentId(
    db: Database.Database,
    numberPrefix: string,
    createdDate: string | Date
  ): string {
    const prefix = this.assertNumberPrefix(numberPrefix);
    const year = getYearString(createdDate);

    const existing = db
      .prepare<{ prefix: string; year: string }, { maxSequence: number | null }>(
        `
          SELECT MAX(CAST(SUBSTR(DocumentID, 7, 5) AS INTEGER)) AS maxSequence
          FROM Documents
          WHERE SUBSTR(DocumentID, 1, 2) = @prefix
            AND SUBSTR(DocumentID, 3, 4) = @year
        `
      )
      .get({ prefix, year });

    const nextSequence = (existing?.maxSequence ?? 0) + 1;

    if (nextSequence > 99999) {
      throw new Error(`Document type ${prefix} has reached its yearly sequence limit for ${year}.`);
    }

    return `${prefix}${year}${String(nextSequence).padStart(5, '0')}`;
  }
}
