ALTER TABLE Workspaces ADD COLUMN ActivityLogEnabled INTEGER NOT NULL DEFAULT 1
  CHECK (ActivityLogEnabled IN (0, 1));

ALTER TABLE Workspaces ADD COLUMN ActivityLogMaxRows INTEGER NOT NULL DEFAULT 5000
  CHECK (ActivityLogMaxRows >= 1);
