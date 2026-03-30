import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { DocumentIdGeneratorService } from '@main/services/documentIdGeneratorService';

describe('DocumentIdGeneratorService', () => {
  it('generates the first sequence for a new type and year', () => {
    const db = new Database(':memory:');
    db.exec(
      `
        CREATE TABLE Documents (
          DocumentID TEXT NOT NULL
        );
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, '01', '2026-03-26T10:00:00.000Z')).toBe('01202600001');
  });

  it('increments the sequence within the same type and year', () => {
    const db = new Database(':memory:');
    db.exec(
      `
        CREATE TABLE Documents (
          DocumentID TEXT NOT NULL
        );
        INSERT INTO Documents (DocumentID) VALUES ('01202600001');
        INSERT INTO Documents (DocumentID) VALUES ('01202600002');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, '01', '2026-04-01T08:00:00.000Z')).toBe('01202600003');
  });

  it('considers version-specific document IDs when finding the next sequence', () => {
    const db = new Database(':memory:');
    db.exec(
      `
        CREATE TABLE Documents (
          DocumentID TEXT NOT NULL
        );
        CREATE TABLE DocumentVersions (
          VersionDocumentID TEXT
        );
        INSERT INTO Documents (DocumentID) VALUES ('01202600001');
        INSERT INTO DocumentVersions (VersionDocumentID) VALUES ('01202600003');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, '01', '2026-04-01T08:00:00.000Z')).toBe('01202600004');
  });

  it('resets the sequence for a new year', () => {
    const db = new Database(':memory:');
    db.exec(
      `
        CREATE TABLE Documents (
          DocumentID TEXT NOT NULL
        );
        INSERT INTO Documents (DocumentID) VALUES ('01202600009');
      `
    );

    const service = new DocumentIdGeneratorService();
    expect(service.generateNextDocumentId(db, '01', '2027-01-01T00:00:00.000Z')).toBe('01202700001');
  });

  it('rejects invalid number prefixes', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE Documents (DocumentID TEXT NOT NULL);');
    const service = new DocumentIdGeneratorService();

    expect(() => service.generateNextDocumentId(db, 'A1', '2026-03-26T10:00:00.000Z')).toThrow(
      'Document type number prefix must be exactly 2 digits.'
    );
  });
});
