import fs from 'node:fs';
import path from 'node:path';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import {
  appPathname,
  isKnownTenantUiPath,
  KNOWN_TENANT_UI_PATHS,
  localeFromAcceptLanguage,
  localeFromPreferenceCookie,
  localizedPathname,
  resolveTenantLocale,
  tenantLocaleFromPathname,
} from './tenantLocaleRouting';

function routePattern(file: string): string {
  const appRoot = path.resolve(__dirname, '../app/[locale]');
  const segments = path.relative(appRoot, file).split(path.sep).slice(0, -1);
  const route = segments
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) => (segment.startsWith('[') ? `:${segment.slice(1, -1)}` : segment));
  return route.length ? `/${route.join('/')}` : '/';
}

function routePages(directory: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) routePages(file, found);
    else if (entry.name === 'page.tsx') found.push(file);
  }
  return found;
}

describe('tenant locale routing', () => {
  it('recognizes only supported locale segments and strips exactly one segment', () => {
    expect(tenantLocaleFromPathname('/ar/cart')).toBe('ar');
    expect(tenantLocaleFromPathname('/arbitrary/cart')).toBeNull();
    expect(tenantLocaleFromPathname('/xx/cart')).toBeNull();
    expect(appPathname('/fr')).toBe('/');
    expect(appPathname('/fr/admin/dashboard')).toBe('/admin/dashboard');
    expect(appPathname('/fridge/menu')).toBe('/fridge/menu');
  });

  it('builds locale URLs without duplicating an existing supported prefix', () => {
    expect(localizedPathname('ar', '/cart')).toBe('/ar/cart');
    expect(localizedPathname('fr', '/ar/checkout/review')).toBe('/fr/checkout/review');
    expect(localizedPathname('de', '/')).toBe('/de');
  });

  it('keeps the legacy redirect allowlist in sync with physical app routes', () => {
    const appRoot = path.resolve(__dirname, '../app/[locale]');
    const actual = routePages(appRoot).map(routePattern).sort();
    expect([...KNOWN_TENANT_UI_PATHS].sort()).toEqual(actual);
    expect(isKnownTenantUiPath('/admin/user-groups/42')).toBe(true);
    expect(isKnownTenantUiPath('/server/tables/table-1/order')).toBe(true);
    expect(isKnownTenantUiPath('/server/orders/order-1')).toBe(true);
    expect(isKnownTenantUiPath('/admin/not-a-route')).toBe(false);
    expect(isKnownTenantUiPath('/api/health')).toBe(false);
  });

  it('negotiates the highest weighted supported language and normalizes regional tags', () => {
    expect(localeFromAcceptLanguage('fr-CH, en-US;q=0.8', 'de')).toBe('fr');
    expect(localeFromAcceptLanguage('fr-CH;q=0.2, ar-EG;q=0.9, en;q=0.7', 'de')).toBe('ar');
    expect(localeFromAcceptLanguage('xx-YY, zh-Hant;q=0.5', 'de')).toBe('zh');
    expect(localeFromAcceptLanguage('*;q=1, en;q=0', 'de')).toBe('de');
  });

  it('uses only the versioned locale cookie as a saved preference', () => {
    expect(localeFromPreferenceCookie('fr')).toBe('fr');
    expect(localeFromPreferenceCookie('fr-CH')).toBeNull();
    expect(localeFromPreferenceCookie('i18nextLng=fr')).toBeNull();
    expect(resolveTenantLocale('en', 'fr-CH,ar;q=0.9', 'de')).toBe('en');
    expect(resolveTenantLocale(undefined, 'fr-CH,ar;q=0.9', 'de')).toBe('fr');
    expect(resolveTenantLocale(undefined, null, 'de')).toBe('de');
    expect(LANGUAGE_CODES).toContain('ar');
  });
});
