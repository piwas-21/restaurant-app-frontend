import type { i18n as I18nInstance } from 'i18next';
import { loadLazyLocaleBundle, type LocaleBundleLoaders } from '@/lib/loadLazyLocaleBundle';

const accountPaymentLocaleLoaders: LocaleBundleLoaders = {
  en: () => import('@/locales/account-payments/en.json'),
  de: () => import('@/locales/account-payments/de.json'),
  fr: () => import('@/locales/account-payments/fr.json'),
  nl: () => import('@/locales/account-payments/nl.json'),
  tr: () => import('@/locales/account-payments/tr.json'),
  ar: () => import('@/locales/account-payments/ar.json'),
  es: () => import('@/locales/account-payments/es.json'),
  it: () => import('@/locales/account-payments/it.json'),
  ru: () => import('@/locales/account-payments/ru.json'),
  zh: () => import('@/locales/account-payments/zh.json'),
};

export function loadAccountPaymentLocale(instance: I18nInstance, language: string | undefined): Promise<void> {
  return loadLazyLocaleBundle(instance, language, 'account-payments', accountPaymentLocaleLoaders);
}
