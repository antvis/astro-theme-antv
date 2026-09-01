const localized = (value: unknown, locale: SiteLocale, fallback: string) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return fallback;
  const translations = value as Partial<Record<SiteLocale, string>>;
  return translations[locale] || translations.zh || translations.en || fallback;
};

export type SiteLocale = 'zh' | 'en';
export type LocalizedValue = string | Partial<Record<SiteLocale, string>> | null | undefined;

export function localize(value: unknown, locale: SiteLocale, fallback = '') {
  return localized(value, locale, fallback);
}

export function alternateRoute(route: string, locale: SiteLocale) {
  return route.replace(/^\/(zh|en)(?=\/)/, `/${locale}`);
}
