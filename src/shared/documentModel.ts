export const DOCUMENT_VERSION_SCHEMES = [
  'numeric-3',
  'v-prefix',
  'alpha-uppercase',
  'major-minor'
] as const;

export const MAX_ALPHA_UPPERCASE_VERSION_COUNT = 26;

export type DocumentVersionScheme = (typeof DOCUMENT_VERSION_SCHEMES)[number];

export const DOCUMENT_VERSION_SCHEME_LABELS: Record<DocumentVersionScheme, string> = {
  'numeric-3': '001, 002, 003',
  'v-prefix': 'v1, v2, v3',
  'alpha-uppercase': 'A, B, C',
  'major-minor': '1.0, 1.1, 2.0'
};

export const DOCUMENT_VERSION_FILE_ROLES = [
  'working',
  'concept-pdf',
  'final-pdf',
  'other'
] as const;

export type DocumentVersionFileRole = (typeof DOCUMENT_VERSION_FILE_ROLES)[number];

export const DOCUMENT_VERSION_FILE_ROLE_LABELS: Record<DocumentVersionFileRole, string> = {
  working: 'Working',
  'concept-pdf': 'Concept PDF',
  'final-pdf': 'Final PDF',
  other: 'Other'
};

export const VERSION_BUMP_TYPES = ['major', 'minor'] as const;

export type VersionBumpType = (typeof VERSION_BUMP_TYPES)[number];

export const isDocumentVersionScheme = (value: string): value is DocumentVersionScheme =>
  DOCUMENT_VERSION_SCHEMES.includes(value as DocumentVersionScheme);

export const getAlphaUppercaseVersionLabel = (sequenceNumber: number): string => {
  if (
    !Number.isInteger(sequenceNumber) ||
    sequenceNumber < 1 ||
    sequenceNumber > MAX_ALPHA_UPPERCASE_VERSION_COUNT
  ) {
    throw new Error(
      `Alphabetic version labels support ${MAX_ALPHA_UPPERCASE_VERSION_COUNT} versions from A to Z.`
    );
  }

  return String.fromCharCode('A'.charCodeAt(0) + sequenceNumber - 1);
};

export const isDocumentVersionFileRole = (value: string): value is DocumentVersionFileRole =>
  DOCUMENT_VERSION_FILE_ROLES.includes(value as DocumentVersionFileRole);

export const isVersionBumpType = (value: string): value is VersionBumpType =>
  VERSION_BUMP_TYPES.includes(value as VersionBumpType);
