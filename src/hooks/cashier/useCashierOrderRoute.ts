'use client';

import { useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTenantLocaleRouter as useRouter } from '@/hooks/useTenantLocaleRouter';
import { CASHIER_COLLECTION_PATH, CASHIER_ORDERS_PATH } from '@/lib/cashierWorkspace';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

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

  const navigateToCollection = useCallback(
    (orderId?: string, serviceSessionId?: string) => {
      const params = new URLSearchParams();
      if (serviceSessionId) params.set('serviceSessionId', serviceSessionId);
      if (orderId) params.set('order', orderId);
      const query = params.toString();
      const target = query ? `${CASHIER_COLLECTION_PATH}?${query}` : CASHIER_COLLECTION_PATH;
      router.push(tenantLocaleHref(pathname, target));
    },
    [pathname, router],
  );

  const navigateToOrder = useCallback(
    (orderId: string) =>
      router.push(tenantLocaleHref(pathname, `${CASHIER_ORDERS_PATH}?order=${encodeURIComponent(orderId)}`)),
    [pathname, router],
  );

  const navigateToOrders = useCallback(
    () => router.push(tenantLocaleHref(pathname, CASHIER_ORDERS_PATH)),
    [pathname, router],
  );

  return {
    selectedOrderId,
    navigateWithOrder,
    navigateToCollection,
    navigateToOrder,
    navigateToOrders,
    clearOrder,
  };
}
