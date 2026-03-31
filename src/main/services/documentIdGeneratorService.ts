import type Database from 'better-sqlite3';
import { resolveDocumentIdFormatTemplate, type WorkspaceSettings } from '@shared/workspaceLayout';

interface DocumentIdGenerationContext {
  numberPrefix: string;
  documentTypeName: string;
  createdDate: string | Date;
  title: string;
  author: string;
  languageCode?: string | null;
  company?: string | null;
  department?: string | null;
  projectName?: string | null;
}

interface ParsedTemplate {
  renderedPrefix: string;
  renderedSuffix: string;
  sequenceWidth: number;
}

const PLACEHOLDER_PATTERN = /<([^>]+)>/gi;
const SEQUENCE_TOKEN_NAME = 'sequence';
const MAX_SEQUENCE_WIDTH = 12;

export class DocumentIdGeneratorService {
  assertNumberPrefix(numberPrefix: string): string {
    if (!/^\d{2}$/.test(numberPrefix)) {
      throw new Error('Document type number prefix must be exactly 2 digits.');
    }

    return numberPrefix;
  }

  generateNextDocumentId(
    db: Database.Database,
    settings: Pick<WorkspaceSettings, 'documentIdFormatPreset' | 'documentIdFormatTemplate'>,
    context: DocumentIdGenerationContext
  ): string {
    const template = resolveDocumentIdFormatTemplate(settings);
    const parsedTemplate = this.parseTemplate(template, context);
    const existingIds = this.listExistingDocumentIds(db);
    const sequencePattern = new RegExp(
      `^${this.escapeRegex(parsedTemplate.renderedPrefix)}(\\d{${parsedTemplate.sequenceWidth},})${this.escapeRegex(parsedTemplate.renderedSuffix)}$`
    );

    const nextSequence =
      existingIds.reduce((maxSequence, existingId) => {
        const match = existingId.match(sequencePattern);
        if (!match) {
          return maxSequence;
        }

        return Math.max(maxSequence, Number(match[1]));
      }, 0) + 1;

    return `${parsedTemplate.renderedPrefix}${String(nextSequence).padStart(parsedTemplate.sequenceWidth, '0')}${parsedTemplate.renderedSuffix}`;
  }

  validateTemplate(template: string): void {
    this.parseTemplate(template, {
      numberPrefix: '02',
      documentTypeName: 'Procedure',
      createdDate: '2026-03-31T09:00:00.000Z',
      title: 'Operating Procedure',
      author: 'Jordan Singh',
      languageCode: 'EN',
      company: 'Acme Manufacturing',
      department: 'Quality Assurance',
      projectName: 'QMS Rollout'
    });
  }

  private parseTemplate(template: string, context: DocumentIdGenerationContext): ParsedTemplate {
    const trimmedTemplate = template.trim();
    if (!trimmedTemplate) {
      throw new Error('Document ID format cannot be empty.');
    }

    let renderedPrefix = '';
    let renderedSuffix = '';
    let sequenceWidth: number | null = null;
    let lastMatchIndex = 0;

    for (const match of trimmedTemplate.matchAll(PLACEHOLDER_PATTERN)) {
      const fullMatch = match[0];
      const tokenContent = match[1];
      const matchIndex = match.index ?? 0;
      const literal = trimmedTemplate.slice(lastMatchIndex, matchIndex);

      if (sequenceWidth === null) {
        renderedPrefix += literal;
      } else {
        renderedSuffix += literal;
      }

      const placeholder = this.parsePlaceholder(tokenContent, context);

      if (placeholder.type === 'sequence') {
        if (sequenceWidth !== null) {
          throw new Error('Document ID format can only contain one <sequence> placeholder.');
        }

        sequenceWidth = placeholder.width;
      } else if (sequenceWidth === null) {
        renderedPrefix += placeholder.value;
      } else {
        renderedSuffix += placeholder.value;
      }

      lastMatchIndex = matchIndex + fullMatch.length;
    }

    const trailingLiteral = trimmedTemplate.slice(lastMatchIndex);
    if (sequenceWidth === null) {
      renderedPrefix += trailingLiteral;
      throw new Error('Document ID format must include a <sequence> placeholder.');
    }

    renderedSuffix += trailingLiteral;

    return {
      renderedPrefix,
      renderedSuffix,
      sequenceWidth
    };
  }

  private parsePlaceholder(
    tokenContent: string,
    context: DocumentIdGenerationContext
  ): { type: 'sequence'; width: number } | { type: 'value'; value: string } {
    const [rawName, rawArgument] = tokenContent.split(':', 2);
    const tokenName = rawName.trim().toLowerCase();

    if (tokenName === SEQUENCE_TOKEN_NAME) {
      const width = this.parseSequenceWidth(rawArgument);
      return {
        type: 'sequence',
        width
      };
    }

    return {
      type: 'value',
      value: this.resolvePlaceholderValue(tokenName, context)
    };
  }

  private resolvePlaceholderValue(tokenName: string, context: DocumentIdGenerationContext): string {
    const timestamp = typeof context.createdDate === 'string' ? new Date(context.createdDate) : context.createdDate;
    const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getUTCDate()).padStart(2, '0');
    const year = String(timestamp.getUTCFullYear());

    switch (tokenName) {
      case 'doctypeprefix':
      case 'documenttypeprefix':
      case 'prefix':
        return this.assertNumberPrefix(context.numberPrefix);
      case 'doctype':
      case 'documenttype':
        return this.normalizeSegment(context.documentTypeName, 'DOCUMENT');
      case 'year':
        return year;
      case 'year2':
        return year.slice(-2);
      case 'month':
        return month;
      case 'day':
        return day;
      case 'author':
        return this.normalizeSegment(context.author, 'UNKNOWN');
      case 'language':
      case 'languagecode':
        return this.normalizeSegment(context.languageCode ?? '', 'XX');
      case 'company':
        return this.normalizeSegment(context.company ?? '', 'NA');
      case 'department':
        return this.normalizeSegment(context.department ?? '', 'NA');
      case 'project':
      case 'projectname':
        return this.normalizeSegment(context.projectName ?? '', 'NA');
      case 'title':
        return this.normalizeSegment(context.title, 'UNTITLED');
      default:
        throw new Error(
          `Unsupported document ID placeholder <${tokenName}>.`
        );
    }
  }

  private parseSequenceWidth(rawArgument?: string): number {
    if (rawArgument === undefined || rawArgument.trim().length === 0) {
      return 5;
    }

    const width = Number(rawArgument.trim());
    if (!Number.isInteger(width) || width < 1 || width > MAX_SEQUENCE_WIDTH) {
      throw new Error('The <sequence> placeholder width must be a whole number between 1 and 12.');
    }

    return width;
  }

  private normalizeSegment(value: string, fallback: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();

    return normalized || fallback;
  }

  private listExistingDocumentIds(db: Database.Database): string[] {
    const documentRows = db.prepare('SELECT DocumentID FROM Documents').all() as Array<{
      DocumentID: string;
    }>;
    const versionRows = this.hasVersionDocumentIds(db)
      ? (db
          .prepare(
            `
              SELECT VersionDocumentID
              FROM DocumentVersions
              WHERE VersionDocumentID IS NOT NULL
                AND trim(VersionDocumentID) != ''
            `
          )
          .all() as Array<{ VersionDocumentID: string }>)
      : [];

    return [
      ...documentRows.map((row) => row.DocumentID),
      ...versionRows.map((row) => row.VersionDocumentID)
    ];
  }

  private hasVersionDocumentIds(db: Database.Database): boolean {
    const table = db
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table' AND name = 'DocumentVersions'
        `
      )
      .get() as { name: string } | undefined;

    if (!table) {
      return false;
    }

    const columns = db.prepare("PRAGMA table_info('DocumentVersions')").all() as Array<{
      name: string;
    }>;

    return columns.some((column) => column.name === 'VersionDocumentID');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
