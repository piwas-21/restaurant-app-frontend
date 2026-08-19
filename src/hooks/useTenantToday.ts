'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTenantToday } from '@/services/tenantTimeService';
import { todayOnDevice } from '@/utils/calendarDay';

/** How often an open page re-asks. A day is wrong for at most this long after the venue's midnight. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export interface TenantTodayState {
  /** The day to treat as "today", or `''` until one is known. */
  today: string;
  /** Whether that day came from the RESTAURANT or from this device's own clock. */
  source: 'unknown' | 'tenant' | 'device';
}

/**
 * The day the restaurant is on, asked of the restaurant.
 *
 * Falls back to the DEVICE's local day when the answer cannot be had — an older backend, a
 * network blip — because the alternative is a booking form with no dates on it. That fallback is
 * still an improvement on what it replaces: it is the device's LOCAL day, so the day a guest reads
 * and the day the form sends are at least the same day, which is the defect #517 reports. It is
 * only wrong when the guest's zone differs from the restaurant's, and it says so through `source`
 * rather than pretending.
 *
 * It re-asks, rather than fetching once: a tab left open across the venue's midnight would
 * otherwise keep yesterday — which is #372 again, one layer out, on a floor tablet that is never
 * closed. Re-asked when the page becomes visible again and every {@link REFRESH_INTERVAL_MS}
 * while it is open; the request is one small anonymous GET the backend serves `no-store`.
 */
export function useTenantToday(): TenantTodayState {
  const [state, setState] = useState<TenantTodayState>({ today: '', source: 'unknown' });
  const alive = useRef(true);

  const ask = useCallback(async () => {
    const answer = await getTenantToday();
    if (!alive.current) return;

    const next: TenantTodayState = answer
      ? { today: answer.date, source: 'tenant' }
      : { today: todayOnDevice(), source: 'device' };

    // Same day, same object identity: this runs on a timer, and a fresh object every ten minutes
    // would re-render every consumer of the date picker for no change.
    setState((previous) => (previous.today === next.today && previous.source === next.source ? previous : next));
  }, []);

  useEffect(() => {
    alive.current = true;
    void ask();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void ask();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => void ask(), REFRESH_INTERVAL_MS);

    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [ask]);

  return state;
}
