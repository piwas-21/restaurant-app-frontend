/**
 * Online payment (Stripe Connect) — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * Two calls against the anonymous `PaymentsController`: may we offer online payment at all,
 * and mint the hosted-Checkout page for an order we have already created.
 */

import { apiClient, ApiError, isNotFoundError } from '@/utils/apiClient';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import type {
  CheckoutSessionDto,
  CheckoutSessionApiResponse,
  CheckoutSettlementDto,
  CheckoutSettlementApiResponse,
  OnlinePaymentAvailabilityApiResponse,
} from '@/types/payment';

/**
 * Whether this restaurant can take an online payment right now.
 *
 * **FAILS CLOSED, and that is the whole point of the function.** Every non-answer means "do not
 * offer it", and several of them are normal operation rather than faults:
 *
 * - **404** — the tenant did not buy the module, so the class-level module gate refuses; or the
 *   tenant is running a backend from before this slice and the route does not exist yet.
 * - **any network or parse failure** — we cannot know, and guessing "yes" sends a diner to a
 *   redirect that cannot be minted.
 *
 * The frontend's other module signal does the opposite: `getTenantModules` returns the FULL set on
 * error, so a checkout page gated on that alone would offer online payment to every tenant whose
 * backend hiccuped — and to RUMI permanently, whose module list is absent and therefore reads as
 * unrestricted. This is the call that has to be pessimistic.
 */
export async function getOnlinePaymentAvailability(): Promise<boolean> {
  try {
    const response = await apiClient.get<OnlinePaymentAvailabilityApiResponse>('/api/payments/availability', {
      requireAuth: false,
    });
    // `=== true`, not a truthiness check: `data` is optional on the envelope, and a body that
    // arrived without it must read as unavailable rather than as `undefined` coerced somewhere.
    return response.data?.available === true;
  } catch (error) {
    // The answer is false either way — there is no path on which the server's sentence helps a
    // diner, who can still pay cash and does not need to be told the availability probe failed.
    // But a tenant PAYING for this module who silently stopped being offered it is worth a line
    // in the console, so the two are not treated alike.
    //
    // The discriminator is "did the server actually say something", NOT the status, and that is
    // the correction that matters here. `apiClient` calls `response.json()` BEFORE it checks
    // `response.ok`, so a body it cannot parse becomes `ApiError(500, '')` — and a route-not-found
    // 404 from a backend older than this slice has an EMPTY body. A status test would therefore
    // have warned on the one case that is universal across the fleet today, which is exactly what
    // it was written to avoid. A dead network is `ApiError(0, '')` for the same reason.
    //
    // `ApiError.message` is the SERVER's sentence or `''`, never client-authored, so a non-empty
    // message means the backend answered in its own words — a real fault worth seeing. The
    // module gate's 404 does carry a body (`NotFoundObjectResult` with an `ApiResponse`), hence
    // the explicit 404 exclusion beside it.
    if (error instanceof ApiError && error.message && !isNotFoundError(error)) {
      console.warn('Could not determine online-payment availability; not offering it.', error);
    }
    return false;
  }
}

/**
 * Mint (or re-obtain) the Stripe hosted-Checkout page for an order that already exists.
 *
 * The order must be created FIRST — the amount is taken from the persisted `order.Total` and never
 * from the caller (S0b), and the tender is written at order time so an unpaid dine-in ticket can
 * never reach the pass (§6c).
 */
export async function createCheckoutSession(orderId: string): Promise<CheckoutSessionDto> {
  const response = await apiClient.post<CheckoutSessionApiResponse>(
    '/api/payments/checkout-session',
    { orderId },
    { requireAuth: false },
  );

  // `throwServerRefusal`, not a plain Error: the controller returns `Ok(...)` whatever
  // `ApiResponse.Success` says, so a refusal — a closed order, an already-paid order, a tenant
  // whose Stripe account cannot charge — RESOLVES here with the reason in `errors[0]` while
  // `message` stays the literal "Operation failed". Throwing on the message would show the diner
  // that sentence instead of the real one (frontend #435).
  if (!response.success || !response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}

/**
 * The return trip from Stripe: settle the session and learn where that leaves the order (S9).
 *
 * **This is the PRIMARY settle trigger**, not a read. S7's reconciler is the backstop for a diner
 * who closed the tab; almost every payment in practice settles because this call was made. So it
 * must be made even when the page could render something from elsewhere.
 *
 * It does NOT fail closed the way availability does, and the difference is the point: money has
 * moved by the time anyone calls this, so a failure has to be surfaced rather than swallowed. The
 * caller shows the diner that we could not confirm it yet — never that it failed, which we do not
 * know.
 */
export async function getCheckoutStatus(sessionId: string): Promise<CheckoutSettlementDto> {
  const response = await apiClient.get<CheckoutSettlementApiResponse>(
    `/api/payments/checkout-status?sessionId=${encodeURIComponent(sessionId)}`,
    { requireAuth: false },
  );

  // Same reasoning as createCheckoutSession: a 200-wrapped refusal must not reach the diner as the
  // literal "Operation failed" (#435).
  if (!response.success || !response.data) {
    throwServerRefusal(response);
  }

  return response.data;
}
