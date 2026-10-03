'use client';

import { useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import baseI18n from '../i18n';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import { useDocumentLanguageSync } from '@/hooks/useDocumentLanguageSync';

/** Keeps the document and both i18next instances aligned with the explicit route locale. */
export default function DocumentLanguage() {
  const { i18n } = useTranslation();
  const pathname = usePathname();
  const routeLocale = tenantLocaleFromPathname(pathname);
  useDocumentLanguageSync(i18n, baseI18n, routeLocale);

  return null;
}
