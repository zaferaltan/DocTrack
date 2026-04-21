import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export interface UserFacingErrorResult {
  userMessage: string;
  diagnosticMessage?: string;
  code?: string;
}

const ELECTRON_IPC_WRAPPER = /^Error invoking remote method '[^']+':\s*/;
const LEADING_ERROR_PREFIXES = /^(?:Error:\s*)+/;
const UNIQUE_CONSTRAINT = /UNIQUE constraint failed/i;
const FOREIGN_KEY_CONSTRAINT = /FOREIGN KEY constraint failed/i;
const SERVICE_UNAVAILABLE = /\bservice is unavailable\.?/i;

const TECHNICAL_INDICATORS: RegExp[] = [
  /SqliteError/i,
  /SQLite Error/i,
  /UNIQUE constraint/i,
  /FOREIGN KEY constraint/i,
  /SQLITE_/,
  /better-sqlite3/i,
];

function containsTechnicalContent(message: string): boolean {
  return TECHNICAL_INDICATORS.some((pattern) => pattern.test(message));
}

function stripTransportWrappers(message: string): string {
  return message
    .replace(ELECTRON_IPC_WRAPPER, '')
    .replace(LEADING_ERROR_PREFIXES, '')
    .trim();
}

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const formatDateTime = (value: string): string => {
  try {
    return format(new Date(value), 'dd MMM yyyy, HH:mm');
  } catch {
    return value;
  }
};

export const formatDateShort = (value: string): string => {
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
};

export const formatUserFacingError = (
  error: unknown,
  fallbackMessage: string,
  options?: { isDevelopment?: boolean }
): UserFacingErrorResult => {
  void options;

  if (!(error instanceof Error)) {
    return { userMessage: fallbackMessage };
  }

  const rawMessage = error.message.trim();
  if (!rawMessage) {
    return { userMessage: fallbackMessage };
  }

  if (UNIQUE_CONSTRAINT.test(rawMessage)) {
    return {
      userMessage: 'That value is already in use. Choose a different one and try again.',
      diagnosticMessage: rawMessage,
      code: 'duplicate_record',
    };
  }

  if (FOREIGN_KEY_CONSTRAINT.test(rawMessage)) {
    return {
      userMessage: fallbackMessage,
      diagnosticMessage: rawMessage,
      code: 'invalid_input',
    };
  }

  if (SERVICE_UNAVAILABLE.test(rawMessage)) {
    return {
      userMessage: 'That action is temporarily unavailable. Please try again.',
      diagnosticMessage: rawMessage,
      code: 'unknown',
    };
  }

  const stripped = stripTransportWrappers(rawMessage);

  if (!stripped) {
    return { userMessage: fallbackMessage };
  }

  if (containsTechnicalContent(stripped)) {
    return {
      userMessage: fallbackMessage,
      diagnosticMessage: rawMessage,
      code: 'unknown',
    };
  }

  return {
    userMessage: stripped,
    diagnosticMessage: rawMessage !== stripped ? rawMessage : undefined,
  };
};

export const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  formatUserFacingError(error, fallbackMessage).userMessage;
