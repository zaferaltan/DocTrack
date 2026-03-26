export const nowIso = (): string => new Date().toISOString();

export const getYearString = (value: string | Date): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return String(date.getUTCFullYear());
};
