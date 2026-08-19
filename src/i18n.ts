// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en.json';
import translationDE from './locales/de.json';
import translationTR from './locales/tr.json';
import translationIT from './locales/it.json';
import translationAR from './locales/ar.json';
import translationFR from './locales/fr.json';
import translationNL from './locales/nl.json';
import translationES from './locales/es.json';
import translationRU from './locales/ru.json';
import translationZH from './locales/zh.json';
import { applyTenantCopy, tenantCopyOverrides } from './lib/tenantCopy';

// The PLATFORM bundles: cuisine-neutral copy every tenant image inherits.
const baseBundles: Record<string, Record<string, unknown>> = {
  en: translationEN,
  de: translationDE,
  tr: translationTR,
  it: translationIT,
  ar: translationAR,
  fr: translationFR,
  nl: translationNL,
  es: translationES,
  ru: translationRU,
  zh: translationZH,
};

// A tenant with copy of its own (NEXT_PUBLIC_TENANT_COPY_PACK) lays its ten locale files over the
// platform ones here, so `t()` needs no knowledge of packs and no callsite changes. Empty for every
// tenant without one — see src/lib/tenantCopy.ts.
const resources = Object.fromEntries(
  Object.entries(baseBundles).map(([locale, bundle]) => [
    locale,
    { translation: applyTenantCopy(bundle, tenantCopyOverrides(locale)) },
  ]),
);

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Use English if detected language is not available
    lng: isBrowser ? localStorage.getItem('i18nextLng') || undefined : undefined, // Explicitly read from localStorage
    debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false, // Disable Suspense for older versions of React or if not using Suspense
    },
  });

export default i18n;
