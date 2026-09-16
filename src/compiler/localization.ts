import type { SiteLocale } from './config.js';

export function localize(value: unknown, locale: SiteLocale, fallback = '') {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return fallback;
  const translations = value as Partial<Record<SiteLocale, string>>;
  return translations[locale] || translations.zh || translations.en || fallback;
}

export function alternateRoute(route: string, locale: SiteLocale) {
  return route.replace(/^\/(zh|en)(?=\/)/, `/${locale}`);
}
