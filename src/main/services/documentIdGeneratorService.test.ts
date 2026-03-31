import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';
import { DEFAULT_WORKSPACE_SETTINGS } from '@shared/workspaceLayout';

const createDatabase = (): Database.Database => {
  const db = new Database(':memory:');
  db.exec(
    `
      CREATE TABLE Documents (
        DocumentID TEXT NOT NULL
      );
    `
  );

  return db;
};

const baseContext = {
  numberPrefix: '01',
  documentTypeName: 'Procedure',
  createdDate: '2026-03-26T10:00:00.000Z',
  title: 'Operating Procedure',
  author: 'Jordan Singh',
  languageCode: 'EN',
  company: 'Acme Manufacturing',
  department: 'Quality Assurance',
  projectName: 'QMS Rollout'
};

describe('DocumentIdGeneratorService', () => {
  it('keeps the legacy numeric preset as the default format', () => {
    const db = createDatabase();
    const service = new DocumentIdGeneratorService();

    expect(service.generateNextDocumentId(db, DEFAULT_WORKSPACE_SETTINGS, baseContext)).toBe(
      '01202600001'
    );
  });

  it('increments the sequence within the same rendered prefix', () => {
    const db = createDatabase();
    db.exec(
      `
        INSERT INTO Documents (DocumentID) VALUES ('01202600001');
        INSERT INTO Documents (DocumentID) VALUES ('01202600002');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, DEFAULT_WORKSPACE_SETTINGS, baseContext)).toBe(
      '01202600003'
    );
  });

  it('supports readable preset formats with placeholder rendering', () => {
    const db = createDatabase();
    const service = new DocumentIdGeneratorService();

    expect(
      service.generateNextDocumentId(
        db,
        {
          documentIdFormatPreset: 'type-language-year-sequence',
          documentIdFormatTemplate: ''
        },
        baseContext
      )
    ).toBe('PROCEDURE-EN-2026-0001');
  });

  it('supports custom templates with case-insensitive placeholders', () => {
    const db = createDatabase();
    db.exec(
      `
        INSERT INTO Documents (DocumentID) VALUES ('JORDAN-SINGH-PROCEDURE-26-001');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(
      service.generateNextDocumentId(
        db,
        {
          documentIdFormatPreset: 'custom',
          documentIdFormatTemplate: '<Author>-<docType>-<year2>-<sequence:3>'
        },
        baseContext
      )
    ).toBe('JORDAN-SINGH-PROCEDURE-26-002');
  });

  it('scopes the sequence to the fully rendered non-sequence parts', () => {
    const db = createDatabase();
    db.exec(
      `
        INSERT INTO Documents (DocumentID) VALUES ('PROCEDURE-EN-2026-0001');
        INSERT INTO Documents (DocumentID) VALUES ('PROCEDURE-NL-2026-0004');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(
      service.generateNextDocumentId(
        db,
        {
          documentIdFormatPreset: 'type-language-year-sequence',
          documentIdFormatTemplate: ''
        },
        {
          ...baseContext,
          languageCode: 'NL'
        }
      )
    ).toBe('PROCEDURE-NL-2026-0005');
  });

  it('considers version-specific document IDs when finding the next sequence', () => {
    const db = createDatabase();
    db.exec(
      `
        CREATE TABLE DocumentVersions (
          VersionDocumentID TEXT
        );
        INSERT INTO Documents (DocumentID) VALUES ('01202600001');
        INSERT INTO DocumentVersions (VersionDocumentID) VALUES ('01202600003');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, DEFAULT_WORKSPACE_SETTINGS, baseContext)).toBe(
      '01202600004'
    );
  });

  it('rejects invalid number prefixes', () => {
    const db = createDatabase();
    const service = new DocumentIdGeneratorService();

    expect(() =>
      service.generateNextDocumentId(db, DEFAULT_WORKSPACE_SETTINGS, {
        ...baseContext,
        numberPrefix: 'A1'
      })
    ).toThrow('Document type number prefix must be exactly 2 digits.');
  });

  it('rejects templates without a sequence placeholder', () => {
    const service = new DocumentIdGeneratorService();

    expect(() => service.validateTemplate('<docType>-<year>')).toThrow(
      'Document ID format must include a <sequence> placeholder.'
    );
  });
});
