ALTER TABLE Statuses ADD COLUMN Key TEXT;
ALTER TABLE Statuses ADD COLUMN SortOrder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE Statuses ADD COLUMN SemanticRole TEXT NOT NULL DEFAULT 'draft'
  CHECK (SemanticRole IN ('draft', 'review', 'released', 'archived', 'obsolete'));
ALTER TABLE Statuses ADD COLUMN RequiresReleasedDate INTEGER NOT NULL DEFAULT 0
  CHECK (RequiresReleasedDate IN (0, 1));
ALTER TABLE Statuses ADD COLUMN RequiresReviewedBy INTEGER NOT NULL DEFAULT 0
  CHECK (RequiresReviewedBy IN (0, 1));
ALTER TABLE Statuses ADD COLUMN RequiresApprovedBy INTEGER NOT NULL DEFAULT 0
  CHECK (RequiresApprovedBy IN (0, 1));

UPDATE Statuses
SET
  Key = CASE Name
    WHEN 'Draft' THEN 'draft'
    WHEN 'In Review' THEN 'in-review'
    WHEN 'Released' THEN 'released'
    WHEN 'Archived' THEN 'archived'
    WHEN 'Obsolete' THEN 'obsolete'
    ELSE lower(replace(trim(Name), ' ', '-'))
  END,
  SortOrder = CASE Name
    WHEN 'Draft' THEN 0
    WHEN 'In Review' THEN 1
    WHEN 'Released' THEN 2
    WHEN 'Archived' THEN 3
    WHEN 'Obsolete' THEN 4
    ELSE SortOrder
  END,
  SemanticRole = CASE Name
    WHEN 'Draft' THEN 'draft'
    WHEN 'In Review' THEN 'review'
    WHEN 'Released' THEN 'released'
    WHEN 'Archived' THEN 'archived'
    WHEN 'Obsolete' THEN 'obsolete'
    ELSE 'draft'
  END,
  RequiresReleasedDate = 0,
  RequiresReviewedBy = 0,
  RequiresApprovedBy = 0
WHERE Key IS NULL OR trim(Key) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_statuses_key ON Statuses (Key);
CREATE INDEX IF NOT EXISTS idx_statuses_sort_order ON Statuses (SortOrder ASC, Name ASC);

ALTER TABLE Workspaces ADD COLUMN LifecycleMode TEXT NOT NULL DEFAULT 'default'
  CHECK (LifecycleMode IN ('default', 'custom'));
ALTER TABLE Workspaces ADD COLUMN InitialStatusKey TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE Workspaces ADD COLUMN AutoPreviousVersionStatusKey TEXT DEFAULT 'obsolete';

CREATE TABLE IF NOT EXISTS StatusTransitions (
  FromStatusKey TEXT NOT NULL REFERENCES Statuses (Key) ON UPDATE CASCADE ON DELETE CASCADE,
  ToStatusKey TEXT NOT NULL REFERENCES Statuses (Key) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (FromStatusKey, ToStatusKey),
  CHECK (FromStatusKey <> ToStatusKey)
);

INSERT OR IGNORE INTO StatusTransitions (FromStatusKey, ToStatusKey) VALUES
  ('draft', 'in-review'),
  ('draft', 'released'),
  ('draft', 'archived'),
  ('draft', 'obsolete'),
  ('in-review', 'draft'),
  ('in-review', 'released'),
  ('in-review', 'archived'),
  ('in-review', 'obsolete'),
  ('released', 'draft'),
  ('released', 'in-review'),
  ('released', 'archived'),
  ('released', 'obsolete'),
  ('archived', 'draft'),
  ('archived', 'in-review'),
  ('archived', 'released'),
  ('archived', 'obsolete'),
  ('obsolete', 'draft'),
  ('obsolete', 'in-review'),
  ('obsolete', 'released'),
  ('obsolete', 'archived');
