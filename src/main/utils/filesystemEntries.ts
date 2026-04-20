import path from 'node:path';

const TRANSIENT_OFFICE_LOCK_FILE_EXTENSIONS = new Set([
  '.doc',
  '.docm',
  '.docx',
  '.dot',
  '.dotm',
  '.dotx',
  '.odt',
  '.odp',
  '.ods',
  '.otp',
  '.ots',
  '.ott',
  '.pot',
  '.potm',
  '.potx',
  '.pps',
  '.ppsm',
  '.ppsx',
  '.ppt',
  '.pptm',
  '.pptx',
  '.rtf',
  '.xls',
  '.xlsb',
  '.xlsm',
  '.xlsx',
  '.xlt',
  '.xltm',
  '.xltx'
]);

const WORD_PROCESSING_FILE_EXTENSIONS = new Set([
  '.doc',
  '.docm',
  '.docx',
  '.dot',
  '.dotm',
  '.dotx',
  '.odt',
  '.ott',
  '.rtf'
]);

export const isIgnoredWorkspaceFilesystemEntryName = (name: string): boolean => {
  if (name.startsWith('.') && name !== '.' && name !== '..') {
    return true;
  }

  const normalizedName = name.toLowerCase();
  return (
    (
      normalizedName.startsWith('~$') &&
      TRANSIENT_OFFICE_LOCK_FILE_EXTENSIONS.has(path.extname(normalizedName))
    ) ||
    (normalizedName.startsWith('~wr') && path.extname(normalizedName) === '.tmp')
  );
};

// Content-only changes at the same path (same name, same location, different bytes) are never
// surfaced as drift warnings. Only structural changes — renames, moves, removals — matter to
// DocTrack. This applies to all file types, not just word-processing documents.
export const shouldIgnoreTrackedFileContentDrift = (_fileName: string): boolean => true;
