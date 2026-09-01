const base = import.meta.env.BASE_URL;
const basePrefix = base === '/' ? '' : base.replace(/\/$/, '');

const hasScheme = (value: string) => /^[a-z][a-z\d+.-]*:/i.test(value);

export const withBase = (value: string): string => {
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('//') ||
    hasScheme(value)
  ) {
    return value;
  }
  if (!value.startsWith('/')) return value;
  if (basePrefix && (value === basePrefix || value.startsWith(`${basePrefix}/`))) {
    return value;
  }
  return `${basePrefix}${value}` || '/';
};
