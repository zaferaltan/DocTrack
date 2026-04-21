import { describe, expect, it } from 'vitest';
import { formatUserFacingError } from '@renderer/lib/utils';

describe('formatUserFacingError', () => {
  it('strips Electron IPC wrapper text', () => {
    const error = new Error(
      "Error invoking remote method 'documentTypes:delete': Error: This document type is already used by documents and cannot be deleted."
    );
    const result = formatUserFacingError(error, 'Unable to delete document type.');
    expect(result.userMessage).toBe(
      'This document type is already used by documents and cannot be deleted.'
    );
  });

  it('strips repeated Error: prefixes', () => {
    const error = new Error('Error: Error: Something went wrong.');
    const result = formatUserFacingError(error, 'Unable to complete the action.');
    expect(result.userMessage).toBe('Something went wrong.');
  });

  it('rewrites SqliteError UNIQUE constraint failed into a friendly message', () => {
    const error = new Error('SqliteError: UNIQUE constraint failed: WorkspaceUsers.Username');
    const result = formatUserFacingError(error, 'Unable to create user.');
    expect(result.userMessage).toBe(
      'That value is already in use. Choose a different one and try again.'
    );
    expect(result.code).toBe('duplicate_record');
    expect(result.diagnosticMessage).toBe(
      'SqliteError: UNIQUE constraint failed: WorkspaceUsers.Username'
    );
  });

  it('rewrites IPC-wrapped UNIQUE constraint into a friendly message', () => {
    const error = new Error(
      "Error invoking remote method 'workspace:recoverAccess': SqliteError: UNIQUE constraint failed: WorkspaceUsers.Username"
    );
    const result = formatUserFacingError(error, 'Unable to recover access.');
    expect(result.userMessage).toBe(
      'That value is already in use. Choose a different one and try again.'
    );
    expect(result.code).toBe('duplicate_record');
  });

  it('falls back to caller fallback for SQLite Error variants that are not user friendly', () => {
    const error = new Error(
      "Error invoking remote method 'workspace:update': SqliteError: database disk image is malformed"
    );
    const result = formatUserFacingError(error, 'Unable to save workspace settings.');
    expect(result.userMessage).toBe('Unable to save workspace settings.');
    expect(result.diagnosticMessage).toBe(
      "Error invoking remote method 'workspace:update': SqliteError: database disk image is malformed"
    );
    expect(result.code).toBe('unknown');
  });

  it('translates service unavailable errors into a friendly message', () => {
    const error = new Error('Workspace user service is unavailable.');
    const result = formatUserFacingError(error, 'Unable to complete the action.');
    expect(result.userMessage).toBe('That action is temporarily unavailable. Please try again.');
    expect(result.code).toBe('unknown');
    expect(result.diagnosticMessage).toBe('Workspace user service is unavailable.');
  });

  it('translates IPC-wrapped service unavailable errors into a friendly message', () => {
    const error = new Error(
      "Error invoking remote method 'app:update': Workspace session service is unavailable."
    );
    const result = formatUserFacingError(error, 'Unable to check for updates.');
    expect(result.userMessage).toBe('That action is temporarily unavailable. Please try again.');
    expect(result.code).toBe('unknown');
  });

  it('preserves friendly domain messages unchanged', () => {
    const error = new Error('Incorrect username or password.');
    const result = formatUserFacingError(error, 'Unable to sign in.');
    expect(result.userMessage).toBe('Incorrect username or password.');
    expect(result.diagnosticMessage).toBeUndefined();
    expect(result.code).toBeUndefined();
  });

  it('preserves domain messages that name the conflicting value in user-friendly terms', () => {
    const error = new Error('A workspace user with the username "admin" already exists.');
    const result = formatUserFacingError(error, 'Unable to recover access.');
    expect(result.userMessage).toBe('A workspace user with the username "admin" already exists.');
    expect(result.diagnosticMessage).toBeUndefined();
  });

  it('falls back to the caller-provided fallback when the error is not an Error instance', () => {
    expect(formatUserFacingError('oops', 'Unable to save document.').userMessage).toBe(
      'Unable to save document.'
    );
    expect(formatUserFacingError(null, 'Unable to save document.').userMessage).toBe(
      'Unable to save document.'
    );
    expect(formatUserFacingError(undefined, 'Unable to save document.').userMessage).toBe(
      'Unable to save document.'
    );
  });

  it('falls back to the caller-provided fallback when the error message is empty or whitespace', () => {
    expect(
      formatUserFacingError(new Error('   '), 'Unable to save document.').userMessage
    ).toBe('Unable to save document.');
    expect(
      formatUserFacingError(new Error(''), 'Unable to save document.').userMessage
    ).toBe('Unable to save document.');
  });

  it('returns the same visible userMessage in development and production modes', () => {
    const error = new Error(
      "Error invoking remote method 'documentTypes:delete': Error: This document type is already used by documents and cannot be deleted."
    );
    const devResult = formatUserFacingError(error, 'Unable to delete document type.', {
      isDevelopment: true
    });
    const prodResult = formatUserFacingError(error, 'Unable to delete document type.', {
      isDevelopment: false
    });
    expect(devResult.userMessage).toBe(prodResult.userMessage);
    expect(devResult.userMessage).toBe(
      'This document type is already used by documents and cannot be deleted.'
    );
  });

  it('retains diagnostic detail separately when the IPC wrapper was stripped', () => {
    const error = new Error(
      "Error invoking remote method 'workspace:save': Error: Unable to save the workspace settings."
    );
    const result = formatUserFacingError(error, 'Unable to save.');
    expect(result.userMessage).toBe('Unable to save the workspace settings.');
    expect(result.diagnosticMessage).toBe(
      "Error invoking remote method 'workspace:save': Error: Unable to save the workspace settings."
    );
  });

  it('omits diagnosticMessage when the raw message is already user-friendly with no wrappers', () => {
    const error = new Error('Select at least one file to add.');
    const result = formatUserFacingError(error, 'Unable to add files.');
    expect(result.userMessage).toBe('Select at least one file to add.');
    expect(result.diagnosticMessage).toBeUndefined();
  });
});
