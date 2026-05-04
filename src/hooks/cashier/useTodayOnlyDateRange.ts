'use client';

import { useEffect, useMemo, useState } from 'react';
import { startOfTodayLocal, endOfTodayLocal } from '@/utils/dateRange';

const STORAGE_KEY = 'cashier:todayOnly';

export interface UseTodayOnlyDateRangeReturn {
  todayOnly: boolean;
  setTodayOnly: (value: boolean) => void;
  /** Date window for the cashier orders query, or `undefined` for all-time. */
  dateRange: { startDate: Date; endDate: Date } | undefined;
}

/**
 * The cashier defaults to "today's orders only"; choice persists across
 * reloads. The date window is recomputed on every toggle change so polling
 * keeps using the same instants for the duration of the selection
 * (avoids midnight drift mid-shift — see BUGS-IMPROVEMENTS-PLAN §A3 / B2).
 * SSR-safe: localStorage is read in an effect, not at render time.
 */
export function useTodayOnlyDateRange(): UseTodayOnlyDateRangeReturn {
  const [todayOnly, setTodayOnly] = useState<boolean>(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setTodayOnly(stored === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(todayOnly));
  }, [todayOnly]);

  const dateRange = useMemo(
    () => (todayOnly ? { startDate: startOfTodayLocal(), endDate: endOfTodayLocal() } : undefined),
    [todayOnly],
  );

  return { todayOnly, setTodayOnly, dateRange };
}
