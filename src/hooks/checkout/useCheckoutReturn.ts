'use client';

// The diner coming back from Stripe (SOFRA-PAYMENTS-PLAN §5 S9). This is the PRIMARY settle
// trigger — S7's reconciler is the backstop for someone who closed the tab — so the call here is
// not a read of state that already exists, it is what MAKES the payment settle.
import { useEffect, useRef, useState } from 'react';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useCart } from '@/components/cart/CartContext';
import { getCheckoutStatus } from '@/services/paymentService';
import { forgetUnpaidOnlineOrder } from '@/lib/checkout/unpaidOnlineOrder';
import type { CheckoutSettlementDto } from '@/types/payment';

/**
 * What to tell the diner. Deliberately NOT a mirror of the wire statuses — the page needs to know
 * which of three sentences to show, and collapsing that decision here keeps it in one testable
 * place instead of spread across a template's JSX.
 */
export type CheckoutReturnOutcome =
  /** No `sessionId` in the URL — this is an ordinary confirmation visit, not a return trip. */
  | 'none'
  | 'settling'
  /** The money is in. */
  | 'paid'
  /** The session expired or was retired, and the order is cancelled with it. */
  | 'cancelled'
  /** Settled without a definite answer yet — a delayed method still clearing, or an open session. */
  | 'pending'
  /** We could not reach the backend. Says nothing about whether the diner paid. */
  | 'unknown';

export interface CheckoutReturn {
  outcome: CheckoutReturnOutcome;
  settlement: CheckoutSettlementDto | null;
}

/**
 * Maps the order's own two statuses onto what the page says.
 *
 * The default is **pending, never paid**. Claiming success is the one error with no recovery: a
 * diner told "thank you, your order is confirmed" stops watching, and if the money never actually
 * arrived nobody finds out until the kitchen does not cook. Any status this code has not seen —
 * Stripe and the backend both add states over time — has to land on the cautious sentence.
 */
function outcomeFor(settlement: CheckoutSettlementDto): CheckoutReturnOutcome {
  if (settlement.orderStatus === 'Cancelled') return 'cancelled';
  if (settlement.paymentStatus === 'Completed') return 'paid';
  return 'pending';
}

export function useCheckoutReturn(sessionId: string | null): CheckoutReturn {
  const { clearCheckout } = useCheckout();
  const { clearOrderType } = useOrderType();
  const { clearCart } = useCart();

  const [outcome, setOutcome] = useState<CheckoutReturnOutcome>(sessionId ? 'settling' : 'none');
  const [settlement, setSettlement] = useState<CheckoutSettlementDto | null>(null);

  // React 18 StrictMode double-invokes effects in development, and this effect SETTLES A PAYMENT.
  // The call is idempotent server-side, so a second one is harmless — but it also clears the cart,
  // and doing that twice races the first clear's request. Once per session id.
  const settledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || settledRef.current === sessionId) return;
    settledRef.current = sessionId;

    let active = true;

    const settle = async () => {
      try {
        const result = await getCheckoutStatus(sessionId);
        const resolved = outcomeFor(result);

        // Unconditionally, whatever the outcome: this order is over one way or the other, so the
        // remembered id must never be re-used. Leaving it means the diner's NEXT order on this tab
        // re-uses a paid or cancelled order and meets a refusal they cannot act on (plan §6d).
        forgetUnpaidOnlineOrder();

        // The cart survives a cancellation ON PURPOSE. S8 kept it through the whole redirect so an
        // abandoning diner comes back to a page that works; emptying it here — at the exact moment
        // we tell them the payment did not go through — would take away the one thing that lets
        // them try again. It is cleared only once the money is actually in.
        if (resolved === 'paid') {
          await clearCart();
          clearCheckout();
          clearOrderType();
        }

        if (!active) return;
        setSettlement(result);
        setOutcome(resolved);
      } catch (error) {
        // NOT swallowed into a failure claim. Money has moved by the time anyone reaches this
        // page, and a backend we cannot reach tells us nothing about whether it arrived — so the
        // diner is told we could not confirm it yet, never that it failed.
        console.error('Could not settle the checkout session on return:', error);
        if (active) setOutcome('unknown');
      }
    };

    void settle();

    return () => {
      active = false;
    };
    // clearCart/clearCheckout/clearOrderType are context callbacks and are deliberately not
    // dependencies: they are re-created per render, and listing them would re-run a SETTLEMENT on
    // every cart mutation. The ref guard above is the real protection; this keeps it honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return { outcome, settlement };
}
