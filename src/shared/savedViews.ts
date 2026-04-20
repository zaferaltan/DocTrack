import type { DocumentsVisualizationMode } from '@shared/applicationSettings';
import type { DocumentTableColumn } from '@shared/workspaceLayout';

export const SAVED_VIEW_SCOPES = ['personal', 'shared'] as const;
export const SAVED_VIEW_RULE_FIELDS = [
  'documentType',
  'status',
  'group',
  'project',
  'language',
  'confidentialityClass',
  'author',
  'company',
  'department',
  'reviewedBy',
  'approvedBy',
  'latestVersion',
  'healthFlag',
  'createdDate',
  'modifiedDate',
  'releasedDate',
  'effectiveDate',
  'startDate',
  'nextReviewDate'
] as const;
export const SAVED_VIEW_RULE_OPERATORS = [
  'is',
  'isNot',
  'contains',
  'isEmpty',
  'isNotEmpty',
  'before',
  'after',
  'between',
  'withinLastDays',
  'thisMonth'
] as const;
export const DASHBOARD_WIDGET_TYPES = [
  'filesystemAttention',
  'statusSummary',
  'healthInsights',
  'typeGrouping',
  'groupGrouping',
  'projectGrouping',
  'recentActivity',
  'savedView'
] as const;
export const SAVED_VIEW_HEALTH_FLAG_VALUES = [
  'overdueReview',
  'missingFiles',
  'unversionedShell',
  'unmanagedPaths',
  'staleDocument'
] as const;

export type SavedViewScope = (typeof SAVED_VIEW_SCOPES)[number];
export type SavedViewRuleField = (typeof SAVED_VIEW_RULE_FIELDS)[number];
export type SavedViewRuleOperator = (typeof SAVED_VIEW_RULE_OPERATORS)[number];
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];
export type SavedViewStatusValue = string;
export type SavedViewHealthFlagValue = (typeof SAVED_VIEW_HEALTH_FLAG_VALUES)[number];
export type SavedViewStatusFilter = string;
export type SavedViewHealthFilter = SavedViewHealthFlagValue | 'All';

export interface SavedViewSort {
  column: DocumentTableColumn;
  desc: boolean;
}

export interface SavedViewRule {
  id: string;
  field: SavedViewRuleField;
  operator: SavedViewRuleOperator;
  value?: string;
  secondaryValue?: string;
  amount?: number;
}

export interface SavedViewQuery {
  search: string;
  statusFilter: SavedViewStatusFilter;
  groupFilter: string;
  projectFilter: string;
  healthFilter: SavedViewHealthFilter;
  rules: SavedViewRule[];
}

export interface SavedViewPresentation {
  visualizationMode: DocumentsVisualizationMode;
  sorting: SavedViewSort[];
}

export interface DocumentViewState {
  search: string;
  statusFilter: SavedViewStatusFilter;
  groupFilter: string;
  projectFilter: string;
  healthFilter: SavedViewHealthFilter;
  rules: SavedViewRule[];
  sorting: SavedViewSort[];
}

export interface SavedView {
  id: string;
  name: string;
  scope: SavedViewScope;
  query: SavedViewQuery;
  presentation: SavedViewPresentation;
  createdDate: string;
  modifiedDate: string;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, string | number | boolean | null>;
  savedViewId: string | null;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
}

export interface SavedViewDocumentCandidate {
  id: number;
  documentId: string;
  title: string;
  typeName: string;
  status: SavedViewStatusValue | null;
  latestVersionLabel: string | null;
  effectiveDate: string | null;
  releasedDate: string | null;
  approvedBy: string;
  revisionDescription: string;
  modifiedDate: string;
  createdDate: string;
  author: string;
  languageCode: string | null;
  confidentialityClassName: string | null;
  groupId: number | null;
  groupName: string | null;
  projectId: number | null;
  projectName: string | null;
  company: string;
  department: string;
  startDate: string;
  nextReviewDate: string | null;
  healthFlags: SavedViewHealthFlagValue[];
  reviewedBy: string;
}

export interface SavedViewStatusNameRemap {
  from: string;
  to: string;
}

const DEFAULT_SAVED_VIEW_QUERY: SavedViewQuery = {
  search: '',
  statusFilter: 'All',
  groupFilter: 'All',
  projectFilter: 'All',
  healthFilter: 'All',
  rules: []
};

export const DEFAULT_SAVED_VIEW_PRESENTATION: SavedViewPresentation = {
  visualizationMode: 'table',
  sorting: []
};

export const DEFAULT_DOCUMENT_VIEW_STATE: DocumentViewState = {
  search: '',
  statusFilter: 'All',
  groupFilter: 'All',
  projectFilter: 'All',
  healthFilter: 'All',
  rules: [],
  sorting: []
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    {
      id: 'status-summary',
      type: 'statusSummary',
      title: 'Status Summary',
      x: 0,
      y: 0,
      w: 12,
      h: 2,
      config: {},
      savedViewId: null
    },
    {
      id: 'filesystem-attention',
      type: 'filesystemAttention',
      title: 'Filesystem Attention',
      x: 0,
      y: 2,
      w: 12,
      h: 1,
      config: {},
      savedViewId: null
    },
    {
      id: 'health-insights',
      type: 'healthInsights',
      title: 'Document Health',
      x: 0,
      y: 3,
      w: 4,
      h: 3,
      config: {},
      savedViewId: null
    },
    {
      id: 'type-grouping',
      type: 'typeGrouping',
      title: 'Document Types',
      x: 4,
      y: 3,
      w: 4,
      h: 3,
      config: {},
      savedViewId: null
    },
    {
      id: 'group-grouping',
      type: 'groupGrouping',
      title: 'Groups',
      x: 8,
      y: 3,
      w: 4,
      h: 3,
      config: {},
      savedViewId: null
    },
    {
      id: 'recent-activity',
      type: 'recentActivity',
      title: 'Recent Activity',
      x: 0,
      y: 6,
      w: 12,
      h: 3,
      config: {},
      savedViewId: null
    }
  ]
};

export const isSavedViewScope = (value: string): value is SavedViewScope =>
  SAVED_VIEW_SCOPES.includes(value as SavedViewScope);

export const isSavedViewRuleField = (value: string): value is SavedViewRuleField =>
  SAVED_VIEW_RULE_FIELDS.includes(value as SavedViewRuleField);

export const isSavedViewRuleOperator = (value: string): value is SavedViewRuleOperator =>
  SAVED_VIEW_RULE_OPERATORS.includes(value as SavedViewRuleOperator);

export const isDashboardWidgetType = (value: string): value is DashboardWidgetType =>
  DASHBOARD_WIDGET_TYPES.includes(value as DashboardWidgetType);

export const normalizeSavedViewQuery = (value: unknown): SavedViewQuery => {
  const candidate = value && typeof value === 'object' ? (value as Partial<SavedViewQuery>) : {};

  return {
    search: typeof candidate.search === 'string' ? candidate.search : DEFAULT_SAVED_VIEW_QUERY.search,
    statusFilter: normalizeSavedViewStatusFilter(candidate.statusFilter),
    groupFilter:
      typeof candidate.groupFilter === 'string'
        ? candidate.groupFilter
        : DEFAULT_SAVED_VIEW_QUERY.groupFilter,
    projectFilter:
      typeof candidate.projectFilter === 'string'
        ? candidate.projectFilter
        : DEFAULT_SAVED_VIEW_QUERY.projectFilter,
    healthFilter: normalizeSavedViewHealthFilter(candidate.healthFilter),
    rules: normalizeSavedViewRules(candidate.rules)
  };
};

export const normalizeSavedViewPresentation = (value: unknown): SavedViewPresentation => {
  const candidate =
    value && typeof value === 'object' ? (value as Partial<SavedViewPresentation>) : {};

  return {
    visualizationMode:
      candidate.visualizationMode === 'kanban' ||
      candidate.visualizationMode === 'timeline' ||
      candidate.visualizationMode === 'calendar' ||
      candidate.visualizationMode === 'table'
        ? candidate.visualizationMode
        : DEFAULT_SAVED_VIEW_PRESENTATION.visualizationMode,
    sorting: normalizeSavedViewSorting(candidate.sorting)
  };
};

export const normalizeDocumentViewState = (value: unknown): DocumentViewState => {
  const candidate = value && typeof value === 'object' ? (value as Partial<DocumentViewState>) : {};

  return {
    search:
      typeof candidate.search === 'string' ? candidate.search : DEFAULT_DOCUMENT_VIEW_STATE.search,
    statusFilter: normalizeSavedViewStatusFilter(candidate.statusFilter),
    groupFilter:
      typeof candidate.groupFilter === 'string'
        ? candidate.groupFilter
        : DEFAULT_DOCUMENT_VIEW_STATE.groupFilter,
    projectFilter:
      typeof candidate.projectFilter === 'string'
        ? candidate.projectFilter
        : DEFAULT_DOCUMENT_VIEW_STATE.projectFilter,
    healthFilter: normalizeSavedViewHealthFilter(candidate.healthFilter),
    rules: normalizeSavedViewRules(candidate.rules),
    sorting: normalizeSavedViewSorting(candidate.sorting)
  };
};

export const normalizeSavedView = (
  value: unknown,
  scopeFallback: SavedViewScope = 'personal'
): SavedView | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<SavedView>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name.trim() || 'Untitled view',
    scope:
      typeof candidate.scope === 'string' && isSavedViewScope(candidate.scope)
        ? candidate.scope
        : scopeFallback,
    query: normalizeSavedViewQuery(candidate.query),
    presentation: normalizeSavedViewPresentation(candidate.presentation),
    createdDate: typeof candidate.createdDate === 'string' ? candidate.createdDate : '',
    modifiedDate: typeof candidate.modifiedDate === 'string' ? candidate.modifiedDate : ''
  };
};

export const normalizeSavedViews = (
  value: unknown,
  scopeFallback: SavedViewScope = 'personal'
): SavedView[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSavedView(item, scopeFallback))
    .filter((item): item is SavedView => item !== null)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
};

export const normalizeDashboardLayout = (value: unknown): DashboardLayout => {
  const candidate = value && typeof value === 'object' ? (value as Partial<DashboardLayout>) : {};
  return {
    widgets: normalizeDashboardWidgets(candidate.widgets)
  };
};

export const normalizeDashboardWidgets = (value: unknown): DashboardWidget[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeDashboardWidget(item))
    .filter((item): item is DashboardWidget => item !== null)
    .sort((left, right) => left.y - right.y || left.x - right.x || left.title.localeCompare(right.title));
};

export const normalizeDashboardWidget = (value: unknown): DashboardWidget | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<DashboardWidget>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.type !== 'string' ||
    !isDashboardWidgetType(candidate.type)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    title: candidate.title.trim() || getDashboardWidgetTypeLabel(candidate.type),
    x: normalizeGridNumber(candidate.x, 0),
    y: normalizeGridNumber(candidate.y, 0),
    w: Math.max(1, normalizeGridNumber(candidate.w, 4)),
    h: Math.max(1, normalizeGridNumber(candidate.h, 2)),
    config: normalizeWidgetConfig(candidate.config),
    savedViewId: typeof candidate.savedViewId === 'string' ? candidate.savedViewId : null
  };
};

export const getDashboardWidgetTypeLabel = (type: DashboardWidgetType): string => {
  switch (type) {
    case 'filesystemAttention':
      return 'Filesystem Attention';
    case 'statusSummary':
      return 'Status Summary';
    case 'healthInsights':
      return 'Document Health';
    case 'typeGrouping':
      return 'Document Types';
    case 'groupGrouping':
      return 'Groups';
    case 'projectGrouping':
      return 'Projects';
    case 'recentActivity':
      return 'Recent Activity';
    case 'savedView':
      return 'Saved View';
  }
};

export const matchesSavedViewQuery = (
  document: SavedViewDocumentCandidate,
  query: SavedViewQuery
): boolean => {
  if (!matchesSavedViewSearch(document, query.search)) {
    return false;
  }

  if (!matchesQuickFilters(document, query)) {
    return false;
  }

  return query.rules.every((rule) => matchesSavedViewRule(document, rule));
};

export const filterDocumentsBySavedViewQuery = <T extends SavedViewDocumentCandidate>(
  documents: T[],
  query: SavedViewQuery
): T[] => documents.filter((document) => matchesSavedViewQuery(document, query));

export const sortDocumentsBySavedView = <T extends SavedViewDocumentCandidate>(
  documents: T[],
  sorting: SavedViewSort[]
): T[] => {
  if (sorting.length === 0) {
    return [...documents];
  }

  return [...documents].sort((left, right) => {
    for (const entry of sorting) {
      const result = compareSortValues(
        getDocumentSortValue(left, entry.column),
        getDocumentSortValue(right, entry.column)
      );
      if (result !== 0) {
        return entry.desc ? -result : result;
      }
    }

    return 0;
  });
};

export const applySavedViewToDocuments = <T extends SavedViewDocumentCandidate>(
  documents: T[],
  savedView: Pick<SavedView, 'query' | 'presentation'>
): T[] => sortDocumentsBySavedView(filterDocumentsBySavedViewQuery(documents, savedView.query), savedView.presentation.sorting);

export const buildDocumentViewStateFromSavedView = (
  savedView: Pick<SavedView, 'query' | 'presentation'>
): DocumentViewState => ({
  search: savedView.query.search,
  statusFilter: savedView.query.statusFilter,
  groupFilter: savedView.query.groupFilter,
  projectFilter: savedView.query.projectFilter,
  healthFilter: savedView.query.healthFilter,
  rules: savedView.query.rules,
  sorting: savedView.presentation.sorting
});

export const remapSavedViewQueryStatuses = (
  query: SavedViewQuery,
  remaps: SavedViewStatusNameRemap[]
): SavedViewQuery => {
  if (remaps.length === 0) {
    return query;
  }

  const remapByFrom = new Map(remaps.map((remap) => [remap.from, remap.to]));
  const remapStatusValue = (value: string | undefined): string | undefined => {
    if (typeof value !== 'string') {
      return value;
    }

    if (value === 'All' || value === 'Not started') {
      return value;
    }

    return remapByFrom.get(value) ?? value;
  };

  return {
    ...query,
    statusFilter: remapStatusValue(query.statusFilter) ?? query.statusFilter,
    rules: query.rules.map((rule) =>
      rule.field === 'status'
        ? {
            ...rule,
            value: remapStatusValue(rule.value),
            secondaryValue: remapStatusValue(rule.secondaryValue)
          }
        : rule
    )
  };
};

export const remapSavedViewStatuses = (
  savedView: SavedView,
  remaps: SavedViewStatusNameRemap[]
): SavedView => ({
  ...savedView,
  query: remapSavedViewQueryStatuses(savedView.query, remaps)
});

const normalizeSavedViewStatusFilter = (value: unknown): SavedViewStatusFilter => {
  if (typeof value !== 'string') {
    return DEFAULT_SAVED_VIEW_QUERY.statusFilter;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SAVED_VIEW_QUERY.statusFilter;
};

const normalizeSavedViewHealthFilter = (value: unknown): SavedViewHealthFilter => {
  if (value === 'All') {
    return value;
  }

  return typeof value === 'string' &&
    SAVED_VIEW_HEALTH_FLAG_VALUES.includes(value as SavedViewHealthFlagValue)
    ? (value as SavedViewHealthFilter)
    : DEFAULT_SAVED_VIEW_QUERY.healthFilter;
};

const normalizeSavedViewSorting = (value: unknown): SavedViewSort[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<SavedViewSort>;
      if (
        typeof candidate.column !== 'string' ||
        !isDocumentTableColumn(candidate.column) ||
        typeof candidate.desc !== 'boolean'
      ) {
        return null;
      }

      return {
        column: candidate.column,
        desc: candidate.desc
      };
    })
    .filter((item): item is SavedViewSort => item !== null);
};

const normalizeSavedViewRules = (value: unknown): SavedViewRule[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeSavedViewRule(item, index))
    .filter((item): item is SavedViewRule => item !== null);
};

const normalizeSavedViewRule = (value: unknown, index: number): SavedViewRule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<SavedViewRule>;
  if (
    typeof candidate.field !== 'string' ||
    !isSavedViewRuleField(candidate.field) ||
    typeof candidate.operator !== 'string' ||
    !isSavedViewRuleOperator(candidate.operator)
  ) {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' ? candidate.id : `rule-${index + 1}`,
    field: candidate.field,
    operator: candidate.operator,
    value: typeof candidate.value === 'string' ? candidate.value : undefined,
    secondaryValue:
      typeof candidate.secondaryValue === 'string' ? candidate.secondaryValue : undefined,
    amount:
      typeof candidate.amount === 'number' && Number.isFinite(candidate.amount)
        ? Math.max(0, Math.round(candidate.amount))
        : undefined
  };
};

const normalizeWidgetConfig = (
  value: unknown
): Record<string, string | number | boolean | null> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    )
  );
};

const normalizeGridNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;

const matchesSavedViewSearch = (
  document: SavedViewDocumentCandidate,
  rawSearch: string
): boolean => {
  const search = rawSearch.trim().toLowerCase();
  if (!search) {
    return true;
  }

  const haystack = [
    document.documentId,
    document.title,
    document.typeName,
    document.author,
    document.status ?? '',
    document.languageCode ?? '',
    document.confidentialityClassName ?? '',
    document.groupName ?? '',
    document.projectName ?? '',
    document.company,
    document.department,
    document.startDate,
    document.reviewedBy,
    document.approvedBy,
    document.revisionDescription
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(search);
};

const matchesQuickFilters = (
  document: SavedViewDocumentCandidate,
  query: SavedViewQuery
): boolean => {
  const matchesStatus =
    query.statusFilter === 'All'
      ? true
      : query.statusFilter === 'Not started'
        ? document.status === null
        : document.status === query.statusFilter;
  const matchesGroup =
    query.groupFilter === 'All' || String(document.groupId ?? '') === query.groupFilter;
  const matchesProject =
    query.projectFilter === 'All' || String(document.projectId ?? '') === query.projectFilter;
  const matchesHealth =
    query.healthFilter === 'All' || document.healthFlags.includes(query.healthFilter);

  return matchesStatus && matchesGroup && matchesProject && matchesHealth;
};

const matchesSavedViewRule = (
  document: SavedViewDocumentCandidate,
  rule: SavedViewRule
): boolean => {
  if (rule.field === 'healthFlag') {
    const value = rule.value?.trim();
    if (!value || !SAVED_VIEW_HEALTH_FLAG_VALUES.includes(value as SavedViewHealthFlagValue)) {
      return false;
    }

    const hasFlag = document.healthFlags.includes(value as SavedViewHealthFlagValue);
    return rule.operator === 'is' ? hasFlag : rule.operator === 'isNot' ? !hasFlag : false;
  }

  const rawValue = getRuleFieldValue(document, rule.field);

  switch (rule.operator) {
    case 'is':
      return normalizeComparableValue(rawValue) === normalizeComparableValue(rule.value ?? '');
    case 'isNot':
      return normalizeComparableValue(rawValue) !== normalizeComparableValue(rule.value ?? '');
    case 'contains':
      return normalizeComparableValue(rawValue).includes(normalizeComparableValue(rule.value ?? ''));
    case 'isEmpty':
      return normalizeComparableValue(rawValue).length === 0;
    case 'isNotEmpty':
      return normalizeComparableValue(rawValue).length > 0;
    case 'before':
      return compareDates(rawValue, rule.value) < 0;
    case 'after':
      return compareDates(rawValue, rule.value) > 0;
    case 'between': {
      const left = compareDates(rawValue, rule.value);
      const right = compareDates(rawValue, rule.secondaryValue);
      return left >= 0 && right <= 0;
    }
    case 'withinLastDays': {
      if (typeof rule.amount !== 'number' || rule.amount < 0) {
        return false;
      }

      const targetDate = parseDateValue(rawValue);
      if (!targetDate) {
        return false;
      }

      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - rule.amount);
      return targetDate.getTime() >= cutoff.getTime();
    }
    case 'thisMonth': {
      const targetDate = parseDateValue(rawValue);
      if (!targetDate) {
        return false;
      }

      const now = new Date();
      return (
        targetDate.getUTCFullYear() === now.getUTCFullYear() &&
        targetDate.getUTCMonth() === now.getUTCMonth()
      );
    }
  }
};

const getRuleFieldValue = (
  document: SavedViewDocumentCandidate,
  field: SavedViewRuleField
): string | null => {
  switch (field) {
    case 'documentType':
      return document.typeName;
    case 'status':
      return document.status ?? 'Not started';
    case 'group':
      return document.groupName ?? (document.groupId === null ? 'No group' : null);
    case 'project':
      return document.projectName ?? (document.projectId === null ? 'No project' : null);
    case 'language':
      return document.languageCode;
    case 'confidentialityClass':
      return document.confidentialityClassName;
    case 'author':
      return document.author;
    case 'company':
      return document.company;
    case 'department':
      return document.department;
    case 'reviewedBy':
      return document.reviewedBy;
    case 'approvedBy':
      return document.approvedBy;
    case 'latestVersion':
      return document.latestVersionLabel;
    case 'createdDate':
      return document.createdDate;
    case 'modifiedDate':
      return document.modifiedDate;
    case 'releasedDate':
      return document.releasedDate;
    case 'effectiveDate':
      return document.effectiveDate;
    case 'startDate':
      return document.startDate;
    case 'nextReviewDate':
      return document.nextReviewDate;
    case 'healthFlag':
      return null;
  }
};

const normalizeComparableValue = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const parseDateValue = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const compareDates = (left: string | null | undefined, right: string | null | undefined): number => {
  const leftDate = parseDateValue(left);
  const rightDate = parseDateValue(right);
  if (!leftDate || !rightDate) {
    return Number.NaN;
  }

  return leftDate.getTime() - rightDate.getTime();
};

const isDocumentTableColumn = (value: string): value is DocumentTableColumn =>
  [
    'documentId',
    'title',
    'documentType',
    'version',
    'status',
    'author',
    'language',
    'confidentialityClass',
    'group',
    'project',
    'company',
    'department',
    'startDate',
    'createdDate',
    'modifiedDate',
    'releasedDate',
    'reviewedBy',
    'approvedBy',
    'revisionIntervalMonths',
    'revisionDescription'
  ].includes(value);

const getDocumentSortValue = (
  document: SavedViewDocumentCandidate,
  column: DocumentTableColumn
): string | number => {
  switch (column) {
    case 'documentId':
      return document.documentId;
    case 'title':
      return document.title;
    case 'documentType':
      return document.typeName;
    case 'version':
      return document.latestVersionLabel ?? '';
    case 'status':
      return document.status ?? '';
    case 'author':
      return document.author;
    case 'language':
      return document.languageCode ?? '';
    case 'confidentialityClass':
      return document.confidentialityClassName ?? '';
    case 'group':
      return document.groupName ?? '';
    case 'project':
      return document.projectName ?? '';
    case 'company':
      return document.company;
    case 'department':
      return document.department;
    case 'startDate':
      return document.startDate;
    case 'createdDate':
      return document.createdDate;
    case 'modifiedDate':
      return document.modifiedDate;
    case 'releasedDate':
      return document.releasedDate ?? '';
    case 'reviewedBy':
      return document.reviewedBy;
    case 'approvedBy':
      return document.approvedBy;
    case 'revisionIntervalMonths':
      return -1;
    case 'revisionDescription':
      return document.revisionDescription;
  }
};

const compareSortValues = (left: string | number, right: string | number): number => {
  if (typeof left === 'number' || typeof right === 'number') {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};
