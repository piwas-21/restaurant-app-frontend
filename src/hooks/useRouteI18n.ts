import { useMemo } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import baseI18n, { primeLocaleMessages } from '../i18n';

/** Seed SSR copy before creating a route instance, then keep that instance stable for this locale. */
export function useRouteI18n(routeLocale?: string, initialLocaleMessages?: Record<string, unknown>): I18nInstance {
  if (routeLocale && initialLocaleMessages) {
    primeLocaleMessages(routeLocale, initialLocaleMessages);
  }

  return useMemo(() => (routeLocale ? baseI18n.cloneInstance({ lng: routeLocale }) : baseI18n), [routeLocale]);
}
