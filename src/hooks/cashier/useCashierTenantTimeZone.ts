'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCashierTenantContext } from '@/services/cashierService';
import { CASHIER_TENANT_DAY_REFRESH_MS } from '@/lib/config';
import { isCalendarDay } from '@/utils/calendarDay';

export interface CashierTenantTimeZoneState {
  readonly date?: string;
  readonly timeZone?: string;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly refresh: () => void;
}

/** Reads the server business day and timezone used by cashier workspaces. */
export function useCashierTenantTimeZoneState(): CashierTenantTimeZoneState {
  const [state, setState] = useState<Omit<CashierTenantTimeZoneState, 'refresh'>>({
    isLoading: true,
    hasError: false,
  });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestRef = useRef(0);
  const aliveRef = useRef(false);
  const refresh = useCallback(() => setRefreshVersion((current) => current + 1), []);

  useEffect(() => {
    aliveRef.current = true;
    const refresh = async () => {
      const requestId = ++requestRef.current;
      setState((current) => ({ ...current, isLoading: !current.date, hasError: false }));
      try {
        const context = await getCashierTenantContext();
        if (!aliveRef.current || requestId !== requestRef.current) return;
        const date = context?.date && isCalendarDay(context.date) ? context.date : undefined;
        const timeZone = context?.timeZone;
        setState((current) => ({
          date: date ?? current.date,
          timeZone: timeZone ?? current.timeZone,
          isLoading: false,
          hasError: !date || !timeZone,
        }));
      } catch (error: unknown) {
        if (aliveRef.current && requestId === requestRef.current) {
          console.error('Failed to refresh cashier tenant context:', error);
          setState((current) => ({ ...current, isLoading: false, hasError: true }));
        }
      }
    };
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => void refresh(), CASHIER_TENANT_DAY_REFRESH_MS);
    return () => {
      aliveRef.current = false;
      requestRef.current += 1;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [refreshVersion]);

  return { ...state, refresh };
}

/** Backwards-compatible string facade for read-only cashier surfaces. */
export function useCashierTenantTimeZone(): string | undefined {
  return useCashierTenantTimeZoneState().timeZone;
}
