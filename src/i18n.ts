// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Keep the default-language fallback available synchronously for unlocalized routes and SSR.
import translationEN from './locales/en.json';
import { applyTenantCopy, tenantCopyOverrides } from './lib/tenantCopy';
import { loadLocaleMessages, normalizeBundleLocale } from './lib/localeResourceLoader';
import { createLocaleBackend } from './lib/localeBackend';
import { tenantLocaleFromPathname } from './lib/tenantLocaleRouting';
import { readTenantLocalePreference } from './lib/tenantLocalePreferences';

const localeBackend = createLocaleBackend((language) => loadLocaleMessages(normalizeBundleLocale(language)));

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';
const routeLocale = isBrowser ? tenantLocaleFromPathname(window.location.pathname) : undefined;
const savedLocale = isBrowser ? readTenantLocalePreference() : null;

i18n
  .use(localeBackend)
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources: { en: { translation: applyTenantCopy(translationEN, tenantCopyOverrides('en')) } },
    partialBundledLanguages: true,
    ns: ['translation'],
    defaultNS: 'translation',
    fallbackLng: 'en', // Use English if detected language is not available
    // Any supported locale URL is authoritative; otherwise only the versioned preference cookie
    // outranks browser detection. The old detector cache could contain a locale forced by a
    // previous default route, so it is deliberately no longer read as a user choice.
    lng: routeLocale ?? savedLocale ?? undefined,
    debug: process.env.NODE_ENV === 'development', // Enable debug mode in development
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],
    },
    react: {
      useSuspense: false, // Disable Suspense for older versions of React or if not using Suspense
    },
  });

export default i18n;

/** Prime the server-rendered route locale before the provider clones it for hydration. */
export function primeLocaleMessages(locale: string, messages: Record<string, unknown>): void {
  const resolvedLocale = normalizeBundleLocale(locale);
  if (!i18n.hasResourceBundle(resolvedLocale, 'translation')) {
    i18n.addResourceBundle(resolvedLocale, 'translation', messages, true, true);
  }
}
