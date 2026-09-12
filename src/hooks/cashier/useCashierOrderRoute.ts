'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** URL-owned selection for a cashier destination. Selection is pushed so browser Back closes it. */
export function useCashierOrderRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get('order');

  const navigateWithOrder = useCallback(
    (orderId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('order', orderId);
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const clearOrder = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('order');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return { selectedOrderId, navigateWithOrder, clearOrder };
}
