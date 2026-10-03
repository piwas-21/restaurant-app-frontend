import type { i18n as I18nInstance } from 'i18next';
import { loadLazyLocaleBundle, type LocaleBundleLoaders } from '@/lib/loadLazyLocaleBundle';

const tableGuestLocaleLoaders: LocaleBundleLoaders = {
  en: () => import('@/locales/table-guest/en.json'),
  fr: () => import('@/locales/table-guest/fr.json'),
  de: () => import('@/locales/table-guest/de.json'),
  nl: () => import('@/locales/table-guest/nl.json'),
  tr: () => import('@/locales/table-guest/tr.json'),
  ar: () => import('@/locales/table-guest/ar.json'),
  es: () => import('@/locales/table-guest/es.json'),
  it: () => import('@/locales/table-guest/it.json'),
  ru: () => import('@/locales/table-guest/ru.json'),
  zh: () => import('@/locales/table-guest/zh.json'),
};

export function loadTableGuestLocale(instance: I18nInstance, language: string | undefined): Promise<void> {
  return loadLazyLocaleBundle(instance, language, 'tableGuest', tableGuestLocaleLoaders);
}
