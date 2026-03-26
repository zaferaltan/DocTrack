import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

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
