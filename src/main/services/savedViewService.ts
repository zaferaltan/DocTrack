import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { AppCatalogService } from '@main/catalog/appCatalogService';
import type { WorkspaceManager } from '@main/database/workspaceManager';
import { nowIso } from '@main/utils/date';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  getDashboardWidgetTypeLabel,
  normalizeDashboardLayout,
  normalizeSavedViewPresentation,
  normalizeSavedViewQuery,
  remapSavedViewStatuses,
  type DashboardLayout,
  type SavedView,
  type SavedViewStatusNameRemap
} from '@shared/savedViews';
import type {
  CreateSavedViewInput,
  DeleteSavedViewInput,
  DuplicateSavedViewInput,
  PromoteSavedViewToSharedInput,
  PromoteSavedViewToSharedResult,
  UpdateDashboardLayoutInput,
  UpdateSavedViewInput
} from '@shared/types';

interface SharedSavedViewRow {
  Id: string;
  Name: string;
  QueryJson: string;
  PresentationJson: string;
  CreatedDate: string;
  ModifiedDate: string;
}

interface DashboardWidgetRow {
  Id: string;
  WidgetType: string;
  Title: string;
  SavedViewId: string | null;
  ConfigJson: string;
  GridX: number;
  GridY: number;
  GridW: number;
  GridH: number;
}

export class SavedViewService {
  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly catalogService: AppCatalogService
  ) {}

  list(rootPath: string): SavedView[] {
    const personal = this.catalogService.listPersonalSavedViews(rootPath);
    const shared = this.listShared(rootPath);

    return [...shared, ...personal].sort((left, right) => {
      if (left.scope !== right.scope) {
        return left.scope === 'shared' ? -1 : 1;
      }

      return right.modifiedDate.localeCompare(left.modifiedDate) || left.name.localeCompare(right.name);
    });
  }

  create(rootPath: string, input: CreateSavedViewInput): SavedView {
    const savedView: SavedView = {
      id: randomUUID(),
      name: input.name.trim() || 'Untitled view',
      scope: input.scope,
      query: normalizeSavedViewQuery(input.query),
      presentation: normalizeSavedViewPresentation(input.presentation),
      createdDate: nowIso(),
      modifiedDate: nowIso()
    };

    if (savedView.scope === 'personal') {
      return this.catalogService.createPersonalSavedView(rootPath, savedView);
    }

    this.insertSharedSavedView(rootPath, savedView);
    return savedView;
  }

  update(
    rootPath: string,
    savedViewId: string,
    scope: SavedView['scope'],
    input: UpdateSavedViewInput
  ): SavedView {
    const existing = this.getSavedView(rootPath, savedViewId, scope);
    const nextSavedView: SavedView = {
      ...existing,
      name: input.name.trim() || existing.name,
      query: normalizeSavedViewQuery(input.query),
      presentation: normalizeSavedViewPresentation(input.presentation),
      modifiedDate: nowIso()
    };

    if (scope === 'personal') {
      return this.catalogService.updatePersonalSavedView(rootPath, nextSavedView);
    }

    this.workspaceManager
      .getContext(rootPath)
      .db.prepare(
        `
          UPDATE SavedViews
          SET
            Name = ?,
            QueryJson = ?,
            PresentationJson = ?,
            ModifiedDate = ?
          WHERE Id = ?
        `
      )
      .run(
        nextSavedView.name,
        JSON.stringify(nextSavedView.query),
        JSON.stringify(nextSavedView.presentation),
        nextSavedView.modifiedDate,
        nextSavedView.id
      );

    return nextSavedView;
  }

  delete(rootPath: string, input: DeleteSavedViewInput): void {
    if (input.scope === 'personal') {
      this.catalogService.deletePersonalSavedView(rootPath, input.savedViewId);
      return;
    }

    this.workspaceManager
      .getContext(rootPath)
      .db.prepare('DELETE FROM SavedViews WHERE Id = ?')
      .run(input.savedViewId);
  }

  remapSharedSavedViewStatuses(rootPath: string, remaps: SavedViewStatusNameRemap[]): SavedView[] {
    if (remaps.length === 0) {
      return this.listShared(rootPath);
    }

    const context = this.workspaceManager.getContext(rootPath);
    const sharedViews = this.listShared(rootPath);
    const updateSavedView = context.db.prepare(
      `
        UPDATE SavedViews
        SET
          QueryJson = ?,
          ModifiedDate = ?
        WHERE Id = ?
      `
    );
    const modifiedDate = nowIso();

    context.db.transaction(() => {
      for (const savedView of sharedViews) {
        const nextSavedView = remapSavedViewStatuses(savedView, remaps);
        updateSavedView.run(
          JSON.stringify(nextSavedView.query),
          modifiedDate,
          nextSavedView.id
        );
      }
    })();

    return this.listShared(rootPath);
  }

  duplicate(rootPath: string, input: DuplicateSavedViewInput): SavedView {
    const source = this.getSavedView(rootPath, input.savedViewId, input.scope);
    return this.create(rootPath, {
      name: input.name?.trim() || `${source.name} Copy`,
      scope: input.scope,
      query: source.query,
      presentation: source.presentation
    });
  }

  promoteToShared(
    rootPath: string,
    input: PromoteSavedViewToSharedInput
  ): PromoteSavedViewToSharedResult {
    const existingShared = this.listShared(rootPath).find((item) => item.id === input.savedViewId);
    if (existingShared) {
      return { savedView: existingShared };
    }

    const personalView = this.catalogService
      .listPersonalSavedViews(rootPath)
      .find((item) => item.id === input.savedViewId);
    if (!personalView) {
      throw new Error('The selected saved view could not be found.');
    }

    const savedView = this.create(rootPath, {
      name: personalView.name,
      scope: 'shared',
      query: personalView.query,
      presentation: personalView.presentation
    });

    return { savedView };
  }

  getDashboardLayout(rootPath: string): DashboardLayout {
    const context = this.workspaceManager.getContext(rootPath);
    this.ensureDashboardLayoutSeeded(context.db);

    const rows = context.db
      .prepare(
        `
          SELECT
            Id,
            WidgetType,
            Title,
            SavedViewId,
            ConfigJson,
            GridX,
            GridY,
            GridW,
            GridH
          FROM DashboardWidgets
          ORDER BY GridY ASC, GridX ASC, Title ASC
        `
      )
      .all() as DashboardWidgetRow[];

    return normalizeDashboardLayout({
      widgets: rows.map((row) => ({
        id: row.Id,
        type: row.WidgetType,
        title: row.Title,
        savedViewId: row.SavedViewId,
        config: this.parseJsonRecord(row.ConfigJson),
        x: row.GridX,
        y: row.GridY,
        w: row.GridW,
        h: row.GridH
      }))
    });
  }

  updateDashboardLayout(rootPath: string, input: UpdateDashboardLayoutInput): DashboardLayout {
    const context = this.workspaceManager.getContext(rootPath);
    const nextLayout = normalizeDashboardLayout(input.layout);
    const sharedSavedViewIds = new Set(this.listShared(rootPath).map((item) => item.id));

    for (const widget of nextLayout.widgets) {
      if (widget.type !== 'savedView') {
        continue;
      }

      if (!widget.savedViewId || !sharedSavedViewIds.has(widget.savedViewId)) {
        throw new Error('Saved view widgets can only reference shared saved views.');
      }
    }

    const timestamp = nowIso();
    const replaceLayout = context.db.transaction(() => {
      context.db.prepare('DELETE FROM DashboardWidgets').run();
      const insert = context.db.prepare(
        `
          INSERT INTO DashboardWidgets (
            Id,
            WidgetType,
            Title,
            SavedViewId,
            ConfigJson,
            GridX,
            GridY,
            GridW,
            GridH,
            CreatedDate,
            ModifiedDate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const widget of nextLayout.widgets) {
        insert.run(
          widget.id,
          widget.type,
          widget.title || getDashboardWidgetTypeLabel(widget.type),
          widget.savedViewId,
          JSON.stringify(widget.config),
          widget.x,
          widget.y,
          widget.w,
          widget.h,
          timestamp,
          timestamp
        );
      }
    });

    replaceLayout();
    return this.getDashboardLayout(rootPath);
  }

  private getSavedView(
    rootPath: string,
    savedViewId: string,
    scope: SavedView['scope']
  ): SavedView {
    if (scope === 'personal') {
      const savedView = this.catalogService
        .listPersonalSavedViews(rootPath)
        .find((item) => item.id === savedViewId);
      if (!savedView) {
        throw new Error('The selected saved view could not be found.');
      }

      return savedView;
    }

    const savedView = this.listShared(rootPath).find((item) => item.id === savedViewId);
    if (!savedView) {
      throw new Error('The selected saved view could not be found.');
    }

    return savedView;
  }

  private listShared(rootPath: string): SavedView[] {
    const context = this.workspaceManager.getContext(rootPath);
    const rows = context.db
      .prepare(
        `
          SELECT
            Id,
            Name,
            QueryJson,
            PresentationJson,
            CreatedDate,
            ModifiedDate
          FROM SavedViews
          ORDER BY ModifiedDate DESC, Name ASC
        `
      )
      .all() as SharedSavedViewRow[];

    return rows.map((row) => ({
      id: row.Id,
      name: row.Name,
      scope: 'shared',
      query: normalizeSavedViewQuery(this.parseJsonValue(row.QueryJson)),
      presentation: normalizeSavedViewPresentation(this.parseJsonValue(row.PresentationJson)),
      createdDate: row.CreatedDate,
      modifiedDate: row.ModifiedDate
    }));
  }

  private insertSharedSavedView(rootPath: string, savedView: SavedView): void {
    this.workspaceManager
      .getContext(rootPath)
      .db.prepare(
        `
          INSERT INTO SavedViews (
            Id,
            Name,
            QueryJson,
            PresentationJson,
            CreatedDate,
            ModifiedDate
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        savedView.id,
        savedView.name,
        JSON.stringify(savedView.query),
        JSON.stringify(savedView.presentation),
        savedView.createdDate,
        savedView.modifiedDate
      );
  }

  private ensureDashboardLayoutSeeded(db: Database.Database): void {
    const row = db
      .prepare('SELECT COUNT(*) AS Count FROM DashboardWidgets')
      .get() as { Count: number } | undefined;
    if ((row?.Count ?? 0) > 0) {
      return;
    }

    const timestamp = nowIso();
    const insert = db.prepare(
      `
        INSERT INTO DashboardWidgets (
          Id,
          WidgetType,
          Title,
          SavedViewId,
          ConfigJson,
          GridX,
          GridY,
          GridW,
          GridH,
          CreatedDate,
          ModifiedDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const widget of DEFAULT_DASHBOARD_LAYOUT.widgets) {
      insert.run(
        widget.id,
        widget.type,
        widget.title,
        widget.savedViewId,
        JSON.stringify(widget.config),
        widget.x,
        widget.y,
        widget.w,
        widget.h,
        timestamp,
        timestamp
      );
    }
  }

  private parseJsonValue(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private parseJsonRecord(value: string): Record<string, string | number | boolean | null> {
    const parsed = this.parseJsonValue(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string | number | boolean | null>)
      : {};
  }
}
