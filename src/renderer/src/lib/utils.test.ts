import { describe, expect, it } from 'vitest';
import { formatUserFacingError } from '@renderer/lib/utils';

describe('formatUserFacingError', () => {
  it('strips Electron IPC wrappers in production mode', () => {
    const error = new Error(
      "Error invoking remote method 'documentTypes:delete': Error: This document type is already used by documents and cannot be deleted."
    );

    expect(formatUserFacingError(error, 'Unable to delete document type.', { isDevelopment: false })).toBe(
      'This document type is already used by documents and cannot be deleted.'
    );
  });

  it('preserves detailed errors in development mode', () => {
    const error = new Error(
      "Error invoking remote method 'documentTypes:delete': Error: This document type is already used by documents and cannot be deleted."
    );

    expect(formatUserFacingError(error, 'Unable to delete document type.', { isDevelopment: true })).toBe(
      "Error invoking remote method 'documentTypes:delete': Error: This document type is already used by documents and cannot be deleted."
    );
  });

  it('falls back to the provided message when no usable error exists', () => {
    expect(formatUserFacingError('oops', 'Unable to save document.')).toBe('Unable to save document.');
    expect(
      formatUserFacingError(new Error('   '), 'Unable to save document.', {
        isDevelopment: false
      })
    ).toBe('Unable to save document.');
  });
});
