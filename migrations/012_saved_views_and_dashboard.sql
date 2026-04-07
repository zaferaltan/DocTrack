CREATE TABLE IF NOT EXISTS SavedViews (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  QueryJson TEXT NOT NULL,
  PresentationJson TEXT NOT NULL,
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS DashboardWidgets (
  Id TEXT PRIMARY KEY,
  WidgetType TEXT NOT NULL
    CHECK (
      WidgetType IN (
        'filesystemAttention',
        'statusSummary',
        'healthInsights',
        'typeGrouping',
        'projectGrouping',
        'recentActivity',
        'savedView'
      )
    ),
  Title TEXT NOT NULL DEFAULT '',
  SavedViewId TEXT REFERENCES SavedViews (Id) ON DELETE CASCADE,
  ConfigJson TEXT NOT NULL DEFAULT '{}',
  GridX INTEGER NOT NULL DEFAULT 0 CHECK (GridX >= 0),
  GridY INTEGER NOT NULL DEFAULT 0 CHECK (GridY >= 0),
  GridW INTEGER NOT NULL DEFAULT 4 CHECK (GridW >= 1),
  GridH INTEGER NOT NULL DEFAULT 2 CHECK (GridH >= 1),
  CreatedDate TEXT NOT NULL,
  ModifiedDate TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_views_modified_date ON SavedViews (ModifiedDate DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_grid ON DashboardWidgets (GridY ASC, GridX ASC);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_saved_view_id ON DashboardWidgets (SavedViewId);
