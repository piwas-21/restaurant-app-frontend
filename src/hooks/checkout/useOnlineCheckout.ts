'use client';

// The online-payment branch of "Place Order" (SOFRA-PAYMENTS-PLAN §5 S8), extracted from
// useCheckoutReview because the two branches agree on almost nothing after the order exists:
// the cash path finishes on this page, the online path hands the diner to Stripe and finishes
// somewhere else entirely (S9, the return trip).
import { createOrderFromBasket } from '@/services/orderService';
import { createCheckoutSession } from '@/services/paymentService';
import { ApiError } from '@/utils/apiClient';
import { navigateExternal } from '@/lib/navigateExternal';
import {
  fingerprintOrderCommand,
  forgetUnpaidOnlineOrder,
  readUnpaidOnlineOrder,
  rememberUnpaidOnlineOrder,
} from '@/lib/checkout/unpaidOnlineOrder';
import type { CreateOrderFromBasketCommand } from '@/types/order';

/**
 * The statuses on which the SAME order can never be paid: the order is closed, already paid, or
 * was cancelled by the expiry sweep while the diner sat on this page (S7). Retrying that id is
 * futile, so it must be forgotten and the next attempt must build a fresh order.
 *
 * **An allow-list, not a `>= 400 && < 500` range, and the difference is not academic.** The range
 * classifies **429** as permanent — and `POST /api/payments/checkout-session` is rate-limited
 * (`[EnableRateLimiting("checkout-session")]`, 10 per 15 minutes partitioned by IP) while order
 * CREATION is not. A dine-in room shares one public IP over the venue Wi-Fi, so that limit is an
 * ordinary Friday rather than an attack: every press would mint another order with its own
 * `Processing` tender, unbounded, each blocking Confirm until the sweep runs. It would have turned
 * this hook into the precise inverse of its own purpose. `apiClient` also emits `ApiError(429, '')`
 * from its own transient token-refresh path, and 408 is transient by definition.
 *
 * The default is therefore **keep**, and the asymmetry is deliberate. Wrongly keeping costs the
 * diner one refusal they can read; wrongly forgetting costs unbounded duplicate orders.
 *
 * 200 stays in the list for the shape where a controller answers `Ok(ApiResponse.Failure(...))`
 * and `throwServerRefusal` converts it (frontend #435). The eligibility refusals themselves arrive
 * as **400** — `OnlinePaymentEligibility` throws `BadRequestException`, which the exception
 * middleware maps — verified in the backend rather than assumed.
 */
const PERMANENT_REFUSAL_STATUSES: ReadonlySet<number> = new Set([200, 400, 404, 409, 410, 422]);

function orderCanNeverBePaid(error: unknown): boolean {
  return error instanceof ApiError && PERMANENT_REFUSAL_STATUSES.has(error.status);
}

export function useOnlineCheckout() {
  /**
   * Create the order (or re-use the one a previous attempt already created), mint the hosted
   * Checkout page, and send the browser to Stripe.
   *
   * Resolving is not the interesting outcome: on success it resolves having ALREADY asked the
   * browser to leave for Stripe, so the caller must not treat a resolve as "the order is done".
   * It rejects with the server's own sentence on every failure.
   */
  const payOnline = async (command: CreateOrderFromBasketCommand): Promise<void> => {
    const signature = fingerprintOrderCommand(command);
    const remembered = readUnpaidOnlineOrder();

    // Re-use ONLY an order built from this same command. After a failed attempt the page is fully
    // interactive again, so the diner can add a tip or redeem points before pressing again — and
    // the charge comes from the persisted `order.Total`, not from this request, so re-using the
    // old order would charge the old figure while the summary on screen showed the new one.
    const reusableOrderId = remembered?.signature === signature ? remembered.orderId : null;

    const orderId = reusableOrderId ?? (await createOrderFromBasket(command)).id;
    rememberUnpaidOnlineOrder({ orderId, signature });

    try {
      const session = await createCheckoutSession(orderId);
      navigateExternal(session.url);
    } catch (error) {
      if (orderCanNeverBePaid(error)) forgetUnpaidOnlineOrder();
      throw error;
    }
  };

  return { payOnline };
}
