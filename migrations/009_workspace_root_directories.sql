ALTER TABLE Workspaces ADD COLUMN DatabaseDirectoryName TEXT NOT NULL DEFAULT 'Database';
ALTER TABLE Workspaces ADD COLUMN DocumentsDirectoryName TEXT NOT NULL DEFAULT 'Documents';
ALTER TABLE Workspaces ADD COLUMN TemplatesDirectoryName TEXT NOT NULL DEFAULT 'Templates';
ALTER TABLE Workspaces ADD COLUMN BackupsDirectoryName TEXT NOT NULL DEFAULT 'Backups';
