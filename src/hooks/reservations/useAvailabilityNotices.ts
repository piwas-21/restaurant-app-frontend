'use client';

import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * Everything the reservation availability screen SAYS, in one place.
 *
 * Split out of `useReservationAvailability` (E9 slice 6a) rather than baselined: explaining why
 * each of these three notices is worded and gated the way it is took more room than the hook had,
 * and a rule that needs a paragraph has outgrown the function it was buried in.
 *
 * All three are fire-and-forget toasts, which is why none of them uses `useApiError` — that hook
 * holds error state a snackbar has nowhere to put. Only `tablesFailed` resolves an error object;
 * `slotsFailed` takes an already-resolved sentence because its two callers reach it from two
 * different shapes (a resolved `{data: null}` refusal and a thrown `ApiError`), and
 * `restaurantClosed` has no error path at all.
 */
export function useAvailabilityNotices() {
  const { t } = useTranslation();

  return {
    /** The table list could not load, so the map has nothing to draw. */
    tablesFailed: (error: unknown) => {
      enqueueSnackbar(getErrorMessage(error) ?? t('failed_to_load_tables', 'Failed to load tables'), {
        variant: 'error',
      });
    },

    /**
     * The time slots could not load — from either failure shape, the resolved `{data: null}`
     * refusal and the thrown `ApiError`.
     *
     * Both used to empty the dropdown in silence and LEAVE the date selected, so the screen was
     * indistinguishable from one where the click had simply not registered — the closed-day notice
     * below at least toasts and clears the date. What actually happened was a refusal ("Cannot
     * make reservations for past dates", "No active tables found") or an outage, and the server
     * says which in words.
     *
     * `preventDuplicate` is load-bearing rather than tidiness. The fetch effect depends on
     * `numberOfGuests`, and the custom party-size control is an `<input type="number">` whose
     * `onChange` runs per KEYSTROKE — typing "12" is two fetches, "125" is three. Without it a
     * backend outage stacks one identical snackbar per digit. notistack 3 compares the message
     * TEXT (no `key` is passed), so a genuinely different sentence still gets through.
     */
    slotsFailed: (serverMessage: string | null | undefined) => {
      enqueueSnackbar(serverMessage ?? t('failed_to_load_time_slots', 'Failed to load available times'), {
        variant: 'error',
        preventDuplicate: true,
      });
    },

    /**
     * Zero slots on a day the server answered for — so not broken, whatever else it is.
     *
     * **The wording is inherited and it over-claims.** `GetAvailableTimeSlotsQueryHandler` returns
     * an empty `TimeSlots` on three paths, and only one of them is a closed day: every slot fully
     * booked (`if (availableTables.Any())` never true) and, for TODAY, every remaining slot
     * already past (`if (isToday && currentTime <= currentTimeSpan) continue`) produce the same
     * empty list. `DateTimeSelector`'s `min` is today, so a guest at 21:00 picking today is told
     * the restaurant is closed on a Saturday it is open on.
     *
     * Not fixed here: telling the three apart needs the backend to distinguish them (the response
     * carries no reason), plus a new key across 10 locales. Left as it was so this slice does not
     * quietly become that change — but the comment must not vouch for a cause that is wrong two
     * times in three.
     */
    restaurantClosed: (isoDate: string) => {
      const dateObj = new Date(isoDate);
      enqueueSnackbar(
        t('restaurant_closed_on_date', 'Restaurant is closed on {{day}}, {{date}}. Please select another date.', {
          day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          date: dateObj.toLocaleDateString(),
        }),
        { variant: 'warning', autoHideDuration: 5000 },
      );
    },
  };
}
