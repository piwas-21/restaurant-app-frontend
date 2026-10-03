import type { i18n as I18nInstance } from 'i18next';
import { loadLazyLocaleBundle, type LocaleBundleLoaders } from './loadLazyLocaleBundle';

export interface OrderWorkspaceLocaleBundle {
  readonly orderAmendments: Readonly<Record<string, string>>;
  readonly serverOrders: Readonly<Record<string, string>>;
}

const orderWorkspaceCopyLoaders: LocaleBundleLoaders = {
  en: () => import('@/locales/order-workspace/en.json'),
  de: () => import('@/locales/order-workspace/de.json'),
  tr: () => import('@/locales/order-workspace/tr.json'),
  it: () => import('@/locales/order-workspace/it.json'),
  ar: () => import('@/locales/order-workspace/ar.json'),
  fr: () => import('@/locales/order-workspace/fr.json'),
  nl: () => import('@/locales/order-workspace/nl.json'),
  es: () => import('@/locales/order-workspace/es.json'),
  ru: () => import('@/locales/order-workspace/ru.json'),
  zh: () => import('@/locales/order-workspace/zh.json'),
};

export function loadOrderWorkspaceTranslations(instance: I18nInstance, language: string | undefined): Promise<void> {
  return loadLazyLocaleBundle(instance, language, 'order-workspace', orderWorkspaceCopyLoaders);
}
