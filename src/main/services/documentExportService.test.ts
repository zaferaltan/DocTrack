import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentExportRequest } from '@shared/types';
import { DocumentExportService, buildCsvDocument, buildDefaultDocumentExportFileName, buildPdfReportHtml } from '@main/services/documentExportService';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  dialog: {
    showSaveDialog: vi.fn()
  }
}));

const buildRequest = (overrides: Partial<DocumentExportRequest> = {}): DocumentExportRequest => ({
  format: 'csv',
  scope: 'current-table',
  groupBy: 'documentType',
  pdfColorMode: 'color',
  workspaceName: 'Quality Workspace',
  companyLogoPath: null,
  exportTimestamp: '2026-03-31T10:15:00.000Z',
  columns: [
    { key: 'documentId', label: 'Document ID' },
    { key: 'title', label: 'Title' },
    { key: 'revisionDescription', label: 'Revision Description' }
  ],
  rows: [
    {
      id: 101,
      documentId: '02202600001',
      title: 'Operating Procedure',
      typeId: 2,
      typeName: 'Procedure',
      versionScheme: 'numeric-3',
      status: 'Draft',
      latestVersionLabel: '001',
      releasedDate: null,
      approvedBy: '',
      revisionDescription: 'Contains "quoted" text,\nand a second line',
      modifiedDate: '2026-03-31T09:00:00.000Z',
      createdDate: '2026-03-30T09:00:00.000Z',
      author: 'Jordan Singh',
      languageId: 1,
      languageCode: 'EN',
      confidentialityClassId: null,
      confidentialityClassName: null,
      projectId: null,
      projectName: null,
      company: 'Acme',
      department: 'Quality',
      startDate: '2026-03-30',
      revisionIntervalMonths: 12,
      nextReviewDate: '2027-03-31T09:00:00.000Z',
      isOverdue: false,
      healthFlags: [],
      latestVersionFileCount: 1,
      lastActivityDate: '2026-03-31T09:00:00.000Z',
      reviewedBy: ''
    }
  ],
  filters: {
    search: 'Operating',
    status: 'All',
    project: 'All projects'
  },
  ...overrides
});

describe('document export service', () => {
  let tempRoot = '';

  afterEach(() => {
    vi.restoreAllMocks();
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('builds CSV with BOM and escaped values', () => {
    const csv = buildCsvDocument(buildRequest());

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Document ID","Title","Revision Description"');
    expect(csv).toContain('"Contains ""quoted"" text,');
    expect(csv).toContain('\nand a second line"');
  });

  it('builds the default export filename from workspace name and timestamp', () => {
    expect(
      buildDefaultDocumentExportFileName('Quality Workspace', 'pdf', '2026-03-31T10:15:00.000Z')
    ).toBe('quality-workspace-documents-2026-03-31.pdf');
  });

  it('builds structured PDF report HTML with summary metadata and grouped cards', () => {
    const html = buildPdfReportHtml(
      buildRequest({
        format: 'pdf',
        groupBy: 'documentType',
        columns: [
          { key: 'documentId', label: 'Document ID' },
          { key: 'title', label: 'Title' },
          { key: 'documentType', label: 'Document Type' },
          { key: 'status', label: 'Status' }
        ]
      }),
      {
        companyLogoDataUrl: 'data:image/png;base64,AAAA'
      }
    );

    expect(html).toContain('Structured Documents Report');
    expect(html).toContain('Quality Workspace');
    expect(html).toContain('Document Type');
    expect(html).toContain('Procedure');
    expect(html).toContain('Operating Procedure');
    expect(html).toContain('Total Documents');
    expect(html).toContain('data:image/png;base64,AAAA');
  });

  it('builds black and white PDF HTML with grayscale body class', () => {
    const html = buildPdfReportHtml(
      buildRequest({
        format: 'pdf',
        pdfColorMode: 'black-and-white'
      })
    );

    expect(html).toContain('body class="black-and-white"');
    expect(html).toContain('status-badge status-badge-bw');
  });

  it('saves an exported PDF and returns the saved file path', async () => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'doctrack-export-'));
    const outputPath = path.join(tempRoot, 'quality-report.pdf');
    const showSaveDialog = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: outputPath
    });
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const printToPDF = vi.fn().mockResolvedValue(Buffer.from('pdf-data'));
    const destroy = vi.fn();

    const service = new DocumentExportService({
      showSaveDialog,
      readFile: vi.fn().mockResolvedValue(Buffer.from('logo-data')),
      createPdfWindow: () => ({
        loadURL,
        webContents: {
          printToPDF
        },
        destroy
      })
    });

    const result = await service.export(
      tempRoot,
      buildRequest({
        format: 'pdf',
        groupBy: 'status',
        companyLogoPath: 'Database/branding/company-logo.png',
        columns: [
          { key: 'documentId', label: 'Document ID' },
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' }
        ]
      })
    );

    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: path.join(tempRoot, 'quality-workspace-documents-2026-03-31.pdf')
      })
    );
    expect(loadURL).toHaveBeenCalledTimes(1);
    expect(printToPDF).toHaveBeenCalledTimes(1);
    expect(readFileSync(outputPath)).toEqual(Buffer.from('pdf-data'));
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      canceled: false,
      filePath: outputPath
    });
  });
});
