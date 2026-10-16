import { useEffect, useRef, useState } from 'react';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { tableSessionAddRoundPath } from '@/lib/cashierTableSession';
import { getErrorMessage } from '@/utils/apiClient';
import type { TableServiceSessionDto } from '@/types/order';

/** Both floor views open through the server authority before entering a visit-bound composer. */
export function useStartStaffTableOrder(
  role: 'server' | 'cashier',
  openSession: (identity: string) => Promise<TableServiceSessionDto>,
) {
  const router = useTenantLocaleRouter();
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startOrder = async (identity: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsStarting(true);
    setError(null);
    try {
      const session = await openSession(identity);
      if (!mounted.current) return;
      const href =
        role === 'cashier'
          ? tableSessionAddRoundPath(session)
          : `/server/tables/${encodeURIComponent(session.tableId || identity)}/order?serviceSessionId=${encodeURIComponent(session.serviceSessionId)}`;
      if (!href) throw new Error('cashier.tables.open_failed');
      router.push(href);
    } catch (reason: unknown) {
      if (mounted.current) setError(getErrorMessage(reason) ?? 'cashier.tables.open_failed');
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsStarting(false);
    }
  };
  return { startOrder, isStarting, error };
}
