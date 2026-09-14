'use client';

import { useEffect, useRef, useState } from 'react';
import { CASHIER_TENANT_DAY_REFRESH_MS } from '@/lib/config';
import { getCashierTenantDay } from '@/services/cashierService';

const STORAGE_KEY = 'cashier:todayOnly';

export interface UseTodayOnlyDateRangeReturn {
  todayOnly: boolean;
  setTodayOnly: (value: boolean) => void;
  /**
   * The venue's calendar day (`YYYY-MM-DD` on the restaurant's clock) when "today only" is on,
   * `undefined` for all-time or while the venue's day is not yet known. The window itself is
   * computed SERVER-side from this day — the device's zone is never asked (backend #372), and
   * because the day is a string the window can neither be computed in the wrong zone nor freeze
   * across the venue's midnight (#545): the re-asking tenant clock rolls it automatically.
   */
  tenantDay: string | undefined;
}

/**
 * The cashier defaults to "today's orders only"; choice persists across reloads. SSR-safe:
 * localStorage is read in an effect, not at render time.
 */
export function useTodayOnlyDateRange(): UseTodayOnlyDateRangeReturn {
  const [todayOnly, setTodayOnly] = useState<boolean>(true);
  const [tenantDay, setTenantDay] = useState<string | undefined>();
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setTodayOnly(stored === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(todayOnly));
  }, [todayOnly]);

  useEffect(() => {
    if (!todayOnly) {
      setTenantDay(undefined);
      return;
    }

    let alive = true;
    const refresh = async () => {
      const request = ++latestRequestRef.current;
      try {
        const day = await getCashierTenantDay();
        // An unavailable tenant clock means no date filter, never a browser-clock guess. A known
        // good server day remains during a transient failure, so a brief outage cannot relabel a
        // cashier's queue; the timer/visibility retry will replace it after venue midnight.
        if (alive && request === latestRequestRef.current && day) setTenantDay(day);
      } catch (error) {
        // The queue stays safely unfiltered until the server names its day again. Keep this
        // visible in diagnostics rather than pretending the tablet clock is a tenant answer.
        console.warn("Could not refresh the cashier's tenant day; the date filter is unchanged:", error);
      }
    };

    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer =
      CASHIER_TENANT_DAY_REFRESH_MS === undefined
        ? undefined
        : window.setInterval(() => void refresh(), CASHIER_TENANT_DAY_REFRESH_MS);

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [todayOnly]);

  return { todayOnly, setTodayOnly, tenantDay: todayOnly ? tenantDay : undefined };
}
