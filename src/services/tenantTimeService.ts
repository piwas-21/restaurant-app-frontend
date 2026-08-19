import { apiClient } from '@/utils/apiClient';
import { trackEvent } from '@/lib/analytics';
import { ApiResponse } from '@/types/order';
import { isCalendarDay } from '@/utils/calendarDay';

/**
 * What day it is at the RESTAURANT — `GET /api/tenant/today`
 * (backend `Features/Tenant/Dtos/TenantTodayDto`).
 *
 * The browser cannot work this out: it knows its own zone and nothing about the tenant's
 * (`Localization:TimeZone`). Between local midnight and the UTC one the two are different days,
 * and a client that guesses books a table on the wrong one (frontend #517) or reads the wrong
 * day's takings (#511).
 */
export interface TenantToday {
  /** The tenant's calendar day, `YYYY-MM-DD`. */
  date: string;
  /** The IANA zone it was derived on — diagnostic; nothing here computes with it. */
  timeZone: string;
}

/**
 * The restaurant's day, or `null` when it could not be established.
 *
 * `null` means "unknown", never "today": an older backend without this route answers 404, and a
 * caller that read that as a day would be back to guessing. Deliberately does not throw — every
 * caller's fallback is the same one (`todayOnDevice()`), and a rejected promise would make each of
 * them re-decide that.
 */
export async function getTenantToday(): Promise<TenantToday | null> {
  try {
    const response = await apiClient.get<ApiResponse<TenantToday>>('/api/tenant/today');
    const date = response.data?.date;

    // A day this client cannot parse is not a day. It would otherwise be handed straight back to
    // the API as a `date` parameter, and shown to a guest as the day they are booking.
    if (typeof date !== 'string' || !isCalendarDay(date)) {
      trackEvent('tenant_day_unavailable', { failureReason: 'unreadable' });
      return null;
    }

    return { date, timeZone: response.data?.timeZone ?? '' };
  } catch (error) {
    // Not surfaced to the guest ON PURPOSE: an unreachable or older backend is "unknown", which
    // every caller already handles by falling back to this device's own day — surfacing it would
    // turn a network blip into a broken booking form. It is surfaced to the LOG, because a
    // persistent failure here means every device in the venue is guessing the day and nothing else
    // would ever say so.
    console.warn("Could not read the restaurant's day; this device will use its own:", error);
    trackEvent('tenant_day_unavailable', { failureReason: 'unreachable' });
    return null;
  }
}
