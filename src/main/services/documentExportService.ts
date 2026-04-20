import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, type PrintToPDFOptions, type SaveDialogReturnValue } from 'electron';
import { format } from 'date-fns';
import {
  createDefaultWorkspaceLifecycle,
  getWorkspaceStatusByName,
  type WorkspaceLifecycle
} from '@shared/documentLifecycle';
import type {
  DocumentExportFormat,
  DocumentExportGrouping,
  DocumentExportRequest,
  DocumentExportResult,
  DocumentListItem
} from '@shared/types';
import {
  DOCUMENT_TABLE_COLUMNS,
  getDocumentTableColumnLabel,
  type DocumentTableColumn
} from '@shared/workspaceLayout';

type SaveDialogOptions = Parameters<typeof dialog.showSaveDialog>[0];

interface PdfWindowLike {
  loadURL: (url: string) => Promise<void>;
  webContents: {
    printToPDF: (options: PrintToPDFOptions) => Promise<Buffer>;
  };
  destroy: () => void;
}

interface DocumentExportServiceDependencies {
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogReturnValue>;
  readFile: (filePath: string) => Promise<Buffer>;
  writeFile: (filePath: string, data: string | Uint8Array) => Promise<void>;
  createPdfWindow: () => PdfWindowLike;
}

const PDF_PRINT_OPTIONS: PrintToPDFOptions = {
  printBackground: true,
  preferCSSPageSize: true
};

const GROUPING_LABELS: Record<DocumentExportGrouping, string> = {
  none: 'No grouping',
  documentType: 'Document Type',
  status: 'Status',
  group: 'Group',
  project: 'Project',
  language: 'Language',
  confidentialityClass: 'Confidentiality Class',
  company: 'Company',
  department: 'Department',
  author: 'Author'
};

const EMPTY_GROUP_LABELS: Record<Exclude<DocumentExportGrouping, 'none'>, string> = {
  documentType: 'Uncategorized',
  status: 'Not started',
  group: 'No group',
  project: 'No project',
  language: 'No language',
  confidentialityClass: 'No classification',
  company: 'No company',
  department: 'No department',
  author: 'No author'
};

const PDF_CARD_FIELD_ORDER: DocumentTableColumn[] = [
  'documentId',
  'title',
  'documentType',
  'version',
  'status',
  'modifiedDate',
  'releasedDate',
  'author',
  'language',
  'confidentialityClass',
  'group',
  'project',
  'company',
  'department',
  'startDate',
  'createdDate',
  'approvedBy',
  'reviewedBy',
  'revisionIntervalMonths',
  'revisionDescription'
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateShort = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  const parsed = toDate(value);
  return parsed ? format(parsed, 'dd MMM yyyy') : value;
};

const formatDateTime = (value: string): string => {
  const parsed = toDate(value);
  return parsed ? format(parsed, 'dd MMM yyyy, HH:mm') : value;
};

const normalizeFileNameSegment = (value: string): string =>
  value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const buildDataUrl = (html: string): string =>
  `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

const resolveWorkspaceStoredPath = (rootPath: string, relativePath: string): string =>
  path.join(rootPath, ...relativePath.split('/'));

const getMimeTypeForLogoPath = (filePath: string): string => {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

const getStatusBadgeClassName = (
  status: DocumentListItem['status'],
  pdfColorMode: DocumentExportRequest['pdfColorMode'],
  lifecycle?: WorkspaceLifecycle
): string => {
  if (pdfColorMode === 'black-and-white') {
    return 'status-badge status-badge-bw';
  }

  const role =
    status && getWorkspaceStatusByName(lifecycle ?? createDefaultWorkspaceLifecycle(), status)?.role;

  switch (role) {
    case 'draft':
      return 'status-badge status-draft';
    case 'review':
      return 'status-badge status-review';
    case 'released':
      return 'status-badge status-released';
    case 'archived':
      return 'status-badge status-archived';
    case 'obsolete':
      return 'status-badge status-obsolete';
    default:
      return 'status-badge status-not-started';
  }
};

export const buildDefaultDocumentExportFileName = (
  workspaceName: string,
  formatName: DocumentExportFormat,
  exportTimestamp: string
): string => {
  const dateSegment = (exportTimestamp || new Date().toISOString()).slice(0, 10);
  const workspaceSegment = normalizeFileNameSegment(workspaceName) || 'workspace';
  return `${workspaceSegment}-documents-${dateSegment}.${formatName}`;
};

export const getDocumentExportGroupingLabel = (groupBy: DocumentExportGrouping): string =>
  GROUPING_LABELS[groupBy];

export const getDocumentExportCellValue = (
  document: DocumentListItem,
  column: DocumentTableColumn
): string => {
  switch (column) {
    case 'documentId':
      return document.documentId;
    case 'title':
      return document.title;
    case 'documentType':
      return document.typeName;
    case 'version':
      return document.latestVersionLabel ?? '-';
    case 'status':
      return document.status ?? 'Not started';
    case 'author':
      return document.author || '-';
    case 'language':
      return document.languageCode ?? '-';
    case 'confidentialityClass':
      return document.confidentialityClassName ?? '-';
    case 'group':
      return document.groupName ?? '-';
    case 'project':
      return document.projectName ?? '-';
    case 'company':
      return document.company || '-';
    case 'department':
      return document.department || '-';
    case 'startDate':
      return formatDateShort(document.startDate);
    case 'createdDate':
      return formatDateShort(document.createdDate);
    case 'modifiedDate':
      return formatDateShort(document.modifiedDate);
    case 'releasedDate':
      return formatDateShort(document.releasedDate);
    case 'reviewedBy':
      return document.reviewedBy || '-';
    case 'approvedBy':
      return document.approvedBy || '-';
    case 'revisionIntervalMonths':
      return document.revisionIntervalMonths ? `${document.revisionIntervalMonths} months` : '-';
    case 'revisionDescription':
      return document.revisionDescription || '-';
    default:
      return '';
  }
};

const quoteCsvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const buildCsvDocument = (request: DocumentExportRequest): string => {
  const header = request.columns.map((column) => quoteCsvCell(column.label)).join(',');
  const rows = request.rows.map((document) =>
    request.columns.map((column) => quoteCsvCell(getDocumentExportCellValue(document, column.key))).join(',')
  );

  return `\uFEFF${[header, ...rows].join('\r\n')}`;
};

const getGroupValue = (
  document: DocumentListItem,
  groupBy: Exclude<DocumentExportGrouping, 'none'>
): string => {
  switch (groupBy) {
    case 'documentType':
      return document.typeName || EMPTY_GROUP_LABELS[groupBy];
    case 'status':
      return document.status ?? EMPTY_GROUP_LABELS[groupBy];
    case 'group':
      return document.groupName ?? EMPTY_GROUP_LABELS[groupBy];
    case 'project':
      return document.projectName ?? EMPTY_GROUP_LABELS[groupBy];
    case 'language':
      return document.languageCode ?? EMPTY_GROUP_LABELS[groupBy];
    case 'confidentialityClass':
      return document.confidentialityClassName ?? EMPTY_GROUP_LABELS[groupBy];
    case 'company':
      return document.company || EMPTY_GROUP_LABELS[groupBy];
    case 'department':
      return document.department || EMPTY_GROUP_LABELS[groupBy];
    case 'author':
      return document.author || EMPTY_GROUP_LABELS[groupBy];
  }
};

const buildDocumentGroups = (
  rows: DocumentListItem[],
  groupBy: DocumentExportGrouping
): Array<{ label: string; rows: DocumentListItem[] }> => {
  if (groupBy === 'none') {
    return [
      {
        label: 'All Documents',
        rows
      }
    ];
  }

  const groups = new Map<string, DocumentListItem[]>();
  for (const document of rows) {
    const label = getGroupValue(document, groupBy);
    groups.set(label, [...(groups.get(label) ?? []), document]);
  }

  return [...groups.entries()].map(([label, groupRows]) => ({
    label,
    rows: groupRows
  }));
};

const buildStatusSummary = (
  rows: DocumentListItem[],
  lifecycle?: WorkspaceLifecycle
): Array<{ label: string; count: number }> => {
  const counts = new Map<string, number>();
  for (const status of (lifecycle ?? createDefaultWorkspaceLifecycle()).statuses) {
    counts.set(status.name, 0);
  }
  counts.set('Not started', 0);

  for (const row of rows) {
    const key = row.status ?? 'Not started';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count }));
};

const buildFilterSummaryItems = (request: DocumentExportRequest): string[] => {
  const items: string[] = [];
  if (request.filters.search) {
    items.push(`Search: ${request.filters.search}`);
  }
  if (request.filters.status && request.filters.status !== 'All') {
    items.push(`Status: ${request.filters.status}`);
  }
  if (request.filters.group && request.filters.group !== 'All groups') {
    items.push(`Group: ${request.filters.group}`);
  }
  if (request.filters.project && request.filters.project !== 'All projects') {
    items.push(`Project: ${request.filters.project}`);
  }
  return items;
};

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const buildMetadataRows = (document: DocumentListItem, allowedColumns: Set<DocumentTableColumn>): string => {
  const rows = PDF_CARD_FIELD_ORDER.filter((column) => allowedColumns.has(column))
    .map((column) => {
      const value = getDocumentExportCellValue(document, column);
      const shouldMute =
        value === '—' &&
        column !== 'status' &&
        column !== 'documentId' &&
        column !== 'title' &&
        column !== 'documentType';

      return `
        <div class="field">
          <div class="field-label">${escapeHtml(getDocumentTableColumnLabel(column))}</div>
          <div class="field-value${shouldMute ? ' muted' : ''}">${escapeHtml(value)}</div>
        </div>
      `;
    })
    .join('');

  return rows;
};

export const buildPdfReportHtml = (
  request: DocumentExportRequest,
  options: { companyLogoDataUrl?: string | null } = {}
): string => {
  const allowedColumns = new Set<DocumentTableColumn>(
    request.columns
      .map((column) => column.key)
      .filter((column): column is DocumentTableColumn => DOCUMENT_TABLE_COLUMNS.includes(column))
  );
  const filterSummaryItems = buildFilterSummaryItems(request);
  const statusSummary = buildStatusSummary(request.rows, request.lifecycle);
  const groups = buildDocumentGroups(request.rows, request.groupBy);
  const logoMarkup = options.companyLogoDataUrl
    ? `<img class="logo${request.pdfColorMode === 'black-and-white' ? ' logo-bw' : ''}" src="${options.companyLogoDataUrl}" alt="Company logo" />`
    : '';
  const pageHeaderMarkup = `
    <div class="page-header">
      <div class="page-header-left">
        ${logoMarkup}
        <div class="page-header-copy"><strong>${escapeHtml(request.workspaceName)}</strong> Documents Export</div>
      </div>
      <div class="page-header-right">${escapeHtml(formatDateTime(request.exportTimestamp))}</div>
    </div>
  `;
  const detailPages = groups.flatMap((group) =>
    chunkArray(group.rows, 2).map((pageRows, pageIndex, pages) => ({
      group,
      pageRows,
      pageIndex,
      totalPages: pages.length
    }))
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(request.workspaceName)} Documents Report</title>
    <style>
      @page {
        size: A4;
        margin: 14mm;
      }

      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #dbe4ef;
        --panel: #f8fafc;
        --panel-strong: #eff6ff;
        --accent: #0f4c81;
        --accent-soft: #dbeafe;
        --hero-glow: rgba(15, 76, 129, 0.14);
        --hero-mid: #f8fbff;
        --hero-end: #eef5ff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: var(--ink);
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 11px;
        line-height: 1.45;
        background: white;
      }

      body.black-and-white {
        --ink: #101010;
        --muted: #5b5b5b;
        --line: #cfcfcf;
        --panel: #f4f4f4;
        --panel-strong: #ededed;
        --accent: #111111;
        --accent-soft: #ededed;
        --hero-glow: rgba(0, 0, 0, 0.08);
        --hero-mid: #f6f6f6;
        --hero-end: #f1f1f1;
      }

      .page {
        min-height: 0;
        page-break-after: always;
      }

      .page:last-child {
        page-break-after: auto;
      }

      .page-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid var(--line);
        color: var(--muted);
        font-size: 10px;
        padding: 0 0 8mm;
        margin-bottom: 8mm;
      }

      .page-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .page-header-copy {
        display: flex;
        align-items: baseline;
        gap: 4px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .page-header-right {
        white-space: nowrap;
        text-align: right;
      }

      .logo {
        display: block;
        max-height: 7mm;
        max-width: 20mm;
        object-fit: contain;
        object-position: left center;
        flex: 0 0 auto;
      }

      .logo-bw {
        filter: grayscale(100%);
      }

      .page-header strong {
        color: var(--ink);
        font-size: 11px;
      }

      .page-title {
        margin: 0 0 8px;
        font-size: 22px;
        line-height: 1.15;
      }

      .page-subtitle {
        margin: 0 0 14px;
        color: var(--muted);
      }

      .page-section {
        margin-top: 12px;
      }

      .hero {
        border: 1px solid var(--line);
        border-radius: 16px;
        background:
          radial-gradient(circle at top right, var(--hero-glow), transparent 34%),
          linear-gradient(135deg, #ffffff 0%, var(--hero-mid) 55%, var(--hero-end) 100%);
        padding: 18px 20px;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--accent);
        font-size: 10px;
        font-weight: 700;
      }

      h1 {
        margin: 8px 0 6px;
        font-size: 26px;
        line-height: 1.1;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }

      .hero-item,
      .summary-item {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.88);
        padding: 10px 12px;
      }

      .label {
        color: var(--muted);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .value {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 600;
      }

      .summary {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 14px;
      }

      .summary-panel {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
        padding: 14px;
      }

      .summary-panel h2 {
        margin: 0 0 10px;
        font-size: 14px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .filter-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .filter-chip {
        padding: 6px 10px;
        border-radius: 999px;
        background: white;
        border: 1px solid var(--line);
      }

      .section {
        margin-top: 18px;
        break-inside: avoid;
      }

      .section-header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }

      .section-title {
        font-size: 17px;
        font-weight: 700;
      }

      .section-meta {
        color: var(--muted);
      }

      .cards {
        display: block;
      }

      .card {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: white;
        padding: 14px;
        margin-bottom: 10px;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .card-top {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .card-title {
        margin: 4px 0 0;
        font-size: 15px;
        font-weight: 700;
      }

      .card-id {
        color: var(--accent);
        font-weight: 700;
        font-family: "Consolas", "Courier New", monospace;
      }

      .card-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        border-radius: 999px;
        padding: 6px 12px;
        font-weight: 700;
        font-size: 10px;
        white-space: nowrap;
        line-height: 1;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
      }

      .status-badge {
        border: 1px solid transparent;
      }

      .status-draft {
        background: #fff1dc;
        color: #a15b00;
        border-color: #f3d29c;
      }

      .status-review {
        background: #e6f0ff;
        color: #1854c6;
        border-color: #bfd4ff;
      }

      .status-released {
        background: #e6f7eb;
        color: #1f7a3e;
        border-color: #b9e5c5;
      }

      .status-archived,
      .status-obsolete,
      .status-not-started,
      .status-badge-bw {
        background: #f1f1f1;
        color: #3f3f3f;
        border-color: #d2d2d2;
      }

      .field-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .field {
        border-radius: 10px;
        background: var(--panel);
        padding: 9px 10px;
      }

      .field-label {
        color: var(--muted);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .field-value {
        margin-top: 4px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
      }

      .muted {
        color: var(--muted);
      }
    </style>
  </head>
  <body class="${request.pdfColorMode}">
    <section class="page">
      ${pageHeaderMarkup}
      <section class="hero">
        <div class="eyebrow">Structured Documents Report</div>
        <h1>${escapeHtml(request.workspaceName)}</h1>
        <div class="muted">A professional export of tracked document metadata and latest version information.</div>
        <div class="hero-grid">
          <div class="hero-item">
            <div class="label">Scope</div>
            <div class="value">${escapeHtml(request.scope === 'current-table' ? 'Current table' : 'Whole workspace')}</div>
          </div>
          <div class="hero-item">
            <div class="label">Format</div>
            <div class="value">${escapeHtml(request.format.toUpperCase())}</div>
          </div>
          <div class="hero-item">
            <div class="label">Grouped By</div>
            <div class="value">${escapeHtml(getDocumentExportGroupingLabel(request.groupBy))}</div>
          </div>
          <div class="hero-item">
            <div class="label">Generated</div>
            <div class="value">${escapeHtml(formatDateTime(request.exportTimestamp))}</div>
          </div>
        </div>
      </section>

      <section class="summary">
        <div class="summary-panel">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Documents</div>
              <div class="value">${request.rows.length}</div>
            </div>
            ${statusSummary
              .map(
                (item) => `
                  <div class="summary-item">
                    <div class="label">${escapeHtml(item.label)}</div>
                    <div class="value">${item.count}</div>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
        <div class="summary-panel">
          <h2>Active Filters</h2>
          ${
            filterSummaryItems.length > 0
              ? `<div class="filter-list">${filterSummaryItems
                  .map((item) => `<div class="filter-chip">${escapeHtml(item)}</div>`)
                  .join('')}</div>`
              : '<div class="muted">No active filters were applied to this export.</div>'
          }
        </div>
      </section>
    </section>

    ${detailPages
      .map(
        ({ group, pageRows, pageIndex, totalPages }) => `
          <section class="page">
            ${pageHeaderMarkup}
            <section class="page-section">
              <div class="section-header">
                <div>
                  <h2 class="page-title">${escapeHtml(group.label)}</h2>
                  <div class="page-subtitle">Structured document cards for ${escapeHtml(group.label.toLowerCase())}.</div>
                </div>
                <div class="section-meta">
                  ${group.rows.length} document${group.rows.length === 1 ? '' : 's'}${totalPages > 1 ? ` • Page ${pageIndex + 1} of ${totalPages}` : ''}
                </div>
              </div>
              <div class="cards">
                ${pageRows
                  .map(
                    (document) => `
                      <article class="card">
                        <div class="card-top">
                          <div>
                            <div class="card-id">${escapeHtml(document.documentId)}</div>
                            <div class="card-title">${escapeHtml(document.title)}</div>
                          </div>
                          <div class="card-badge ${getStatusBadgeClassName(document.status, request.pdfColorMode, request.lifecycle)}">${escapeHtml(document.status ?? 'Not started')}</div>
                        </div>
                        <div class="field-grid">${buildMetadataRows(document, allowedColumns)}</div>
                      </article>
                    `
                  )
                  .join('')}
              </div>
            </section>
          </section>
        `
      )
      .join('')}
  </body>
</html>`;
};

export class DocumentExportService {
  private readonly showSaveDialog: DocumentExportServiceDependencies['showSaveDialog'];
  private readonly readWorkspaceFile: DocumentExportServiceDependencies['readFile'];
  private readonly persistFile: DocumentExportServiceDependencies['writeFile'];
  private readonly createPdfWindow: DocumentExportServiceDependencies['createPdfWindow'];

  constructor(dependencies: Partial<DocumentExportServiceDependencies> = {}) {
    this.showSaveDialog = dependencies.showSaveDialog ?? ((options) => dialog.showSaveDialog(options));
    this.readWorkspaceFile = dependencies.readFile ?? ((filePath) => readFile(filePath));
    this.persistFile = dependencies.writeFile ?? ((filePath, data) => writeFile(filePath, data));
    this.createPdfWindow =
      dependencies.createPdfWindow ??
      (() =>
        new BrowserWindow({
          show: false,
          width: 1200,
          height: 1600,
          backgroundColor: '#ffffff',
          webPreferences: {
            sandbox: true
          }
        }));
  }

  async export(rootPath: string, request: DocumentExportRequest): Promise<DocumentExportResult> {
    const defaultFileName = buildDefaultDocumentExportFileName(
      request.workspaceName,
      request.format,
      request.exportTimestamp
    );
    const saveResult = await this.showSaveDialog({
      title: request.format === 'csv' ? 'Export Documents to CSV' : 'Export Documents to PDF',
      defaultPath: path.join(rootPath, defaultFileName),
      filters: [
        {
          name: request.format === 'csv' ? 'CSV Files' : 'PDF Files',
          extensions: [request.format]
        }
      ]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return {
        canceled: true,
        filePath: null
      };
    }

    const payload =
      request.format === 'csv'
        ? buildCsvDocument(request)
        : await this.buildPdfDocumentBuffer(rootPath, request);

    await this.persistFile(saveResult.filePath, payload);

    return {
      canceled: false,
      filePath: saveResult.filePath
    };
  }

  private async buildPdfDocumentBuffer(rootPath: string, request: DocumentExportRequest): Promise<Buffer> {
    const companyLogoDataUrl = await this.readCompanyLogoDataUrl(rootPath, request.companyLogoPath);
    const html = buildPdfReportHtml(request, {
      companyLogoDataUrl
    });
    const window = this.createPdfWindow();

    try {
      await window.loadURL(buildDataUrl(html));
      return await window.webContents.printToPDF(PDF_PRINT_OPTIONS);
    } finally {
      window.destroy();
    }
  }

  private async readCompanyLogoDataUrl(
    rootPath: string,
    companyLogoPath: string | null
  ): Promise<string | null> {
    if (!companyLogoPath) {
      return null;
    }

    try {
      const absolutePath = resolveWorkspaceStoredPath(rootPath, companyLogoPath);
      const buffer = await this.readWorkspaceFile(absolutePath);
      return `data:${getMimeTypeForLogoPath(companyLogoPath)};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }
}

