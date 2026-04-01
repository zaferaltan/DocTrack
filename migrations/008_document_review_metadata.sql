ALTER TABLE Documents ADD COLUMN StartDate TEXT;

UPDATE Documents
SET StartDate = substr(CreatedDate, 1, 10)
WHERE StartDate IS NULL OR trim(StartDate) = '';

ALTER TABLE DocumentVersions ADD COLUMN ReviewedBy TEXT NOT NULL DEFAULT '';

UPDATE Workspaces
SET VisibleDocumentColumns = '["documentId","title","documentType","version","status","author","language","confidentialityClass","project","company","department","startDate","createdDate","modifiedDate","releasedDate","reviewedBy","approvedBy","revisionIntervalMonths","revisionDescription"]'
WHERE VisibleDocumentColumns IS NULL OR trim(VisibleDocumentColumns) = '';

UPDATE Workspaces
SET VisibleDocumentColumns = substr(VisibleDocumentColumns, 1, length(VisibleDocumentColumns) - 1) || ',"startDate"]'
WHERE VisibleDocumentColumns NOT LIKE '%"startDate"%';

UPDATE Workspaces
SET VisibleDocumentColumns = substr(VisibleDocumentColumns, 1, length(VisibleDocumentColumns) - 1) || ',"reviewedBy"]'
WHERE VisibleDocumentColumns NOT LIKE '%"reviewedBy"%';
