'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getTenantToday } from '@/services/tenantTimeService';
import { todayOnDevice } from '@/utils/calendarDay';

/** How often an open page re-asks. A day is wrong for at most this long after the venue's midnight. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * The day the restaurant is on, asked of the restaurant. `''` until one is known.
 *
 * Falls back to the DEVICE's local day when the answer cannot be had — an older backend, a
 * network blip — because the alternative is a booking form with no dates on it. That fallback is
 * still an improvement on what it replaces: it is the device's LOCAL day, so the day a guest reads
 * and the day the form sends are at least the same day, which is the defect #517 reports. It is
 * only wrong when the guest's zone differs from the restaurant's, and it is reported as
 * `tenant_day_unavailable` rather than passed off as the venue's own answer.
 *
 * It re-asks, rather than fetching once: a tab left open across the venue's midnight would
 * otherwise keep yesterday — which is #372 again, one layer out, on a floor tablet that is never
 * closed. Re-asked when the page becomes visible again and every {@link REFRESH_INTERVAL_MS} while
 * it is open; the service caches and de-duplicates, so this costs one small request a minute at
 * worst however many components ask.
 */
export function useTenantToday(): string {
  const [today, setToday] = useState<string>('');
  const alive = useRef(true);
  // Only the newest request may write: `visibilitychange` and the timer can put two in flight, and
  // the loser landing last would restore yesterday for up to ten minutes — at the rollover this
  // hook exists to handle.
  const latestRequest = useRef(0);
  // Whether the day on screen came from the restaurant. A transient failure must not DOWNGRADE a
  // known-good day to this device's guess: that silently re-labels all 14 buttons and moves `min`
  // under a guest who is mid-form, on nothing more than one 503.
  const answeredByTenant = useRef(false);

  const ask = useCallback(async () => {
    latestRequest.current += 1;
    const request = latestRequest.current;

    const answer = await getTenantToday();
    if (!alive.current || request !== latestRequest.current) return;

    if (answer) {
      answeredByTenant.current = true;
      setToday(answer.date);
      return;
    }

    if (answeredByTenant.current) return;
    setToday(todayOnDevice());
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

  return today;
}
