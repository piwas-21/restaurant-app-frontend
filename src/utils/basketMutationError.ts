/**
 * Telling the two basket 404s apart.
 *
 * `PUT|DELETE /api/Basket/items/{id}` fails in two ways that demand OPPOSITE handling, and both are
 * a 404:
 *
 * - the addressed ITEM is gone — normally the guest removed it in another tab. Benign: resync and
 *   say nothing, because the cart the server returns is the truth and there is nothing to report.
 * - the whole BASKET ROW is gone — reaped by `BasketCleanupService`, or the session id expired.
 *   A real failure that must be shown, and the one case where resyncing is destructive: `GetBasketQuery`
 *   answers a missing basket with an empty basket and a SUCCESS, so a resync here replaces the
 *   guest's entire cart with "Your cart is empty" and reports nothing (issue #415).
 *
 * Mirrors `ErrorCodes.BasketNotFound` / `ErrorCodes.BasketItemNotFound` (backend
 * `Common/Models/ErrorCodes.cs`). Same reasoning as `addToCartError.ts`: gate on the CODE, never on
 * the message. The predecessor of this module was a substring test for `'not found'` inside the
 * mutation hook, and `"Basket not found".includes('not found')` is true — so the destructive case
 * matched the benign branch. A message test cannot be made safe here: the two sentences differ by
 * one word today and are one localisation away from not differing in any parseable way at all.
 */

import { ApiError } from '@/utils/apiClient';

const BASKET_NOT_FOUND = 'BasketNotFound';
const BASKET_ITEM_NOT_FOUND = 'BasketItemNotFound';

/**
 * The item is already gone — the ONE basket failure a caller may recover from silently.
 *
 * Deliberately false for anything that is not a coded `ApiError`, which makes the fail-safe the
 * right way round: an unrecognised failure reports rather than resyncing. That matters because the
 * backend does not carry these codes yet on every deployment — before it does, both cases simply
 * take the reporting branch, which is the safe half.
 */
export function isBasketItemAlreadyGone(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === BASKET_ITEM_NOT_FOUND;
}

/**
 * The basket row itself is gone, so the failure is real and the guest must be told.
 *
 * Callers should show a LOCALIZED sentence for this rather than the server's: unlike the channel
 * guard's rejection, "Basket not found" is an internal description, not something written for a
 * guest. `error_basket_not_found` ("Your shopping cart is empty or expired") already exists in all
 * ten locales for exactly this.
 */
export function isBasketGone(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === BASKET_NOT_FOUND;
}

/**
 * The server broke. Its words describe an internal fault, so a caller must show its OWN sentence.
 *
 * These endpoints only started producing renderable 5xx text when the backend stopped wrapping
 * every failure in an HTTP 200 (see `UpdateBasketItemCommandHandler`). Before that, `basketService`
 * threw a plain `Error`, `getErrorMessage` returned null, and the guest got the localized fallback.
 * Without this predicate that same failure would newly render "An error occurred while processing
 * your request" — untranslated, in all ten locales.
 *
 * On a DEVELOPMENT build it is worse: the middleware puts `exception.ToString()` into `errors[0]`,
 * which `getErrorMessage` prefers over `message`, so a full stack trace would render in the cart.
 * That is a local-only exposure — both deployed boxes run `ASPNETCORE_ENVIRONMENT=Production`
 * (`deploy/docker-compose.prod.yml`), so staging does NOT emit traces.
 */
export function isServerFault(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 500;
}
