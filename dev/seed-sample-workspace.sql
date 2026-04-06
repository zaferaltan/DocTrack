-- Manual development seed for an existing DocTrack workspace database.
--
-- Usage:
--   sqlite3 path/to/workspace.sqlite < dev/seed-sample-workspace.sql
--
-- Notes:
-- - This file never runs automatically.
-- - It is safe to run more than once. Inserts are idempotent.
-- - It only seeds database rows. It does not create managed files on disk.
-- - Folder paths follow the workspace's current Documents directory setting.

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DROP TABLE IF EXISTS DevSeedWorkspaceCheck;
CREATE TEMP TABLE DevSeedWorkspaceCheck (
  ExistingWorkspace INTEGER NOT NULL CHECK (ExistingWorkspace = 1)
);
INSERT INTO DevSeedWorkspaceCheck (ExistingWorkspace)
SELECT COUNT(*) FROM Workspaces WHERE Id = 1;
DROP TABLE IF EXISTS DevSeedWorkspaceCheck;

INSERT OR IGNORE INTO DocumentTypes (Name, NumberPrefix) VALUES
  ('Specification', '01'),
  ('Procedure', '02'),
  ('Report', '03'),
  ('Work Instruction', '04'),
  ('Form', '05');

INSERT OR IGNORE INTO Projects (Name) VALUES
  ('QMS Refresh'),
  ('Plant Expansion'),
  ('Supplier Consolidation'),
  ('Regulatory Readiness');

INSERT OR IGNORE INTO ConfidentialityClasses (Name) VALUES
  ('Public'),
  ('Internal'),
  ('Confidential');

INSERT OR IGNORE INTO Languages (Code) VALUES
  ('NL'),
  ('EN'),
  ('DE'),
  ('FR');

DROP TABLE IF EXISTS DevSampleDocuments;
CREATE TEMP TABLE DevSampleDocuments (
  DocumentID TEXT PRIMARY KEY,
  Title TEXT NOT NULL,
  DocumentTypeName TEXT NOT NULL,
  VersionScheme TEXT NOT NULL,
  Author TEXT NOT NULL,
  LanguageCode TEXT,
  ConfidentialityName TEXT,
  ProjectName TEXT,
  Company TEXT NOT NULL,
  Department TEXT NOT NULL,
  StartDate TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL,
  RevisionIntervalMonths INTEGER,
  FolderSlug TEXT NOT NULL
);

INSERT INTO DevSampleDocuments (
  DocumentID,
  Title,
  DocumentTypeName,
  VersionScheme,
  Author,
  LanguageCode,
  ConfidentialityName,
  ProjectName,
  Company,
  Department,
  StartDate,
  CreatedDate,
  ModifiedDate,
  RevisionIntervalMonths,
  FolderSlug
) VALUES
  (
    '01202690001',
    'Quality Manual',
    'Specification',
    'numeric-3',
    'Avery Chen',
    'EN',
    'Internal',
    'QMS Refresh',
    'Acme Biologics',
    'Quality',
    '2026-01-08',
    '2026-01-08T08:30:00.000Z',
    '2026-02-04T16:10:00.000Z',
    12,
    'development-samples/01202690001-quality-manual'
  ),
  (
    '02202690001',
    'CAPA Procedure',
    'Procedure',
    'numeric-3',
    'Jordan Singh',
    'EN',
    'Internal',
    'QMS Refresh',
    'Acme Biologics',
    'Quality',
    '2026-02-12',
    '2026-02-12T10:00:00.000Z',
    '2026-03-06T15:45:00.000Z',
    12,
    'development-samples/02202690001-capa-procedure'
  ),
  (
    '03202590001',
    'Supplier Qualification Report',
    'Report',
    'v-prefix',
    'Morgan Ellis',
    'EN',
    'Confidential',
    'Supplier Consolidation',
    'Acme Biologics',
    'Procurement',
    '2025-09-03',
    '2025-09-03T09:20:00.000Z',
    '2025-11-21T14:00:00.000Z',
    6,
    'development-samples/03202590001-supplier-qualification-report'
  ),
  (
    '04202690001',
    'Batch Record Review Checklist',
    'Work Instruction',
    'alpha-uppercase',
    'Iris Bakker',
    'NL',
    'Internal',
    'Plant Expansion',
    'Acme Biologics',
    'Operations',
    '2026-03-01',
    '2026-03-01T07:40:00.000Z',
    '2026-03-28T11:25:00.000Z',
    NULL,
    'development-samples/04202690001-batch-record-review-checklist'
  ),
  (
    '05202690001',
    'Change Request Form',
    'Form',
    'numeric-3',
    'Noah Carter',
    'EN',
    'Public',
    'Regulatory Readiness',
    'Acme Biologics',
    'Quality',
    '2026-01-15',
    '2026-01-15T13:15:00.000Z',
    '2026-01-15T13:15:00.000Z',
    NULL,
    'development-samples/05202690001-change-request-form'
  ),
  (
    '01202490001',
    'Document Control Matrix',
    'Specification',
    'major-minor',
    'Taylor Brooks',
    'EN',
    'Internal',
    'QMS Refresh',
    'Acme Biologics',
    'Quality',
    '2024-03-10',
    '2024-03-10T08:00:00.000Z',
    '2024-08-02T12:30:00.000Z',
    12,
    'development-samples/01202490001-document-control-matrix'
  ),
  (
    '02202390001',
    'Legacy Archive Procedure',
    'Procedure',
    'numeric-3',
    'Priya Nair',
    'EN',
    'Internal',
    'Regulatory Readiness',
    'Acme Biologics',
    'Quality',
    '2023-06-05',
    '2023-06-05T10:10:00.000Z',
    '2024-01-11T17:05:00.000Z',
    24,
    'development-samples/02202390001-legacy-archive-procedure'
  ),
  (
    '03202490002',
    'Annual Training Effectiveness Report',
    'Report',
    'v-prefix',
    'Lena Hoffmann',
    'DE',
    'Internal',
    'Regulatory Readiness',
    'Acme Biologics',
    'People Operations',
    '2024-11-01',
    '2024-11-01T11:00:00.000Z',
    '2025-01-09T10:20:00.000Z',
    NULL,
    'development-samples/03202490002-annual-training-effectiveness-report'
  ),
  (
    '01202690002',
    'Risk Management Plan',
    'Specification',
    'major-minor',
    'Mia Jansen',
    'EN',
    'Confidential',
    'Plant Expansion',
    'Acme Biologics',
    'Engineering',
    '2026-02-20',
    '2026-02-20T09:00:00.000Z',
    '2026-03-22T10:30:00.000Z',
    6,
    'development-samples/01202690002-risk-management-plan'
  ),
  (
    '02202690002',
    'Cleanroom Entry Procedure',
    'Procedure',
    'numeric-3',
    'Sanne de Vries',
    'NL',
    'Internal',
    'Plant Expansion',
    'Acme Biologics',
    'Operations',
    '2026-01-18',
    '2026-01-18T06:55:00.000Z',
    '2026-02-02T08:40:00.000Z',
    12,
    'development-samples/02202690002-cleanroom-entry-procedure'
  ),
  (
    '05202690002',
    'Deviation Intake Form',
    'Form',
    'numeric-3',
    'Harper Lewis',
    'EN',
    'Internal',
    'QMS Refresh',
    'Acme Biologics',
    'Quality',
    '2026-03-10',
    '2026-03-10T14:20:00.000Z',
    '2026-03-10T14:20:00.000Z',
    NULL,
    'development-samples/05202690002-deviation-intake-form'
  ),
  (
    '04202590002',
    'Equipment Cleaning Work Instruction',
    'Work Instruction',
    'alpha-uppercase',
    'Diego Alvarez',
    'EN',
    'Internal',
    'Plant Expansion',
    'Acme Biologics',
    'Operations',
    '2025-05-12',
    '2025-05-12T06:30:00.000Z',
    '2025-06-18T09:45:00.000Z',
    12,
    'development-samples/04202590002-equipment-cleaning-work-instruction'
  );

DROP TABLE IF EXISTS DevSampleVersions;
CREATE TEMP TABLE DevSampleVersions (
  DocumentID TEXT NOT NULL,
  SequenceNumber INTEGER NOT NULL,
  VersionLabel TEXT NOT NULL,
  Status TEXT NOT NULL,
  VersionDocumentID TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  ReleasedDate TEXT,
  ReviewedBy TEXT NOT NULL,
  ApprovedBy TEXT NOT NULL,
  Notes TEXT NOT NULL,
  PRIMARY KEY (DocumentID, SequenceNumber)
);

INSERT INTO DevSampleVersions (
  DocumentID,
  SequenceNumber,
  VersionLabel,
  Status,
  VersionDocumentID,
  CreatedDate,
  ReleasedDate,
  ReviewedBy,
  ApprovedBy,
  Notes
) VALUES
  ('01202690001', 1, '001', 'Draft', '01202690001', '2026-01-08T08:30:00.000Z', NULL, '', '', 'Initial baseline for the 2026 QMS refresh.'),
  ('01202690001', 2, '002', 'In Review', '01202690001', '2026-02-04T16:10:00.000Z', NULL, 'Dana Ortega', '', 'Cross-functional review with site QA leads.'),
  ('02202690001', 1, '001', 'Draft', '02202690001', '2026-02-12T10:00:00.000Z', NULL, '', '', 'Initial procedure draft for CAPA intake and triage.'),
  ('02202690001', 2, '002', 'Released', '02202690001', '2026-03-06T15:45:00.000Z', '2026-03-06', 'Dana Ortega', 'Samir Patel', 'Approved release after QA and operations sign-off.'),
  ('03202590001', 1, 'v1', 'Draft', '03202590001', '2025-09-03T09:20:00.000Z', NULL, '', '', 'First supplier qualification pass for the consolidation program.'),
  ('03202590001', 2, 'v2', 'Released', '03202590001', '2025-11-21T14:00:00.000Z', '2025-11-21', 'Elliot Gray', 'Morgan Ellis', 'Released after procurement and QA review.'),
  ('04202690001', 1, 'A', 'Draft', '04202690001', '2026-03-01T07:40:00.000Z', NULL, '', '', 'Initial Dutch checklist for batch record review.'),
  ('04202690001', 2, 'B', 'In Review', '04202690001', '2026-03-28T11:25:00.000Z', NULL, 'Iris Bakker', '', 'Updated checklist wording for pilot line rollout.'),
  ('05202690001', 1, '001', 'Released', '05202690001', '2026-01-15T13:15:00.000Z', '2026-01-15', 'Noah Carter', 'Samir Patel', 'Blank request form approved for regulated use.'),
  ('01202490001', 1, '1.0', 'Released', '01202490001', '2024-03-24T09:15:00.000Z', '2024-03-24', 'Taylor Brooks', 'Avery Chen', 'Initial release of the document control matrix.'),
  ('01202490001', 2, '1.1', 'Released', '01202490001', '2024-08-02T12:30:00.000Z', '2024-08-02', 'Taylor Brooks', 'Avery Chen', 'Expanded retention and approval ownership columns.'),
  ('02202390001', 1, '001', 'Released', '02202390001', '2023-07-01T08:00:00.000Z', '2023-07-01', 'Priya Nair', 'Samir Patel', 'Initial archive handling procedure.'),
  ('02202390001', 2, '002', 'Released', '02202390001', '2023-10-19T09:30:00.000Z', '2023-10-19', 'Priya Nair', 'Samir Patel', 'Updated off-site retention language.'),
  ('02202390001', 3, '003', 'Obsolete', '02202390001', '2024-01-11T17:05:00.000Z', NULL, '', '', 'Superseded by the digital archive workflow.'),
  ('03202490002', 1, 'v1', 'Draft', '03202490002', '2024-11-01T11:00:00.000Z', NULL, '', '', 'Baseline annual training effectiveness review.'),
  ('03202490002', 2, 'v2', 'Released', '03202490002', '2024-12-01T09:00:00.000Z', '2024-12-01', 'Lena Hoffmann', 'Nora Klein', 'Released for annual compliance reporting.'),
  ('03202490002', 3, 'v3', 'Archived', '03202490002', '2025-01-09T10:20:00.000Z', '2025-01-09', '', '', 'Archived after the new reporting cycle opened.'),
  ('01202690002', 1, '1.0', 'Draft', '01202690002', '2026-02-20T09:00:00.000Z', NULL, '', '', 'Initial risk register for the facility expansion.'),
  ('01202690002', 2, '1.1', 'In Review', '01202690002', '2026-03-22T10:30:00.000Z', NULL, 'Mia Jansen', '', 'Risk scores updated after engineering review workshop.'),
  ('02202690002', 1, '001', 'Released', '02202690002', '2026-02-02T08:40:00.000Z', '2026-02-02', 'Sanne de Vries', 'Iris Bakker', 'Released for cleanroom onboarding.'),
  ('05202690002', 1, '001', 'Draft', '05202690002', '2026-03-10T14:20:00.000Z', NULL, '', '', 'Initial intake form for deviation triage.'),
  ('04202590002', 1, 'A', 'Draft', '04202590002', '2025-05-12T06:30:00.000Z', NULL, '', '', 'First working draft for equipment cleaning steps.'),
  ('04202590002', 2, 'B', 'Released', '04202590002', '2025-06-18T09:45:00.000Z', '2025-06-18', 'Diego Alvarez', 'Iris Bakker', 'Released after validation walkthrough on Line 2.');

INSERT OR IGNORE INTO Documents (
  DocumentID,
  Title,
  DocumentTypeId,
  VersionScheme,
  DocumentFolderPath,
  CreatedDate,
  ModifiedDate,
  Author,
  LanguageId,
  ConfidentialityClassId,
  ProjectId,
  Company,
  Department,
  RevisionIntervalMonths,
  StartDate
)
SELECT
  sample.DocumentID,
  sample.Title,
  documentType.Id,
  sample.VersionScheme,
  (SELECT COALESCE(NULLIF(DocumentsDirectoryName, ''), 'Documents') FROM Workspaces WHERE Id = 1) || '/' || sample.FolderSlug,
  sample.CreatedDate,
  sample.ModifiedDate,
  sample.Author,
  language.Id,
  confidentiality.Id,
  project.Id,
  sample.Company,
  sample.Department,
  sample.RevisionIntervalMonths,
  sample.StartDate
FROM DevSampleDocuments sample
INNER JOIN DocumentTypes documentType ON documentType.Name = sample.DocumentTypeName
LEFT JOIN Languages language ON language.Code = sample.LanguageCode
LEFT JOIN ConfidentialityClasses confidentiality ON confidentiality.Name = sample.ConfidentialityName
LEFT JOIN Projects project ON project.Name = sample.ProjectName;

INSERT OR IGNORE INTO DocumentVersions (
  DocumentId,
  VersionDocumentID,
  SequenceNumber,
  VersionLabel,
  Status,
  ReleasedDate,
  ReviewedBy,
  ApprovedBy,
  CreatedDate,
  Notes
)
SELECT
  document.Id,
  sample.VersionDocumentID,
  sample.SequenceNumber,
  sample.VersionLabel,
  sample.Status,
  sample.ReleasedDate,
  sample.ReviewedBy,
  sample.ApprovedBy,
  sample.CreatedDate,
  sample.Notes
FROM DevSampleVersions sample
INNER JOIN Documents document ON document.DocumentID = sample.DocumentID;

INSERT INTO ActivityLog (
  EventType,
  Message,
  DocumentRecordId,
  DocumentVersionId,
  CreatedDate
)
SELECT
  'development.seed',
  'Inserted development sample "' || document.Title || '" (' || document.DocumentID || ').',
  document.Id,
  (
    SELECT version.Id
    FROM DocumentVersions version
    WHERE version.DocumentId = document.Id
    ORDER BY version.SequenceNumber DESC
    LIMIT 1
  ),
  document.ModifiedDate
FROM Documents document
WHERE document.DocumentID IN (SELECT DocumentID FROM DevSampleDocuments)
  AND NOT EXISTS (
    SELECT 1
    FROM ActivityLog activity
    WHERE activity.EventType = 'development.seed'
      AND activity.DocumentRecordId = document.Id
  );

SELECT
  printf(
    'Development sample seed complete: %d sample documents and %d sample versions are now present.',
    (SELECT COUNT(*) FROM Documents WHERE DocumentID IN (SELECT DocumentID FROM DevSampleDocuments)),
    (
      SELECT COUNT(*)
      FROM DocumentVersions
      WHERE DocumentId IN (
        SELECT Id
        FROM Documents
        WHERE DocumentID IN (SELECT DocumentID FROM DevSampleDocuments)
      )
    )
  ) AS result;

DROP TABLE IF EXISTS DevSampleVersions;
DROP TABLE IF EXISTS DevSampleDocuments;

COMMIT;
