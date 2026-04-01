CREATE TABLE IF NOT EXISTS ActivityLog (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  EventType TEXT NOT NULL,
  Message TEXT NOT NULL,
  DocumentRecordId INTEGER REFERENCES Documents (Id) ON DELETE SET NULL,
  DocumentVersionId INTEGER REFERENCES DocumentVersions (Id) ON DELETE SET NULL,
  CreatedDate TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS IgnoredUnmanagedPaths (
  DocumentVersionId INTEGER NOT NULL REFERENCES DocumentVersions (Id) ON DELETE CASCADE,
  RelativePath TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  PRIMARY KEY (DocumentVersionId, RelativePath)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_date ON ActivityLog (CreatedDate DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_document_record_id ON ActivityLog (DocumentRecordId);
CREATE INDEX IF NOT EXISTS idx_activity_log_document_version_id ON ActivityLog (DocumentVersionId);
