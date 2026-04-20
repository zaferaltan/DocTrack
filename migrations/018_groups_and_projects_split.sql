PRAGMA foreign_keys = OFF;

ALTER TABLE Projects RENAME TO Groups;

CREATE TABLE IF NOT EXISTS Projects (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL UNIQUE
);

CREATE TABLE Documents__Migration (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DocumentID TEXT NOT NULL UNIQUE,
  Title TEXT NOT NULL,
  DocumentTypeId INTEGER NOT NULL REFERENCES DocumentTypes (Id) ON DELETE RESTRICT,
  VersionScheme TEXT NOT NULL
    CHECK (VersionScheme IN ('numeric-3', 'v-prefix', 'alpha-uppercase', 'major-minor')),
  DocumentFolderPath TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL,
  Author TEXT NOT NULL,
  AuthorUserId INTEGER REFERENCES WorkspaceUsers (Id) ON DELETE SET NULL,
  LanguageId INTEGER REFERENCES Languages (Id) ON DELETE SET NULL,
  ConfidentialityClassId INTEGER REFERENCES ConfidentialityClasses (Id) ON DELETE SET NULL,
  GroupId INTEGER REFERENCES Groups (Id) ON DELETE SET NULL,
  ProjectId INTEGER REFERENCES Projects (Id) ON DELETE SET NULL,
  Company TEXT NOT NULL DEFAULT '',
  Department TEXT NOT NULL DEFAULT '',
  RevisionIntervalMonths INTEGER
    CHECK (RevisionIntervalMonths IS NULL OR RevisionIntervalMonths >= 1),
  StartDate TEXT
);

INSERT INTO Documents__Migration (
  Id,
  DocumentID,
  Title,
  DocumentTypeId,
  VersionScheme,
  DocumentFolderPath,
  CreatedDate,
  ModifiedDate,
  Author,
  AuthorUserId,
  LanguageId,
  ConfidentialityClassId,
  GroupId,
  ProjectId,
  Company,
  Department,
  RevisionIntervalMonths,
  StartDate
)
SELECT
  Id,
  DocumentID,
  Title,
  DocumentTypeId,
  VersionScheme,
  DocumentFolderPath,
  CreatedDate,
  ModifiedDate,
  Author,
  AuthorUserId,
  LanguageId,
  ConfidentialityClassId,
  ProjectId,
  NULL,
  Company,
  Department,
  RevisionIntervalMonths,
  StartDate
FROM Documents;

DROP TABLE Documents;
ALTER TABLE Documents__Migration RENAME TO Documents;

DROP INDEX IF EXISTS idx_documents_project_id;
CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON Documents (DocumentTypeId);
CREATE INDEX IF NOT EXISTS idx_documents_document_id ON Documents (DocumentID);
CREATE INDEX IF NOT EXISTS idx_documents_modified_date ON Documents (ModifiedDate DESC);
CREATE INDEX IF NOT EXISTS idx_documents_group_id ON Documents (GroupId);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON Documents (ProjectId);
CREATE INDEX IF NOT EXISTS idx_documents_language_id ON Documents (LanguageId);
CREATE INDEX IF NOT EXISTS idx_documents_confidentiality_class_id ON Documents (ConfidentialityClassId);
CREATE INDEX IF NOT EXISTS idx_documents_author_user_id ON Documents (AuthorUserId);

UPDATE Workspaces
SET VisibleDocumentColumns = json_insert(
  replace(VisibleDocumentColumns, '"project"', '"group"'),
  '$[#]',
  'project'
)
WHERE VisibleDocumentColumns LIKE '%"project"%';

UPDATE Workspaces
SET DocumentIdFormatTemplate = replace(DocumentIdFormatTemplate, '<projectName>', '<groupName>')
WHERE DocumentIdFormatTemplate LIKE '%<projectName>%';

UPDATE Workspaces
SET DocumentIdFormatTemplate = replace(DocumentIdFormatTemplate, '<project>', '<group>')
WHERE DocumentIdFormatTemplate LIKE '%<project>%';

UPDATE SavedViews
SET QueryJson = replace(
  replace(QueryJson, '"projectFilter"', '"groupFilter"'),
  '"field":"project"',
  '"field":"group"'
)
WHERE QueryJson LIKE '%project%';

ALTER TABLE DashboardWidgets RENAME TO DashboardWidgets__Legacy;

CREATE TABLE DashboardWidgets (
  Id TEXT PRIMARY KEY,
  WidgetType TEXT NOT NULL
    CHECK (
      WidgetType IN (
        'filesystemAttention',
        'statusSummary',
        'healthInsights',
        'typeGrouping',
        'groupGrouping',
        'projectGrouping',
        'recentActivity',
        'savedView'
      )
    ),
  Title TEXT NOT NULL DEFAULT '',
  SavedViewId TEXT REFERENCES SavedViews (Id) ON DELETE CASCADE,
  ConfigJson TEXT NOT NULL DEFAULT '{}',
  GridX INTEGER NOT NULL DEFAULT 0 CHECK (GridX >= 0),
  GridY INTEGER NOT NULL DEFAULT 0 CHECK (GridY >= 0),
  GridW INTEGER NOT NULL DEFAULT 4 CHECK (GridW >= 1),
  GridH INTEGER NOT NULL DEFAULT 2 CHECK (GridH >= 1),
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL
);

INSERT INTO DashboardWidgets (
  Id,
  WidgetType,
  Title,
  SavedViewId,
  ConfigJson,
  GridX,
  GridY,
  GridW,
  GridH,
  CreatedDate,
  ModifiedDate
)
SELECT
  Id,
  CASE
    WHEN WidgetType = 'projectGrouping' THEN 'groupGrouping'
    ELSE WidgetType
  END,
  CASE
    WHEN WidgetType = 'projectGrouping' AND (trim(Title) = '' OR Title = 'Projects') THEN 'Groups'
    ELSE Title
  END,
  SavedViewId,
  ConfigJson,
  GridX,
  GridY,
  GridW,
  GridH,
  CreatedDate,
  ModifiedDate
FROM DashboardWidgets__Legacy;

DROP TABLE DashboardWidgets__Legacy;

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_grid ON DashboardWidgets (GridY ASC, GridX ASC);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_saved_view_id ON DashboardWidgets (SavedViewId);

PRAGMA foreign_keys = ON;
