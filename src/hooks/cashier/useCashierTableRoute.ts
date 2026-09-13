'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CASHIER_TABLES_PATH } from '@/lib/cashierWorkspace';

/** URL-owned table selection; browser Back returns to the map/list without losing its place. */
export function useCashierTableRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSessionId = searchParams.get('session');
  const selectedTableNumber = searchParams.get('table');

  const navigateToTable = useCallback(
    (tableNumber: string, serviceSessionId?: string) => {
      const next = new URLSearchParams();
      if (serviceSessionId) next.set('session', serviceSessionId);
      else next.set('table', tableNumber);
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router],
  );

  const navigateToSession = useCallback(
    (serviceSessionId: string) => router.push(`${CASHIER_TABLES_PATH}?session=${encodeURIComponent(serviceSessionId)}`),
    [router],
  );

  const clearSelection = useCallback(() => router.replace(CASHIER_TABLES_PATH), [router]);

  return { selectedSessionId, selectedTableNumber, navigateToTable, navigateToSession, clearSelection };
}
