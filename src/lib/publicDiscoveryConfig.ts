import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import {
  TENANT_PUBLIC_CANONICAL_ORIGIN,
  TENANT_PUBLIC_DEFAULT_LOCALE,
  TENANT_PUBLIC_HOME_LOCALES,
  TENANT_PUBLIC_INDEXING_ENABLED,
  TENANT_PUBLIC_MENU_LOCALES,
} from './config';

const SUPPORTED = new Set<string>(LANGUAGE_CODES);

export interface TenantPublicConfig {
  canonicalOrigin: string | null;
  defaultLocale: LanguageCode;
  homeLocales: LanguageCode[];
  menuLocales: LanguageCode[];
  indexingEnabled: boolean;
}

function supportedLocale(value: string | undefined, name: string, fallback: LanguageCode): LanguageCode {
  if (value === undefined || value === '') return fallback;
  if (!SUPPORTED.has(value)) {
    throw new Error(`${name} must be one of the supported language codes: ${LANGUAGE_CODES.join(', ')}`);
  }
  return value as LanguageCode;
}

function localeList(value: string | undefined, name: string, fallback: LanguageCode[]): LanguageCode[] {
  if (value === undefined || value === '') return fallback;
  const entries = value.split(',');
  if (entries.some((entry) => !SUPPORTED.has(entry)) || new Set(entries).size !== entries.length) {
    throw new Error(`${name} must contain unique supported language codes separated by commas`);
  }
  return entries as LanguageCode[];
}

function canonicalOrigin(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    const reason =
      typeof error === 'object' && error !== null && 'name' in error && error.name === 'TypeError'
        ? 'invalid URL syntax'
        : 'URL parsing failed';
    throw new Error(`NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN must be an absolute http(s) origin (${reason})`);
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN must contain only an http(s) origin');
  }
  return url.origin;
}

export function parseTenantPublicConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): TenantPublicConfig {
  const defaultLocale = supportedLocale(
    env.NEXT_PUBLIC_PUBLIC_DEFAULT_LOCALE,
    'NEXT_PUBLIC_PUBLIC_DEFAULT_LOCALE',
    'en',
  );
  const homeLocales = localeList(env.NEXT_PUBLIC_PUBLIC_HOME_LOCALES, 'NEXT_PUBLIC_PUBLIC_HOME_LOCALES', [
    defaultLocale,
  ]);
  const menuLocales = localeList(env.NEXT_PUBLIC_PUBLIC_MENU_LOCALES, 'NEXT_PUBLIC_PUBLIC_MENU_LOCALES', [
    defaultLocale,
  ]);
  for (const [name, locales] of [
    ['NEXT_PUBLIC_PUBLIC_HOME_LOCALES', homeLocales],
    ['NEXT_PUBLIC_PUBLIC_MENU_LOCALES', menuLocales],
  ] as const) {
    if (!locales.includes(defaultLocale)) throw new Error(`${name} must include the public default locale`);
  }
  const indexingValue = env.NEXT_PUBLIC_PUBLIC_INDEXING_ENABLED;
  if (indexingValue && indexingValue !== 'true' && indexingValue !== 'false') {
    throw new Error('NEXT_PUBLIC_PUBLIC_INDEXING_ENABLED must be true or false');
  }
  return {
    canonicalOrigin: canonicalOrigin(env.NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN),
    defaultLocale,
    homeLocales,
    menuLocales,
    indexingEnabled: indexingValue === 'true',
  };
}

export const TENANT_PUBLIC_CONFIG = parseTenantPublicConfig({
  NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN: TENANT_PUBLIC_CANONICAL_ORIGIN,
  NEXT_PUBLIC_PUBLIC_DEFAULT_LOCALE: TENANT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_PUBLIC_HOME_LOCALES: TENANT_PUBLIC_HOME_LOCALES,
  NEXT_PUBLIC_PUBLIC_MENU_LOCALES: TENANT_PUBLIC_MENU_LOCALES,
  NEXT_PUBLIC_PUBLIC_INDEXING_ENABLED: TENANT_PUBLIC_INDEXING_ENABLED,
});

export function isSupportedPublicLocale(value: string): value is LanguageCode {
  return SUPPORTED.has(value);
}
