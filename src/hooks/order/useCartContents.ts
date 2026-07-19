'use client';

// Cart state + actions shared by the classic CartContents and the craft
// CraftCartContents surface, so the two renderings never duplicate the cart
// logic (quantity/remove/checkout wiring, totals, the analytics-tagged
// order-type pick). Each surface renders its own DOM over this.
import React from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import type { OrderType } from '@/types/order';

export interface UseCartContentsArgs {
  /** Toggle click handler (from useOrderTypeFollowUp.pickType); forwards the surface tag. */
  pickType: (type: OrderType, source?: string) => void;
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

  const handleCheckout = () => {
    if (!canCheckout || !orderTypeState.orderType) return;
    onProceed?.();
    // proceedToCheckout has its own try/catch (toasts on failure); fire-and-forget.
    void proceedToCheckout(orderTypeState.orderType, analyticsSource);
  };

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
    isSyncing: cartState.isSyncing,
    isResolving,
    handleQty,
    handleRemove,
    handleCheckout,
    handlePick,
  };
}
