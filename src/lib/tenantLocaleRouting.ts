import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';

const SUPPORTED_LOCALES = new Set<string>(LANGUAGE_CODES);

export const TENANT_LOCALE_COOKIE = 'tenant_locale_v1';

export const KNOWN_TENANT_UI_PATHS = [
  '/',
  '/delete-account',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/account',
  '/admin/api-tokens',
  '/admin/category-management',
  '/admin/customer-discounts',
  '/admin/customer-forms',
  '/admin/dashboard',
  '/admin/delivery-channels',
  '/admin/delivery-channels/callback',
  '/admin/fidelity-analytics',
  '/admin/image-backfill',
  '/admin/ingredient-translations',
  '/admin/member-management',
  '/admin/menu-management',
  '/admin/menu-management/new',
  '/admin/menu-management/:productId',
  '/admin/menu-management/catalogue',
  '/admin/menu-management/catalogue/import',
  '/admin/option-sets',
  '/admin/option-sets/new',
  '/admin/option-sets/:optionSetId',
  '/admin/orders-management',
  '/admin/point-rules',
  '/admin/reservations-management',
  '/admin/restaurant-settings',
  '/admin/specials-management',
  '/admin/table-layout-editor',
  '/admin/table-statistics',
  '/admin/user-groups',
  '/admin/user-groups/:id',
  '/auth/login',
  '/auth/register',
  '/cart',
  '/cashier/collection',
  '/cashier/history',
  '/cashier/new',
  '/cashier/orders',
  '/cashier/tables',
  '/checkout/confirmation',
  '/checkout/customer-info',
  '/checkout/order-type',
  '/checkout/review',
  '/dev-portal',
  '/kitchen-staff',
  '/menu',
  '/my-orders',
  '/my-reservations',
  '/orders',
  '/privacy-policy',
  '/reservations',
  '/scan',
  '/server',
  '/server/floor',
  '/server/marketplace',
  '/server/orders',
  '/server/orders/:orderId',
  '/server/tables/:tableId',
  '/server/tables/:tableId/order',
  '/server/takeaway',
  '/server/tasks',
  '/terms-of-usage',
] as const;

export function tenantLocaleFromPathname(pathname: string | null | undefined): LanguageCode | null {
  const firstSegment = pathname?.split('/').find((segment) => segment.length > 0);
  return firstSegment && SUPPORTED_LOCALES.has(firstSegment) ? (firstSegment as LanguageCode) : null;
}

export function appPathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const locale = tenantLocaleFromPathname(pathname);
  if (!locale) return pathname;
  const unprefixed = pathname.slice(locale.length + 1);
  return unprefixed ? `/${unprefixed.replace(/^\//, '')}` : '/';
}

export function localizedPathname(locale: LanguageCode, pathname: string | null | undefined): string {
  const route = appPathname(pathname);
  return `/${locale}${route === '/' ? '' : route}`;
}

export function isKnownTenantUiPath(pathname: string): boolean {
  const actual = pathname === '/' ? [] : pathname.split('/').filter(Boolean);
  return KNOWN_TENANT_UI_PATHS.some((pattern) => {
    const expected = pattern === '/' ? [] : pattern.split('/').filter(Boolean);
    return (
      actual.length === expected.length &&
      expected.every((segment, index) => segment.startsWith(':') || segment === actual[index])
    );
  });
}

export function localeFromPreferenceCookie(value: string | undefined): LanguageCode | null {
  return value && SUPPORTED_LOCALES.has(value) ? (value as LanguageCode) : null;
}

export function localeFromAcceptLanguage(value: string | null, fallback: LanguageCode): LanguageCode {
  if (!value) return fallback;
  const preferences = value
    .split(',')
    .map((entry, index) => {
      const [tag = '', ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), quality, index };
    })
    .filter((entry) => entry.tag && Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const preference of preferences) {
    if (preference.tag === '*') continue;
    const language = preference.tag.split('-')[0];
    if (SUPPORTED_LOCALES.has(language)) return language as LanguageCode;
  }
  return fallback;
}

export function resolveTenantLocale(
  preferenceCookie: string | undefined,
  acceptLanguage: string | null,
  fallback: LanguageCode,
): LanguageCode {
  return localeFromPreferenceCookie(preferenceCookie) ?? localeFromAcceptLanguage(acceptLanguage, fallback);
}
