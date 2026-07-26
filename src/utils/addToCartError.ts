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
 * Statuses whose `message` is a domain rejection the backend wrote for the guest, not an internal
 * fault. 400 covers the channel guard and every command validator; 404 covers a product that went
 * away or was switched off between render and tap.
 *
 * Deliberately NOT 5xx (internal detail), NOT 0 (our own synthesized network error) and NOT 401,
 * which `apiClient` handles by clearing the session and redirecting.
 */
const GUEST_FACING_STATUSES = new Set([400, 404]);

/**
 * The message to show a guest when adding to the cart fails.
 *
 * @param error       whatever the add threw — `ApiError`, `Error`, or anything else.
 * @param t           translation function; the fallback is always localized.
 * @param fallbackKey i18n key used when the server gave no guest-facing reason. Callers whose
 *                    surrounding operation is broader than the add itself (e.g. opening the
 *                    customization sheet, which adds directly for a product with no options) pass
 *                    their own key so a genuine load failure still reads as one.
 *
 * @remarks
 * Reads `ApiError.message`, never `ApiError.errors`: the exception middleware fills `errors` with
 * `exception.ToString()` when the backend runs in Development, and a stack trace must never be
 * rendered into a guest's toast.
 *
 * The reason arrives in the backend's own language (English). That is acceptable for what is a
 * server-side safety net — the localized surface is the dimmed card + reason chip built from
 * `availability.allowedOrderTypes` (S4), which is what a guest normally sees; this path is reached
 * only by a stale tab, a tampered payload, or a channel change made in another tab.
 */
export function getAddToCartErrorMessage(error: unknown, t: TFunction, fallbackKey = 'error_adding_to_cart'): string {
  if (error instanceof ApiError && GUEST_FACING_STATUSES.has(error.status)) {
    const reason = error.message?.trim();
    if (reason) return reason;
  }

  return t(fallbackKey);
}
