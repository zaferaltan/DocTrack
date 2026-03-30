CREATE TABLE IF NOT EXISTS Projects (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ConfidentialityClasses (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Languages (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Code TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO Statuses (Id, Name) VALUES
  (5, 'Obsolete');

INSERT OR IGNORE INTO Languages (Code) VALUES
  ('NL'),
  ('EN'),
  ('DE');

ALTER TABLE Workspaces ADD COLUMN VisibleDocumentColumns TEXT NOT NULL DEFAULT '["documentId","title","documentType","version","status","author","language","confidentialityClass","project","company","department","createdDate","modifiedDate","releasedDate","approvedBy","revisionIntervalMonths","revisionDescription"]';
ALTER TABLE Workspaces ADD COLUMN DefaultCompany TEXT NOT NULL DEFAULT '';
ALTER TABLE Workspaces ADD COLUMN DefaultDepartment TEXT NOT NULL DEFAULT '';
ALTER TABLE Workspaces ADD COLUMN AutoMarkPreviousVersionObsolete INTEGER NOT NULL DEFAULT 1
  CHECK (AutoMarkPreviousVersionObsolete IN (0, 1));

ALTER TABLE Documents ADD COLUMN LanguageId INTEGER REFERENCES Languages (Id) ON DELETE SET NULL;
ALTER TABLE Documents ADD COLUMN ConfidentialityClassId INTEGER REFERENCES ConfidentialityClasses (Id) ON DELETE SET NULL;
ALTER TABLE Documents ADD COLUMN ProjectId INTEGER REFERENCES Projects (Id) ON DELETE SET NULL;
ALTER TABLE Documents ADD COLUMN Company TEXT NOT NULL DEFAULT '';
ALTER TABLE Documents ADD COLUMN Department TEXT NOT NULL DEFAULT '';
ALTER TABLE Documents ADD COLUMN RevisionIntervalMonths INTEGER
  CHECK (RevisionIntervalMonths IS NULL OR RevisionIntervalMonths >= 1);

ALTER TABLE DocumentVersions ADD COLUMN ReleasedDate TEXT;
ALTER TABLE DocumentVersions ADD COLUMN ApprovedBy TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON Documents (ProjectId);
CREATE INDEX IF NOT EXISTS idx_documents_language_id ON Documents (LanguageId);
CREATE INDEX IF NOT EXISTS idx_documents_confidentiality_class_id ON Documents (ConfidentialityClassId);
