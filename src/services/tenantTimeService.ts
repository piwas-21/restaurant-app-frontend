import { apiClient } from '@/utils/apiClient';
import { trackEvent } from '@/lib/analytics';
import { ApiResponse } from '@/types/order';
import { TenantToday } from '@/types/tenant';
import { isCalendarDay, todayOnDevice } from '@/utils/calendarDay';

export type { TenantToday };

/**
 * How long one answer is reused. The day changes once a day; the callers ask far more often than
 * that — the server floor view refreshes its tables every 5 seconds — and without this every one of
 * those polls became a request, a `console.warn` on the failure path, and an analytics event that
 * nothing drains. A minute of staleness cannot move a day boundary that the hook re-checks every
 * ten.
 */
const CACHE_TTL_MS = 60_000;

/**
 * How far from this device's own day an answer may be before it is treated as no answer. A backend
 * that cannot resolve its zone, or serialises a default `DateOnly`, sends `0001-01-01` — a
 * well-formed day that would otherwise be rendered to a guest and sent back as `?date=`. Wide on
 * purpose: the device's clock is itself a guess, and only a sentinel is a year out.
 */
const PLAUSIBLE_DAYS = 370;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let cached: { at: number; value: TenantToday | null } | null = null;
let inFlight: Promise<TenantToday | null> | null = null;
let lastOutcome: 'answered' | 'unreachable' | 'unreadable' | null = null;

/**
 * The restaurant's day, or `null` when it could not be established.
 *
 * `null` means "unknown", never "today": an older backend without this route answers 404, and a
 * caller that read that as a day would be back to guessing. Deliberately does not throw — every
 * caller's fallback is the same one (`todayOnDevice()`), and a rejected promise would make each of
 * them re-decide that.
 *
 * Cached for {@link CACHE_TTL_MS} and de-duplicated while a request is in flight, because the
 * callers are polls.
 */
export async function getTenantToday(): Promise<TenantToday | null> {
  // A NEGATIVE age is a device clock that moved backwards (an NTP correction, a user, a tablet
  // waking up). `age < TTL` alone treats that as fresh, and pins the answer for the size of the
  // jump — an hour of yesterday on the floor tablet this cache exists for.
  const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
  if (cached && age >= 0 && age < CACHE_TTL_MS) return cached.value;

  // `.finally` here rather than inside `ask()`: a body that throws BEFORE its first `await` runs
  // its own `finally` synchronously — i.e. before this assignment — and would leave a settled
  // promise in `inFlight` that nothing ever clears, freezing the day for the life of the page.
  inFlight ??= ask().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Drops the cache and everything remembered with it. For tests; nothing in the app calls it. */
export function resetTenantTodayCache(): void {
  cached = null;
  inFlight = null;
  lastOutcome = null;
}

async function ask(): Promise<TenantToday | null> {
  try {
    const response = await apiClient.get<ApiResponse<TenantToday>>('/api/tenant/today');
    const date = response.data?.date;

    // A day this client cannot parse — or one a year away from any day this device could be having
    // — is not a day. It would otherwise be handed straight back to the API as a `date` parameter,
    // and shown to a guest as the day they are booking.
    if (typeof date !== 'string' || !isCalendarDay(date) || !isPlausible(date)) {
      return remember(null, 'unreadable');
    }

    return remember({ date, timeZone: response.data?.timeZone ?? '' }, 'answered');
  } catch (error) {
    // Not surfaced to the guest ON PURPOSE: an unreachable or older backend is "unknown", which
    // every caller already handles by falling back to this device's own day — surfacing it would
    // turn a network blip into a broken booking form. It is surfaced to the LOG and, once per
    // change of outcome, to analytics: a persistent failure here means every device in the venue is
    // guessing the day and nothing else would ever say so.
    console.warn("Could not read the restaurant's day; this device will use its own:", error);

    return remember(null, 'unreachable');
  }
}

function remember(value: TenantToday | null, outcome: 'answered' | 'unreachable' | 'unreadable') {
  cached = { at: Date.now(), value };

  // Only on a CHANGE. These callers poll, so an event per failure would push an object into
  // `window.dataLayer` — which nothing drains — every few seconds, all day, on the floor tablet
  // this whole change is about.
  if (outcome !== 'answered' && outcome !== lastOutcome) {
    trackEvent('tenant_day_unavailable', { failureReason: outcome });
  }
  lastOutcome = outcome;

  return value;
}

function isPlausible(date: string): boolean {
  const answered = Date.parse(`${date}T00:00:00Z`);
  const here = Date.parse(`${todayOnDevice()}T00:00:00Z`);

  return Math.abs(answered - here) <= PLAUSIBLE_DAYS * MS_PER_DAY;
}
