export const WORKSPACE_LIFECYCLE_MODES = ['default', 'custom'] as const;
export const DOCUMENT_STATUS_ROLES = [
  'draft',
  'review',
  'released',
  'archived',
  'obsolete'
] as const;

export type WorkspaceLifecycleMode = (typeof WORKSPACE_LIFECYCLE_MODES)[number];
export type DocumentStatusRole = (typeof DOCUMENT_STATUS_ROLES)[number];

export interface WorkspaceStatusDefinition {
  key: string;
  name: string;
  role: DocumentStatusRole;
  sortOrder: number;
  requiresReleasedDate: boolean;
  requiresReviewedBy: boolean;
  requiresApprovedBy: boolean;
}

export interface WorkspaceStatusTransition {
  fromStatusKey: string;
  toStatusKey: string;
}

export interface WorkspaceLifecycle {
  mode: WorkspaceLifecycleMode;
  statuses: WorkspaceStatusDefinition[];
  initialStatusKey: string;
  autoPreviousVersionStatusKey: string | null;
  allowedTransitions: WorkspaceStatusTransition[];
}

export interface LifecycleMetadataState {
  releasedDate: string | null;
  reviewedBy: string;
  approvedBy: string;
}

const DEFAULT_STATUS_DEFINITIONS: WorkspaceStatusDefinition[] = [
  {
    key: 'draft',
    name: 'Draft',
    role: 'draft',
    sortOrder: 0,
    requiresReleasedDate: false,
    requiresReviewedBy: false,
    requiresApprovedBy: false
  },
  {
    key: 'in-review',
    name: 'In Review',
    role: 'review',
    sortOrder: 1,
    requiresReleasedDate: false,
    requiresReviewedBy: false,
    requiresApprovedBy: false
  },
  {
    key: 'released',
    name: 'Released',
    role: 'released',
    sortOrder: 2,
    requiresReleasedDate: false,
    requiresReviewedBy: false,
    requiresApprovedBy: false
  },
  {
    key: 'archived',
    name: 'Archived',
    role: 'archived',
    sortOrder: 3,
    requiresReleasedDate: false,
    requiresReviewedBy: false,
    requiresApprovedBy: false
  },
  {
    key: 'obsolete',
    name: 'Obsolete',
    role: 'obsolete',
    sortOrder: 4,
    requiresReleasedDate: false,
    requiresReviewedBy: false,
    requiresApprovedBy: false
  }
];

const buildPermissiveTransitions = (
  statuses: WorkspaceStatusDefinition[]
): WorkspaceStatusTransition[] =>
  statuses.flatMap((fromStatus) =>
    statuses
      .filter((toStatus) => toStatus.key !== fromStatus.key)
      .map((toStatus) => ({
        fromStatusKey: fromStatus.key,
        toStatusKey: toStatus.key
      }))
  );

export const DEFAULT_WORKSPACE_LIFECYCLE: WorkspaceLifecycle = {
  mode: 'default',
  statuses: DEFAULT_STATUS_DEFINITIONS,
  initialStatusKey: 'draft',
  autoPreviousVersionStatusKey: 'obsolete',
  allowedTransitions: buildPermissiveTransitions(DEFAULT_STATUS_DEFINITIONS)
};

export const DEFAULT_DOCUMENT_STATUSES = DEFAULT_WORKSPACE_LIFECYCLE.statuses.map(
  (status) => status.name
);

const RESERVED_STATUS_NAMES = new Set(['all', 'not started']);

const cloneStatuses = (statuses: WorkspaceStatusDefinition[]): WorkspaceStatusDefinition[] =>
  statuses
    .map((status) => ({ ...status }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

const cloneTransitions = (
  transitions: WorkspaceStatusTransition[]
): WorkspaceStatusTransition[] => transitions.map((transition) => ({ ...transition }));

const isLifecycleMode = (value: string): value is WorkspaceLifecycleMode =>
  WORKSPACE_LIFECYCLE_MODES.includes(value as WorkspaceLifecycleMode);

export const isDocumentStatusRole = (value: string): value is DocumentStatusRole =>
  DOCUMENT_STATUS_ROLES.includes(value as DocumentStatusRole);

export const createDefaultWorkspaceLifecycle = (): WorkspaceLifecycle => ({
  mode: 'default',
  statuses: cloneStatuses(DEFAULT_WORKSPACE_LIFECYCLE.statuses),
  initialStatusKey: DEFAULT_WORKSPACE_LIFECYCLE.initialStatusKey,
  autoPreviousVersionStatusKey: DEFAULT_WORKSPACE_LIFECYCLE.autoPreviousVersionStatusKey,
  allowedTransitions: cloneTransitions(DEFAULT_WORKSPACE_LIFECYCLE.allowedTransitions)
});

export const normalizeWorkspaceLifecycle = (value: unknown): WorkspaceLifecycle => {
  if (!value || typeof value !== 'object') {
    return createDefaultWorkspaceLifecycle();
  }

  const candidate = value as Partial<WorkspaceLifecycle>;
  const mode =
    typeof candidate.mode === 'string' && isLifecycleMode(candidate.mode)
      ? candidate.mode
      : 'default';

  if (mode === 'default') {
    return createDefaultWorkspaceLifecycle();
  }

  const statuses = Array.isArray(candidate.statuses)
    ? candidate.statuses
        .map((status, index) => normalizeWorkspaceStatusDefinition(status, index))
        .filter((status): status is WorkspaceStatusDefinition => status !== null)
    : [];
  const statusKeys = new Set(statuses.map((status) => status.key));
  const allowedTransitions = Array.isArray(candidate.allowedTransitions)
    ? candidate.allowedTransitions
        .map((transition) => normalizeWorkspaceStatusTransition(transition))
        .filter((transition): transition is WorkspaceStatusTransition => transition !== null)
        .filter(
          (transition, index, transitions) =>
            statusKeys.has(transition.fromStatusKey) &&
            statusKeys.has(transition.toStatusKey) &&
            transitions.findIndex(
              (item) =>
                item.fromStatusKey === transition.fromStatusKey &&
                item.toStatusKey === transition.toStatusKey
            ) === index
        )
    : [];
  const firstStatusKey = statuses[0]?.key ?? '';
  const initialStatusKey =
    typeof candidate.initialStatusKey === 'string' ? candidate.initialStatusKey.trim() : firstStatusKey;
  const autoPreviousVersionStatusKey =
    typeof candidate.autoPreviousVersionStatusKey === 'string'
      ? candidate.autoPreviousVersionStatusKey.trim() || null
      : candidate.autoPreviousVersionStatusKey === null
        ? null
        : firstStatusKey || null;

  return {
    mode,
    statuses,
    initialStatusKey,
    autoPreviousVersionStatusKey,
    allowedTransitions
  };
};

const normalizeWorkspaceStatusDefinition = (
  value: unknown,
  index: number
): WorkspaceStatusDefinition | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorkspaceStatusDefinition>;
  const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!key || !name) {
    return null;
  }

  return {
    key,
    name,
    role:
      typeof candidate.role === 'string' && isDocumentStatusRole(candidate.role)
        ? candidate.role
        : 'draft',
    sortOrder:
      typeof candidate.sortOrder === 'number' && Number.isFinite(candidate.sortOrder)
        ? Math.max(0, Math.round(candidate.sortOrder))
        : index,
    requiresReleasedDate: Boolean(candidate.requiresReleasedDate),
    requiresReviewedBy: Boolean(candidate.requiresReviewedBy),
    requiresApprovedBy: Boolean(candidate.requiresApprovedBy)
  };
};

const normalizeWorkspaceStatusTransition = (
  value: unknown
): WorkspaceStatusTransition | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorkspaceStatusTransition>;
  const fromStatusKey =
    typeof candidate.fromStatusKey === 'string' ? candidate.fromStatusKey.trim() : '';
  const toStatusKey = typeof candidate.toStatusKey === 'string' ? candidate.toStatusKey.trim() : '';
  if (!fromStatusKey || !toStatusKey || fromStatusKey === toStatusKey) {
    return null;
  }

  return {
    fromStatusKey,
    toStatusKey
  };
};

export const validateWorkspaceLifecycle = (
  lifecycle: WorkspaceLifecycle,
  options?: {
    requireAutoPreviousVersionStatus?: boolean;
  }
): string[] => {
  if (lifecycle.mode === 'default') {
    return [];
  }

  const errors: string[] = [];
  if (lifecycle.statuses.length === 0) {
    errors.push('Add at least one lifecycle status.');
    return errors;
  }

  const statusByKey = new Map<string, WorkspaceStatusDefinition>();
  const statusNameKeys = new Set<string>();
  for (const status of lifecycle.statuses) {
    if (!status.key.trim()) {
      errors.push('Each lifecycle status needs a key.');
    }
    if (!status.name.trim()) {
      errors.push('Each lifecycle status needs a name.');
    }

    const normalizedName = status.name.trim().toLowerCase();
    if (RESERVED_STATUS_NAMES.has(normalizedName)) {
      errors.push(`"${status.name}" is reserved and cannot be used as a lifecycle status.`);
    }
    if (statusByKey.has(status.key)) {
      errors.push(`The lifecycle status key "${status.key}" is duplicated.`);
    }
    if (statusNameKeys.has(normalizedName)) {
      errors.push(`The lifecycle status name "${status.name}" is duplicated.`);
    }

    statusByKey.set(status.key, status);
    statusNameKeys.add(normalizedName);
  }

  if (!statusByKey.has(lifecycle.initialStatusKey)) {
    errors.push('Choose a valid initial lifecycle status.');
  }

  if (
    lifecycle.autoPreviousVersionStatusKey !== null &&
    !statusByKey.has(lifecycle.autoPreviousVersionStatusKey)
  ) {
    errors.push('Choose a valid previous-version lifecycle status.');
  }

  if (
    options?.requireAutoPreviousVersionStatus &&
    lifecycle.autoPreviousVersionStatusKey === null
  ) {
    errors.push('Choose a previous-version lifecycle status while auto-obsolete is enabled.');
  }

  const transitionKeys = new Set<string>();
  for (const transition of lifecycle.allowedTransitions) {
    if (!statusByKey.has(transition.fromStatusKey) || !statusByKey.has(transition.toStatusKey)) {
      errors.push('Lifecycle transitions must reference known statuses.');
      continue;
    }

    const signature = `${transition.fromStatusKey}->${transition.toStatusKey}`;
    if (transitionKeys.has(signature)) {
      errors.push('Duplicate lifecycle transitions are not allowed.');
      continue;
    }

    transitionKeys.add(signature);
  }

  return errors;
};

export const getWorkspaceLifecycleStatuses = (
  lifecycle: WorkspaceLifecycle
): WorkspaceStatusDefinition[] => cloneStatuses(lifecycle.statuses);

export const getWorkspaceLifecycleStatusNames = (lifecycle: WorkspaceLifecycle): string[] =>
  getWorkspaceLifecycleStatuses(lifecycle).map((status) => status.name);

export const getWorkspaceStatusByKey = (
  lifecycle: WorkspaceLifecycle,
  statusKey: string | null | undefined
): WorkspaceStatusDefinition | null => {
  if (!statusKey) {
    return null;
  }

  return lifecycle.statuses.find((status) => status.key === statusKey) ?? null;
};

export const getWorkspaceStatusByName = (
  lifecycle: WorkspaceLifecycle,
  statusName: string | null | undefined
): WorkspaceStatusDefinition | null => {
  if (!statusName) {
    return null;
  }

  return lifecycle.statuses.find((status) => status.name === statusName) ?? null;
};

export const isLifecycleStatusTerminal = (statusRole: DocumentStatusRole): boolean =>
  statusRole === 'archived' || statusRole === 'obsolete';

export const isLifecycleTransitionAllowed = (
  lifecycle: WorkspaceLifecycle,
  fromStatusName: string,
  toStatusName: string
): boolean => {
  const fromStatus = getWorkspaceStatusByName(lifecycle, fromStatusName);
  const toStatus = getWorkspaceStatusByName(lifecycle, toStatusName);
  if (!fromStatus || !toStatus) {
    return false;
  }

  if (fromStatus.key === toStatus.key) {
    return true;
  }

  if (lifecycle.mode === 'default') {
    return true;
  }

  return lifecycle.allowedTransitions.some(
    (transition) =>
      transition.fromStatusKey === fromStatus.key && transition.toStatusKey === toStatus.key
  );
};

export const getAllowedLifecycleTransitionTargets = (
  lifecycle: WorkspaceLifecycle,
  fromStatusName: string | null | undefined
): WorkspaceStatusDefinition[] => {
  if (!fromStatusName) {
    return [];
  }

  const fromStatus = getWorkspaceStatusByName(lifecycle, fromStatusName);
  if (!fromStatus) {
    return [];
  }

  if (lifecycle.mode === 'default') {
    return getWorkspaceLifecycleStatuses(lifecycle).filter((status) => status.key !== fromStatus.key);
  }

  const targetKeys = new Set(
    lifecycle.allowedTransitions
      .filter((transition) => transition.fromStatusKey === fromStatus.key)
      .map((transition) => transition.toStatusKey)
  );

  return getWorkspaceLifecycleStatuses(lifecycle).filter((status) => targetKeys.has(status.key));
};

export const getMissingLifecycleMetadata = (
  status: WorkspaceStatusDefinition,
  metadata: LifecycleMetadataState
): string[] => {
  const missing: string[] = [];
  if (status.requiresReleasedDate && !metadata.releasedDate) {
    missing.push('releasedDate');
  }
  if (status.requiresReviewedBy && !metadata.reviewedBy.trim()) {
    missing.push('reviewedBy');
  }
  if (status.requiresApprovedBy && !metadata.approvedBy.trim()) {
    missing.push('approvedBy');
  }
  return missing;
};

export const getLifecycleBadgeVariant = (
  role: DocumentStatusRole
): 'success' | 'warning' | 'muted' | 'default' => {
  switch (role) {
    case 'released':
      return 'success';
    case 'draft':
      return 'warning';
    case 'review':
      return 'default';
    case 'archived':
    case 'obsolete':
      return 'muted';
  }
};

export const getLifecycleDashboardTone = (
  role: DocumentStatusRole
): 'default' | 'success' | 'warning' | 'danger' => {
  switch (role) {
    case 'released':
      return 'success';
    case 'draft':
    case 'review':
      return 'warning';
    case 'obsolete':
      return 'danger';
    case 'archived':
      return 'default';
  }
};

