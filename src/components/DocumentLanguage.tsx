'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { baseLanguage, directionFor } from '@/lib/textDirection';

/**
 * Keeps `<html lang>` and `<html dir>` in step with the active locale.
 *
 * It has to be a client effect rather than a prop on the server-rendered `<html>`: the language is
 * chosen in the browser (`i18n.ts` detects it from `localStorage` → `navigator`), so the server has
 * no way to know it at render time. The root layout keeps `lang="en"` as its SSR default and this
 * corrects it on mount and on every subsequent switch.
 *
 * Renders nothing. It is a side effect on the document element, which is outside React's tree.
 */
export default function DocumentLanguage() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', baseLanguage(language));
    root.setAttribute('dir', directionFor(language));
  }, [language]);

  return null;
}
