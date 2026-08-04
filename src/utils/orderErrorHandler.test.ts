/**
 * `getTranslatedOrderError` had no test, and its substring map was 0/7 live (#435).
 *
 * The map read as coverage of the checkout failure surface. It was not, and could not have been:
 * `OrdersController` returns `Ok(...)` whatever `ApiResponse.Success` says, so a refusal RESOLVES
 * instead of throwing; `ApiResponse.Failure(reason)` leaves `Message` at the literal "Operation
 * failed" and puts the reason in `errors[0]`; and the service rethrew
 * `new Error(response.message || …)` — a plain Error, for which `getErrorMessage` returns null by
 * design. So `rawMessage` was always null, `''.includes(pattern)` is always false, and EVERY
 * checkout refusal reached the customer as the generic "An unexpected error occurred."
 *
 * The fix is in the transport (`orderCommands` now uses `throwServerRefusal`); this file pins what
 * the util does once a real reason actually arrives.
 */

import { ApiError } from '@/utils/apiClient';
import { getTranslatedOrderError } from './orderErrorHandler';

// No `jest.mock` on purpose. The real `ApiError` and `getErrorMessage` are load-bearing —
// `getErrorMessage` prefers `errors[]` over `message`, which is the whole reason the reason becomes
// visible — and an unmocked import already resolves to the real module. A
// `jest.mock(..., requireActual)` line here would be a no-op that reads as load-bearing; the root
// `__mocks__` manual mock is NOT auto-applied to a user module without an explicit `jest.mock`.

/** i18next's `t(key, defaultValue)`, faithful enough for these assertions. */
const t = ((key: string, _fallback?: string) => `T:${key}`) as unknown as Parameters<typeof getTranslatedOrderError>[1];

/** Exactly what `throwServerRefusal` mints for a handler refusal wrapped in a 200. */
const envelopeRefusal = (reason: string) => new ApiError(200, 'Operation failed', [reason]);

describe('getTranslatedOrderError', () => {
  // THE #435 regression. Before the transport fix this returned the generic, because the reason
  // never left errors[0] and the thrown value was not an ApiError at all.
  it('translates the delivery-address refusal the checkout handler actually authors', () => {
    const error = envelopeRefusal('Delivery address is required for delivery orders');

    expect(getTranslatedOrderError(error, t)).toBe('T:error_delivery_address_required');
  });

  // Pins the `< 500` widening. The message is SYNTHETIC on purpose and no real refusal is claimed:
  // both `ApiResponse.Failure` returns reachable from this path (delivery address, menu-not-found)
  // hit a mapping above and return before this bound, so nothing in production exercises status 200
  // here today. The widening is forward-looking — a future unmapped 200 refusal shows its own
  // reason instead of a generic — and the old `>= 400` bound would silently discard it.
  //
  // Deliberately NOT the empty-basket message, which reads like the obvious fixture and is wrong:
  // `CreateOrderFromBasketCommandHandler` THROWS `BadRequestException`, so it arrives as a genuine
  // 400 that the old bound already handled.
  it('shows the server sentence for an envelope refusal that maps to nothing', () => {
    const error = envelopeRefusal('Synthetic future refusal with no mapping');

    expect(getTranslatedOrderError(error, t)).toBe('Synthetic future refusal with no mapping');
  });

  // The two refusals `OrderItemFactory` authors one branch apart, both carrying an internal GUID:
  // a bundle or a product in the basket that has since been deleted. Unmapped, the fall-through
  // would print that GUID to a customer — strictly worse than the generic it replaced.
  it.each([
    ['menu', 'Menu 8f3e2a91-4c7b-4d1e-9a2f-1b3c5d7e9f01 not found'],
    ['product', 'Product 3f2a1c05-9d8e-4b6a-8c7f-2e4d6a8b0c13 not found'],
  ])('translates the %s-not-found refusal instead of showing its GUID', (_kind, message) => {
    expect(getTranslatedOrderError(envelopeRefusal(message), t)).toBe('T:error_product_unavailable');
  });

  // Anchored on the GUID shape, so a bare `not found` cannot swallow unrelated refusals.
  it.each(['Coupon SUMMER24 not found', 'Menu of the day not found'])(
    'does not treat %s as a missing entity',
    (message) => {
      expect(getTranslatedOrderError(envelopeRefusal(message), t)).toBe(message);
    },
  );

  it('shows the server sentence for a real client error', () => {
    const error = new ApiError(400, 'Order total must be greater than zero');

    expect(getTranslatedOrderError(error, t)).toBe('Order total must be greater than zero');
  });

  // 5xx prose is not written for a customer, so the bound still excludes it at the top end.
  it('falls back to the generic for a server error, even when it carries text', () => {
    const error = new ApiError(500, 'Npgsql.PostgresException: deadlock detected');

    expect(getTranslatedOrderError(error, t)).toBe('T:error_unexpected');
  });

  // `request()` leaves `message` empty on every client-authored path precisely so these cannot be
  // rendered; `getErrorMessage` returns null and we must not print `Failed to fetch`.
  it('falls back to the generic for a client-authored throw with no server message', () => {
    expect(getTranslatedOrderError(new ApiError(0, ''), t)).toBe('T:error_unexpected');
    expect(getTranslatedOrderError(new TypeError('Failed to fetch'), t)).toBe('T:error_unexpected');
  });

  // The deleted `Order type` pattern was two words long and matched the SUCCESS string
  // "Order type cleared". Pinned so nobody reintroduces a pattern short enough to do that.
  it('does not translate a message that merely mentions an order type', () => {
    const error = envelopeRefusal('Order type cleared');

    expect(getTranslatedOrderError(error, t)).toBe('Order type cleared');
  });

  // The other five deleted patterns belonged to basket, cashier and payment endpoints this catch
  // cannot see. If one ever does reach here, it should show the server's words, not a key invented
  // for a failure mode that was never on this path.
  it.each([
    'Product not found',
    'Invalid table number',
    'Payment amount does not match the order total',
    'Basket not found',
  ])('does not translate %s, which no longer has a mapping', (reason) => {
    expect(getTranslatedOrderError(envelopeRefusal(reason), t)).toBe(reason);
  });
});
