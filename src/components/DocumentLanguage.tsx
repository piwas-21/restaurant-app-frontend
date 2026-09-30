'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import baseI18n from '../i18n';
import { baseLanguage, directionFor } from '@/lib/textDirection';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import { persistTenantLocalePreference } from '@/lib/tenantLocalePreferences';

/** Keeps the document and both i18next instances aligned with the explicit route locale. */
export default function DocumentLanguage() {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const routeLocale = tenantLocaleFromPathname(pathname);
  const activeLanguage = routeLocale ?? i18n.language;

  useEffect(() => {
    if (routeLocale) {
      if (baseLanguage(i18n.language) !== routeLocale) void i18n.changeLanguage(routeLocale);
      if (baseLanguage(baseI18n.language) !== routeLocale) void baseI18n.changeLanguage(routeLocale);
      persistTenantLocalePreference(routeLocale);
    }

    const root = document.documentElement;
    root.setAttribute('lang', baseLanguage(activeLanguage));
    root.setAttribute('dir', directionFor(activeLanguage));
  }, [activeLanguage, i18n, routeLocale]);

  return null;
}
