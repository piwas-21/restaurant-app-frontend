'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { publicLocaleHref } from '@/lib/publicRouteQuery';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';
import { tenantLocaleFromPathname } from '@/lib/tenantLocaleRouting';

/** Public home/menu destinations retain only the established safe QR/table context. */
export function useTenantPublicNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = tenantLocaleFromPathname(pathname);
  const homeHref = useMemo(
    () => (locale ? publicLocaleHref(locale, 'home', searchParams) : '/'),
    [locale, searchParams],
  );
  const menuHref = useMemo(
    () => (locale ? publicLocaleHref(locale, 'menu', searchParams) : '/menu'),
    [locale, searchParams],
  );
  const hrefFor = useCallback(
    (destination: string) => tenantLocaleHref(pathname, destination, searchParams),
    [pathname, searchParams],
  );
  const pushMenu = useCallback(() => router.push(menuHref), [menuHref, router]);
  const replaceMenu = useCallback(() => router.replace(menuHref), [menuHref, router]);
  const pushHome = useCallback(() => router.push(homeHref), [homeHref, router]);
  return { homeHref, menuHref, hrefFor, pushHome, pushMenu, replaceMenu };
}
