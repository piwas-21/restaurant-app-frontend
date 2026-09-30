import { NextRequest, NextResponse } from 'next/server';
import { TENANT_PUBLIC_CONFIG, isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { publicLocaleHref } from '@/lib/publicRouteQuery';
import {
  appPathname,
  isKnownTenantUiPath,
  resolveTenantLocale,
  TENANT_LOCALE_COOKIE,
  tenantLocaleFromPathname,
} from '@/lib/tenantLocaleRouting';

const PUBLIC_LOCALE_HEADER = 'x-tenant-public-locale';
const TENANT_LOCALE_HEADER = 'x-tenant-route-locale';
const INTERNAL_LOCALE_HEADERS = [PUBLIC_LOCALE_HEADER, TENANT_LOCALE_HEADER] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  for (const header of INTERNAL_LOCALE_HEADERS) headers.delete(header);

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers } });
  }

  const routeLocale = tenantLocaleFromPathname(pathname);
  if (routeLocale) {
    headers.set(TENANT_LOCALE_HEADER, routeLocale);
    if (isPublicHomePath(pathname)) headers.set(PUBLIC_LOCALE_HEADER, routeLocale);
    return NextResponse.next({ request: { headers } });
  }

  if (!isKnownTenantUiPath(pathname) && pathname !== '/cashier') {
    return NextResponse.next({ request: { headers } });
  }

  const locale = resolveTenantLocale(
    request.cookies.get(TENANT_LOCALE_COOKIE)?.value,
    request.headers.get('accept-language'),
    TENANT_PUBLIC_CONFIG.defaultLocale,
  );
  const target = request.nextUrl.clone();
  if (pathname === '/' || pathname === '/menu') {
    const surface = pathname === '/menu' ? 'menu' : 'home';
    const publicTarget = new URL(publicLocaleHref(locale, surface, request.nextUrl.searchParams), request.url);
    target.pathname = publicTarget.pathname;
    target.search = publicTarget.search;
  } else {
    target.pathname = legacyTargetPath(locale, pathname);
  }

  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Accept-Language, Cookie');
  return response;
}

function isPublicHomePath(pathname: string): boolean {
  const unprefixed = appPathname(pathname);
  return unprefixed === '/' || unprefixed === '/menu';
}

function legacyTargetPath(locale: string, pathname: string): string {
  if (pathname === '/cashier') return `/${locale}/cashier/orders`;
  if (pathname === '/my-orders') return `/${locale}/orders`;
  return `/${locale}${pathname}`;
}

export function isSupportedLocaleForMiddleware(value: string): boolean {
  return isSupportedPublicLocale(value);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*[.].*).*)'],
};
