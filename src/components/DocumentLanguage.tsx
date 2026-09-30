'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { baseLanguage, directionFor } from '@/lib/textDirection';

/**
 * Keeps `<html lang>` and `<html dir>` in step with the active locale.
 *
 * Public App Router pages provide their locale to the server-rendered `<html>` and to i18next.
 * This effect keeps both attributes current during client navigation and browser history changes;
 * private or unlocalized routes continue to use the saved i18next language.
 *
 * Renders nothing. It is a side effect on the document element, which is outside React's tree.
 */
export default function DocumentLanguage() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const pathname = usePathname();
  const routeLocale = localeFromPublicPath(pathname);

  useEffect(() => {
    if (routeLocale && baseLanguage(i18n.language) !== routeLocale) void i18n.changeLanguage(routeLocale);
    const root = document.documentElement;
    const activeLanguage = routeLocale ?? language;
    root.setAttribute('lang', baseLanguage(activeLanguage));
    root.setAttribute('dir', directionFor(activeLanguage));
  }, [i18n, language, routeLocale]);

  return null;
}

function localeFromPublicPath(pathname: string | null): string | null {
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  if (!segments[0] || !isSupportedPublicLocale(segments[0])) return null;
  return segments.length === 1 || (segments.length === 2 && segments[1] === 'menu') ? segments[0] : null;
}
