import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

const ELECTRON_REMOTE_METHOD_PREFIX = /^Error invoking remote method '[^']+':\s*/;
const LEADING_ERROR_PREFIXES = /^(?:Error:\s*)+/;

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
  options: { isDevelopment?: boolean } = {}
): string => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const rawMessage = error.message.trim();
  if (!rawMessage) {
    return fallbackMessage;
  }

  const isDevelopment = options.isDevelopment ?? import.meta.env.DEV;
  if (isDevelopment) {
    return rawMessage;
  }

  const sanitizedMessage = rawMessage
    .replace(ELECTRON_REMOTE_METHOD_PREFIX, '')
    .replace(LEADING_ERROR_PREFIXES, '')
    .trim();

  return sanitizedMessage || fallbackMessage;
};
