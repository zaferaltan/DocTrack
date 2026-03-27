CREATE TABLE IF NOT EXISTS Workspaces (
  Id INTEGER PRIMARY KEY CHECK (Id = 1),
  Name TEXT NOT NULL,
  FilePath TEXT NOT NULL,
  RootPath TEXT NOT NULL,
  StorageLayoutPreset TEXT NOT NULL DEFAULT 'stable-id'
    CHECK (StorageLayoutPreset IN ('stable-id', 'friendly-id')),
  FileOrganizationMode TEXT NOT NULL DEFAULT 'flat'
    CHECK (FileOrganizationMode IN ('flat', 'role-subfolders')),
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
  VersionScheme TEXT NOT NULL
    CHECK (VersionScheme IN ('numeric-3', 'v-prefix', 'major-minor')),
  DocumentFolderPath TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL,
  Author TEXT NOT NULL,
  CHECK (length(DocumentID) = 11 AND DocumentID NOT GLOB '*[^0-9]*')
);

CREATE TABLE IF NOT EXISTS DocumentVersions (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DocumentId INTEGER NOT NULL REFERENCES Documents (Id) ON DELETE CASCADE,
  SequenceNumber INTEGER NOT NULL CHECK (SequenceNumber >= 1),
  VersionLabel TEXT NOT NULL,
  Status TEXT NOT NULL REFERENCES Statuses (Name) ON UPDATE CASCADE,
  CreatedDate TEXT NOT NULL,
  Notes TEXT NOT NULL DEFAULT '',
  UNIQUE (DocumentId, SequenceNumber),
  UNIQUE (DocumentId, VersionLabel)
);

CREATE TABLE IF NOT EXISTS DocumentVersionFiles (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  DocumentVersionId INTEGER NOT NULL REFERENCES DocumentVersions (Id) ON DELETE CASCADE,
  Role TEXT NOT NULL CHECK (Role IN ('working', 'concept-pdf', 'final-pdf', 'other')),
  FileName TEXT NOT NULL,
  FilePath TEXT NOT NULL,
  ContentHash TEXT NOT NULL,
  FileSize INTEGER NOT NULL DEFAULT 0,
  ModifiedDate TEXT NOT NULL,
  CreatedDate TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON Documents (DocumentTypeId);
CREATE INDEX IF NOT EXISTS idx_documents_document_id ON Documents (DocumentID);
CREATE INDEX IF NOT EXISTS idx_documents_modified_date ON Documents (ModifiedDate DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON DocumentVersions (DocumentId);
CREATE INDEX IF NOT EXISTS idx_document_versions_status ON DocumentVersions (Status);
CREATE INDEX IF NOT EXISTS idx_document_version_files_version_id ON DocumentVersionFiles (DocumentVersionId);
CREATE INDEX IF NOT EXISTS idx_document_version_files_content_hash ON DocumentVersionFiles (ContentHash);
