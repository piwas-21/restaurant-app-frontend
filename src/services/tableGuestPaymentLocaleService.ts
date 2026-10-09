import type { i18n as I18nInstance } from 'i18next';
import { loadLazyLocaleBundle, type LocaleBundleLoaders } from '@/lib/loadLazyLocaleBundle';

const paymentLoaders: LocaleBundleLoaders = {
  en: () => import('@/locales/table-guest-payments/en.json'),
  fr: () => import('@/locales/table-guest-payments/fr.json'),
  de: () => import('@/locales/table-guest-payments/de.json'),
  nl: () => import('@/locales/table-guest-payments/nl.json'),
  tr: () => import('@/locales/table-guest-payments/tr.json'),
  ar: () => import('@/locales/table-guest-payments/ar.json'),
  es: () => import('@/locales/table-guest-payments/es.json'),
  it: () => import('@/locales/table-guest-payments/it.json'),
  ru: () => import('@/locales/table-guest-payments/ru.json'),
  zh: () => import('@/locales/table-guest-payments/zh.json'),
};

export function loadTableGuestPaymentLocale(instance: I18nInstance, language: string | undefined): Promise<void> {
  return loadLazyLocaleBundle(instance, language, 'tableGuestPayments', paymentLoaders);
}
