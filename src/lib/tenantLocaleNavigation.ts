import type { LanguageCode } from '@/config/languageConfig';
import { appPathname, isKnownTenantUiPath, tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';
import { publicContextQuery } from '@/lib/publicRouteQuery';

/** Prefix a same-origin UI destination with the current route locale, retaining its query and hash. */
export function tenantLocaleHref(
  currentPathname: string | null,
  href: string,
  currentSearch?: URLSearchParams | { toString(): string },
): string {
  const locale = tenantLocaleFromPathname(currentPathname);
  if (!locale || !href.startsWith('/') || href.startsWith('//')) return href;
  const destination = new URL(href, 'https://tenant.invalid');
  const targetLocale = tenantLocaleFromPathname(destination.pathname);
  const localized = targetLocale ? href : localizedTenantHref(locale, href);
  if (!currentSearch || !acceptsQrContext(destination.pathname)) return localized;
  const target = new URL(localized, 'https://tenant.invalid');
  for (const [key, value] of publicContextQuery(currentSearch)) {
    if (!target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Prefix a same-origin UI destination with a chosen locale, without rewriting API/external URLs. */
export function localizedTenantHref(locale: LanguageCode, href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const parsed = new URL(href, 'https://tenant.invalid');
  const routeLocale = tenantLocaleFromPathname(parsed.pathname);
  const unprefixedPath = routeLocale ? parsed.pathname.slice(routeLocale.length + 1) || '/' : parsed.pathname;
  if (!isKnownTenantUiPath(unprefixedPath)) return href;
  const pathname = `/${locale}${unprefixedPath === '/' ? '' : unprefixedPath}`;
  return `${pathname}${parsed.search}${parsed.hash}`;
}

function acceptsQrContext(pathname: string): boolean {
  const route = appPathname(pathname);
  return (
    route === '/' ||
    route === '/menu' ||
    route === '/scan' ||
    route === '/cart' ||
    route === '/reservations' ||
    route === '/my-reservations' ||
    route === '/orders' ||
    route === '/checkout' ||
    route.startsWith('/checkout/')
  );
}
