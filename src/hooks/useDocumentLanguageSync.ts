import { useEffect } from 'react';
import type { i18n as I18nInstance } from 'i18next';
import type { LanguageCode } from '@/config/languageConfig';
import { baseLanguage, directionFor } from '@/lib/textDirection';
import { persistTenantLocalePreference } from '@/lib/tenantLocalePreferences';
import { changeLocaleWhenReady, notifyLocaleLoadFailure } from '@/lib/changeLocaleWhenReady';

/** Keeps resolved document language separate from the one-shot route locale load. */
export function useDocumentLanguageSync(
  i18n: I18nInstance,
  baseI18n: I18nInstance,
  routeLocale?: LanguageCode | null,
): void {
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', baseLanguage(activeLanguage));
    root.setAttribute('dir', directionFor(activeLanguage));
  }, [activeLanguage]);

  useEffect(() => {
    if (!routeLocale) return;

    let current = true;
    const targets = i18n === baseI18n ? [i18n] : [i18n, baseI18n];
    void Promise.all(targets.map((target) => changeLocaleWhenReady(target, routeLocale, routeLocale))).then((ready) => {
      if (!current) return;
      if (ready.some((result) => !result)) {
        notifyLocaleLoadFailure(routeLocale);
        return;
      }

      persistTenantLocalePreference(routeLocale);
      document.documentElement.setAttribute('lang', baseLanguage(routeLocale));
      document.documentElement.setAttribute('dir', directionFor(routeLocale));
    });

    return () => {
      current = false;
    };
  }, [i18n, baseI18n, routeLocale]);
}
