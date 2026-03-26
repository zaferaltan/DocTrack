CREATE TABLE IF NOT EXISTS Workspaces (
  Id INTEGER PRIMARY KEY CHECK (Id = 1),
  Name TEXT NOT NULL,
  FilePath TEXT NOT NULL,
  CreatedDate TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Statuses (
  Id INTEGER PRIMARY KEY,
  Name TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO Statuses (Id, Name) VALUES
  (1, 'Draft'),
  (2, 'In Review'),
  (3, 'Released'),
  (4, 'Archived');

CREATE TABLE IF NOT EXISTS DocumentTypes (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL UNIQUE,
  NumberPrefix TEXT NOT NULL UNIQUE,
  CHECK (length(NumberPrefix) = 2 AND NumberPrefix NOT GLOB '*[^0-9]*')
);

CREATE TABLE IF NOT EXISTS Documents (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DocumentID TEXT NOT NULL UNIQUE,
  Title TEXT NOT NULL,
  DocumentTypeId INTEGER NOT NULL REFERENCES DocumentTypes (Id) ON DELETE RESTRICT,
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL,
  Author TEXT NOT NULL,
  CHECK (length(DocumentID) = 11 AND DocumentID NOT GLOB '*[^0-9]*')
);

CREATE TABLE IF NOT EXISTS DocumentVersions (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DocumentId INTEGER NOT NULL REFERENCES Documents (Id) ON DELETE CASCADE,
  VersionNumber INTEGER NOT NULL CHECK (VersionNumber >= 1),
  Status TEXT NOT NULL REFERENCES Statuses (Name) ON UPDATE CASCADE,
  FilePath TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  Notes TEXT NOT NULL DEFAULT '',
  UNIQUE (DocumentId, VersionNumber)
);

CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON Documents (DocumentTypeId);
CREATE INDEX IF NOT EXISTS idx_documents_document_id ON Documents (DocumentID);
CREATE INDEX IF NOT EXISTS idx_documents_modified_date ON Documents (ModifiedDate DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON DocumentVersions (DocumentId);
CREATE INDEX IF NOT EXISTS idx_document_versions_status ON DocumentVersions (Status);
