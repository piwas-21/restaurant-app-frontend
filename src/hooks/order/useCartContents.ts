'use client';

// Cart state + actions shared by the classic CartContents and the craft
// CraftCartContents surface, so the two renderings never duplicate the cart
// logic (quantity/remove/checkout wiring, totals, the analytics-tagged
// order-type pick). Each surface renders its own DOM over this.
import React from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import { useCheckoutBlockerHint } from '@/hooks/checkout/useCheckoutBlockerHint';
import type { OrderType } from '@/types/order';

export interface UseCartContentsArgs {
  /**
   * Toggle click handler (from useOrderTypeFollowUp.pickType); forwards the
   * surface tag. The third argument forces the follow-up modal open even when
   * the type would normally commit silently — that's how a blocked checkout
   * re-collects the details it's missing.
   */
  pickType: (type: OrderType, source?: string, forceModal?: boolean) => void;
  /** Fired right after Proceed-to-Checkout (lets a mobile sheet close first). */
  onProceed?: () => void;
  /** Analytics surface tag ('sidebar' | 'mobile_sheet' | …). */
  analyticsSource?: string;
}

export function useCartContents({ pickType, onProceed, analyticsSource = 'sidebar' }: UseCartContentsArgs) {
  const { state: cartState, updateItem, removeItem, clearError } = useCart();

  // Drop anything left over from before this surface existed. `state.error` is a single global slot
  // and the provider never remounts, so without this the sidebar on `/menu` would open showing a
  // failure from a different operation on a different route (a refused promo code, say). Runs once:
  // `clearError` is memoized with a stable identity, and an unmemoized one here would clear the
  // error on every render and nothing would ever be readable.
  React.useEffect(() => {
    clearError();
  }, [clearError]);
  const { state: orderTypeState, hasChosenOrderType } = useOrderType();
  const { proceedToCheckout, isResolving } = useSmartCheckoutRouter();

  const items = cartState.items;
  const itemCount = items.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = items.reduce((acc, it) => acc + it.itemTotal, 0);
  const canCheckout = itemCount > 0 && hasChosenOrderType;
  const hint = useCheckoutBlockerHint(hasChosenOrderType, itemCount > 0);

  const handleQty = (basketItemId: string | undefined, next: number) => {
    if (!basketItemId || next < 1) return;
    updateItem(basketItemId, next).catch(() => {
      /* Reported via `error` below, which both surfaces render — see the note on the return. */
    });
  };

  const handleRemove = (basketItemId: string | undefined) => {
    if (!basketItemId) return;
    removeItem(basketItemId).catch(() => {
      /* Reported via `error` below, which both surfaces render — see the note on the return. */
    });
  };

  // Deliberately NOT gated on `canCheckout` — a click with no order type has to
  // reach here to say so. Only an empty cart is a true no-op.
  const runCheckout = async () => {
    if (itemCount === 0) return;
    const orderType = orderTypeState.orderType;
    if (!orderType) {
      hint.setBlocker('order-type');
      return;
    }
    onProceed?.();
    const blocker = await proceedToCheckout(orderType, analyticsSource);
    hint.setBlocker(blocker);
    // Missing contact/address detail is recoverable in one click: reopen the
    // type's own follow-up modal (forceModal, since Takeaway would otherwise
    // decide it has nothing to ask) rather than bouncing to /menu.
    if (blocker === 'details') {
      pickType(orderType, analyticsSource, true);
    }
  };

  // proceedToCheckout has its own try/catch; fire-and-forget so the DOM handler
  // stays synchronous.
  const handleCheckout = () => void runCheckout();

  // Memoized so OrderTypeToggle doesn't re-render on every parent render, and so
  // the analytics surface tag flows into `order_type_selected`.
  const handlePick = React.useCallback(
    (type: OrderType) => pickType(type, analyticsSource),
    [pickType, analyticsSource],
  );

  return {
    items,
    itemCount,
    subtotal,
    canCheckout,
    /** Translated reason the CTA won't route yet ('' when nothing blocks it). */
    blockerMessage: hint.message,
    /**
     * The cart's failure sentence, resolved for display, or null. Render it verbatim — do NOT pass
     * it through `t()`. "Resolved" is not the same as "translated": a 5xx or a message-less failure
     * yields a localized string, but a 4xx deliberately carries the SERVER's own sentence, which is
     * English. That is the existing contract (the channel guard's reason is written for the guest
     * and is the actionable half of that feature), not an oversight.
     *
     * These surfaces swallow the rethrow from `handleQty`/`handleRemove`, and until #415 nothing
     * here read this — so on `/menu`, the page guests actually order from, a failed line edit
     * showed NOTHING: the cart just snapped back. Only the legacy `/cart` route had an error slot.
     * Both consumers render it now; deleting either render brings the silence back.
     */
    error: cartState.error,
    isSyncing: cartState.isSyncing,
    isResolving,
    handleQty,
    handleRemove,
    handleCheckout,
    handlePick,
  };
}
