PRAGMA foreign_keys = OFF;

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
  LanguageId INTEGER REFERENCES Languages (Id) ON DELETE SET NULL,
  ConfidentialityClassId INTEGER REFERENCES ConfidentialityClasses (Id) ON DELETE SET NULL,
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
  LanguageId,
  ConfidentialityClassId,
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
  LanguageId,
  ConfidentialityClassId,
  ProjectId,
  Company,
  Department,
  RevisionIntervalMonths,
  StartDate
FROM Documents;

DROP TABLE Documents;

ALTER TABLE Documents__Migration RENAME TO Documents;

CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON Documents (DocumentTypeId);
CREATE INDEX IF NOT EXISTS idx_documents_document_id ON Documents (DocumentID);
CREATE INDEX IF NOT EXISTS idx_documents_modified_date ON Documents (ModifiedDate DESC);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON Documents (ProjectId);
CREATE INDEX IF NOT EXISTS idx_documents_language_id ON Documents (LanguageId);
CREATE INDEX IF NOT EXISTS idx_documents_confidentiality_class_id ON Documents (ConfidentialityClassId);

PRAGMA foreign_keys = ON;
