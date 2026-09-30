import { NextRequest, NextResponse } from 'next/server';
import { TENANT_PUBLIC_CONFIG, isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { publicLocaleHref } from '@/lib/publicRouteQuery';

const PUBLIC_LOCALE_HEADER = 'x-tenant-public-locale';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/' || pathname === '/menu') {
    const destination = request.nextUrl.clone();
    const surface = pathname === '/menu' ? 'menu' : 'home';
    const target = new URL(
      publicLocaleHref(TENANT_PUBLIC_CONFIG.defaultLocale, surface, request.nextUrl.searchParams),
      request.url,
    );
    destination.pathname = target.pathname;
    destination.search = target.search;
    return NextResponse.redirect(destination, 307);
  }

  const locale = pathname.split('/')[1];
  const headers = new Headers(request.headers);
  headers.delete(PUBLIC_LOCALE_HEADER);
  if (locale && isSupportedPublicLocale(locale) && (pathname === `/${locale}` || pathname === `/${locale}/menu`)) {
    headers.set(PUBLIC_LOCALE_HEADER, locale);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*[.].*).*)'],
};
