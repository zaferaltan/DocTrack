ALTER TABLE Workspaces ADD COLUMN RootPath TEXT NOT NULL DEFAULT '';
ALTER TABLE Workspaces ADD COLUMN StorageLayoutPreset TEXT NOT NULL DEFAULT 'stable-id'
  CHECK (StorageLayoutPreset IN ('stable-id', 'friendly-id'));

ALTER TABLE Documents ADD COLUMN DocumentFolderPath TEXT NOT NULL DEFAULT '';
