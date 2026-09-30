'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

/** Next router commands that retain the locale from the currently rendered route. */
export function useTenantLocaleRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const href = useCallback(
    (destination: string) =>
      tenantLocaleHref(
        pathname,
        destination,
        typeof window === 'undefined' ? undefined : new URLSearchParams(window.location.search),
      ),
    [pathname],
  );
  const push = useCallback(
    (destination: string, options?: Parameters<typeof router.push>[1]) =>
      options === undefined ? router.push(href(destination)) : router.push(href(destination), options),
    [href, router],
  );
  const replace = useCallback(
    (destination: string, options?: Parameters<typeof router.replace>[1]) =>
      options === undefined ? router.replace(href(destination)) : router.replace(href(destination), options),
    [href, router],
  );
  return useMemo(
    () => ({ href, push, replace, refresh: router.refresh, back: router.back, forward: router.forward }),
    [href, push, replace, router.back, router.forward, router.refresh],
  );
}
