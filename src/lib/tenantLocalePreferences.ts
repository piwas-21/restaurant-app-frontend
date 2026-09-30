import type { LanguageCode } from '@/config/languageConfig';
import { localeFromPreferenceCookie, TENANT_LOCALE_COOKIE } from '@/lib/tenantLocaleRouting';
import { reportBrowserStorageFailure } from '@/lib/browserStorageDiagnostics';

/** Read the explicit, versioned locale preference. Detector-managed i18nextLng is intentionally ignored. */
export function readTenantLocalePreference(): LanguageCode | null {
  if (typeof document === 'undefined') return null;
  try {
    const entry = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${TENANT_LOCALE_COOKIE}=`));
    return localeFromPreferenceCookie(entry?.slice(TENANT_LOCALE_COOKIE.length + 1));
  } catch (cookieAccessError) {
    reportBrowserStorageFailure('read locale preference', cookieAccessError);
    return null;
  }
}

/** Persist the essential locale choice only after a route settles or a person changes language. */
export function persistTenantLocalePreference(locale: LanguageCode): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TENANT_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch (cookieWriteError) {
    reportBrowserStorageFailure('persist locale preference', cookieWriteError);
  }
}
