/**
 * Order Error Handler Utility
 *
 * Maps backend error messages to translated i18n keys
 */

import { TFunction } from 'i18next';
import { ApiError, getErrorMessage } from '@/utils/apiClient';

/**
 * Map backend error messages to translated error keys
 *
 * @param error - The error object from the API
 * @param t - Translation function from react-i18next
 * @returns Translated error message
 */
export function getTranslatedOrderError(error: unknown, t: TFunction): string {
  // The SERVER's message, or null when it authored none. This function already ends in its own
  // translated generic, so the null case needs no new fallback — it just skips the pattern match.
  const rawMessage = getErrorMessage(error);

  // THREE mappings, enumerated from the handlers rather than guessed (#435). The map used to hold
  // seven, each with a redundant lowercase twin, and all seven were unreachable.
  //
  // Four were dead at the source: `out of stock` matches nothing in the backend at all;
  // `Invalid table number` and `Payment amount` belong to cashier and payment endpoints this catch
  // cannot see; and `Order type` was worse than dead — two words, short enough to substring-match
  // `"Order type cleared"`, a SUCCESS string.
  //
  // `Basket not found` was dead for a subtler reason worth recording, because the string DOES exist
  // and `clearCart()` runs inside the same try as the order call. `ClearBasketCommandHandler` has a
  // catch-all, so `DELETE /api/Basket` answers 200 + success:false — never a 404 — and
  // `basketService.clearBasket` rethrows a PLAIN Error, for which `getErrorMessage` returns null by
  // design. So that message cannot reach here at all; a cart-clear failure renders the generic,
  // before and after this change.
  //
  // `Product not found` was dead only because the real message carries a GUID
  // (`$"Product {id} not found"`), which `includes('product not found')` never matched.
  //
  // The two *_NOT_FOUND patterns are anchored on that GUID rather than matched loosely, and that is
  // the point: both are authored by OrderItemFactory one branch apart, a bare `not found` substring
  // would swallow unrelated refusals, and leaving either unmapped would print an internal entity id
  // to a customer — which is exactly what the fall-through below does.
  //
  // A fourth entry is not the way to cover a new failure: prefer `ApiResponse.FailureWithCode` +
  // `ApiError.errorCode`, which is stable across a backend that localises its prose.
  const DELIVERY_ADDRESS_REQUIRED = 'delivery address is required';
  const MISSING_ENTITY = /^(menu|product)\s+[0-9a-f-]{36}\s+not found$/i;

  const lowerMessage = rawMessage?.toLowerCase() ?? '';
  if (lowerMessage.includes(DELIVERY_ADDRESS_REQUIRED)) {
    return t('error_delivery_address_required', rawMessage ?? '');
  }
  if (rawMessage && MISSING_ENTITY.test(rawMessage.trim())) {
    return t('error_product_unavailable', 'One or more products are no longer available');
  }

  // No mapping — show the server's own sentence rather than a generic that says nothing.
  //
  // The bound was `>= 400 && < 500`, which is now too narrow at BOTH ends. `throwServerRefusal`
  // mints its `ApiError` with status **200** on purpose (200 is what the transport genuinely
  // returned; an invented 400 would be indistinguishable from a real HTTP validation failure), so
  // a 4xx-only gate discards exactly the refusals this change set out to surface — the customer
  // would still read the generic. `< 500` admits both the envelope refusal and real client errors
  // while still excluding 5xx, where the backend's prose is not written for a customer.
  //
  // `rawMessage` being non-null is already the "the SERVER wrote this" test: `getErrorMessage`
  // returns null for a non-ApiError, and `request()` leaves `message` empty on every
  // client-authored path — so `Failed to fetch` and `Unexpected token '<'` cannot reach here.
  if (rawMessage && error instanceof ApiError && error.status < 500) {
    return rawMessage;
  }

  // Server error or unknown - show generic message
  return t('error_unexpected', 'An unexpected error occurred. Please try again.');
}
