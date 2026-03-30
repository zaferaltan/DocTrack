ALTER TABLE Workspaces ADD COLUMN VersionManagementMode TEXT NOT NULL DEFAULT 'shared-document-id'
  CHECK (VersionManagementMode IN ('shared-document-id', 'version-specific-document-id'));

ALTER TABLE DocumentVersions ADD COLUMN VersionDocumentID TEXT;

UPDATE DocumentVersions
SET VersionDocumentID = (
  SELECT d.DocumentID
  FROM Documents d
  WHERE d.Id = DocumentVersions.DocumentId
)
WHERE VersionDocumentID IS NULL OR trim(VersionDocumentID) = '';

CREATE INDEX IF NOT EXISTS idx_document_versions_version_document_id
  ON DocumentVersions (VersionDocumentID);
