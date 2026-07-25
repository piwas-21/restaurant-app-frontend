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
  const { state: cartState, updateItem, removeItem } = useCart();
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
      /* CartContext surfaces the error */
    });
  };

  const handleRemove = (basketItemId: string | undefined) => {
    if (!basketItemId) return;
    removeItem(basketItemId).catch(() => {
      /* CartContext surfaces the error */
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
    isSyncing: cartState.isSyncing,
    isResolving,
    handleQty,
    handleRemove,
    handleCheckout,
    handlePick,
  };
}
