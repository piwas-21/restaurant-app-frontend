/**
 * Add-to-cart error messages.
 *
 * The backend rejects an add whose product is not orderable on the basket's channel with a sentence
 * written FOR the guest — "Dürüm is not available for DineIn. Available for: Takeaway, Delivery."
 * (`Features/Basket/Services/BasketChannelGuard.cs`). Every add-to-cart callsite used to catch that
 * with a bare `catch {}` and a hardcoded toast, so the reason — the point of the per-order-type
 * availability feature — never reached the guest. This is the one place that decides what it says.
 *
 * See ORDER-TYPE-AVAILABILITY-PLAN.md §9.4.
 */

import { TFunction } from 'i18next';
import { ApiError } from '@/utils/apiClient';

/**
 * The one failure whose message is written for a guest and may be shown verbatim.
 *
 * Gating on the CODE rather than the status is the load-bearing decision here. `POST
 * /api/Basket/items` answers 400/404 for plenty of things that are not fit to render — "Session ID
 * is required", the generic "Validation failed"/"Operation failed" wrappers (the real text sits in
 * `errors[]` on those branches), "Child product not found: {guid}", or an incidental EF message —
 * so trusting the status would trade "the guest never sees the reason" for "the guest sometimes
 * sees backend plumbing", and two of those strings are untranslated English that is strictly worse
 * than the localized fallback.
 *
 * Mirrors `ErrorCodes.OrderTypeNotAvailable` (backend `Common/Models/ErrorCodes.cs`). Adding a code
 * there is a contract change; adding one here means deciding its message is guest-safe.
 */
const ORDER_TYPE_NOT_AVAILABLE = 'OrderTypeNotAvailable';

/**
 * The message to show a guest when adding to the cart fails.
 *
 * @param error       whatever the add threw — `ApiError`, `Error`, or anything else.
 * @param t           translation function; the fallback is always localized.
 * @param fallbackKey i18n key used when the server gave no guest-facing reason. Callers whose
 *                    surrounding operation is broader than the add itself pass their own key so a
 *                    genuine load failure still reads as one.
 *
 * @remarks
 * Reads `ApiError.message`, never `ApiError.errors`: on the thrown-exception branch the middleware
 * fills `errors` with `exception.ToString()` when the backend runs in Development, and a stack
 * trace must never be rendered into a guest's toast.
 *
 * The reason arrives in the backend's own language (English). That is acceptable for what is a
 * server-side safety net — the localized surface is the dimmed card + reason chip built from
 * `availability.allowedOrderTypes` (S4), which is what a guest normally sees; this path is reached
 * only by a stale tab, a tampered payload, or a channel change made in another tab.
 */
export function getAddToCartErrorMessage(error: unknown, t: TFunction, fallbackKey = 'error_adding_to_cart'): string {
  if (error instanceof ApiError && error.errorCode === ORDER_TYPE_NOT_AVAILABLE) {
    const reason = error.message?.trim();
    if (reason) return reason;
  }

  return t(fallbackKey);
}
