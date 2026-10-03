import { applyTenantCopy, tenantCopyOverrides } from './tenantCopy';

type LocaleModule = { readonly default: Record<string, unknown> };
type LocaleLoader = () => Promise<LocaleModule>;

const localeLoaders: Readonly<Record<string, LocaleLoader>> = {
  en: () => import('@/locales/en.json'),
  de: () => import('@/locales/de.json'),
  tr: () => import('@/locales/tr.json'),
  it: () => import('@/locales/it.json'),
  ar: () => import('@/locales/ar.json'),
  fr: () => import('@/locales/fr.json'),
  nl: () => import('@/locales/nl.json'),
  es: () => import('@/locales/es.json'),
  ru: () => import('@/locales/ru.json'),
  zh: () => import('@/locales/zh.json'),
};

export function normalizeBundleLocale(locale: string): string {
  const baseLocale = locale.toLowerCase().split('-')[0];
  return Object.hasOwn(localeLoaders, baseLocale) ? baseLocale : 'en';
}

/** Load one locale on demand so unrelated routes do not ship every translation bundle. */
export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  const resolvedLocale = normalizeBundleLocale(locale);
  const localeResource = await localeLoaders[resolvedLocale]();
  return applyTenantCopy(localeResource.default, tenantCopyOverrides(resolvedLocale));
}
