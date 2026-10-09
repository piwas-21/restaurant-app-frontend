'use client';

// Cart state + actions shared by the classic CartContents and the craft
// CraftCartContents surface, so the two renderings never duplicate the cart
// logic (quantity/remove/checkout wiring, totals, the analytics-tagged
// order-type pick). Each surface renders its own DOM over this.
import React from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import { useCheckoutBlockerHint } from '@/hooks/checkout/useCheckoutBlockerHint';
import { useBasketChannelRecovery } from '@/hooks/order/useBasketChannelRecovery';
import { useTableGuestOrderTypeRecovery } from '@/hooks/order/useTableGuestOrderTypeRecovery';
import { OrderType as OrderTypeEnum, type OrderType } from '@/types/order';

export interface UseCartContentsArgs {
  /** Toggle click handler; `forceModal` reopens the detail flow after a refused checkout. */
  pickType: (type: OrderType, source?: string, forceModal?: boolean) => void | Promise<void>;
  /** Called after checkout routes or when handing missing details to the follow-up modal. */
  onProceed?: () => void;
  /**
   * Analytics surface tag — WHICH cart surface the guest acted on.
   *
   * `'sidebar'` (the default) is /cart's pinned rail. `'cart_sheet'` is the slide-over, which is
   * the only cart surface on /menu since the rail left that page — it was `'mobile_sheet'` while
   * that sheet was mobile-only, and that name stopped being true when it grew a desktop form.
   * The ENTRY POINT stays distinguishable on `cart_opened`'s own source.
   */
  analyticsSource?: string;
}

export function useCartContents({ pickType, onProceed, analyticsSource = 'sidebar' }: UseCartContentsArgs) {
  const { state: cartState, updateItem, removeItem, clearError, syncBasket } = useCart();

  // Drop anything left over from before this surface existed. `state.error` is a single global slot
  // and the provider never remounts, so without this the sidebar on `/menu` would open showing a
  // failure from a different operation on a different route (a refused promo code, say). Runs once:
  // `clearError` is memoized with a stable identity, and an unmemoized one here would clear the
  // error on every render and nothing would ever be readable.
  React.useEffect(() => {
    clearError();
  }, [clearError]);
  const { state: orderTypeState, hasChosenOrderType, setOrderType, setTable } = useOrderType();
  const channelRecovery = useBasketChannelRecovery(cartState.basket, orderTypeState.orderType ?? null, syncBasket);
  const { tableContext } = useTableContext();
  const { tableGuest, selectActiveVisitDineIn } = useTableGuestOrderTypeRecovery({
    orderType: orderTypeState,
    tableContext,
    setOrderType,
    setTable,
  });
  const { proceedToCheckout, isResolving } = useSmartCheckoutRouter();
  const [pendingOrderTypePicks, setPendingOrderTypePicks] = React.useState(0);
  const [isCheckoutPending, setIsCheckoutPending] = React.useState(false);
  const pendingOrderTypePicksRef = React.useRef(0);
  const checkoutAttemptRef = React.useRef(false);
  const orderTypeSelectionRevisionRef = React.useRef(0);
  const currentOrderTypeRef = React.useRef(orderTypeState.orderType);
  currentOrderTypeRef.current = orderTypeState.orderType;

  const items = cartState.items;
  const itemCount = items.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = items.reduce((acc, it) => acc + it.itemTotal, 0);
  const tableGuestAvailabilityBlocked = Boolean(tableGuest.blockerMessageKey);
  const tableGuestCheckoutBlocked =
    tableGuestAvailabilityBlocked || (tableGuest.visitBound && orderTypeState.orderType !== OrderTypeEnum.DineIn);
  const canCheckout = itemCount > 0 && hasChosenOrderType && !tableGuestCheckoutBlocked;
  const hint = useCheckoutBlockerHint(hasChosenOrderType, itemCount > 0, tableGuest.blockerMessageKey ?? null);
  const isOrderTypeSelectionPending = pendingOrderTypePicks > 0 || channelRecovery.isPending;

  const trackOrderTypePick = React.useCallback((selection: void | Promise<void>) => {
    if (selection === undefined) return;

    pendingOrderTypePicksRef.current += 1;
    setPendingOrderTypePicks(pendingOrderTypePicksRef.current);
    const finish = () => {
      pendingOrderTypePicksRef.current = Math.max(0, pendingOrderTypePicksRef.current - 1);
      setPendingOrderTypePicks(pendingOrderTypePicksRef.current);
    };
    void selection.then(finish, finish);
  }, []);

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
    if (
      itemCount === 0 ||
      checkoutAttemptRef.current ||
      pendingOrderTypePicksRef.current > 0 ||
      channelRecovery.isPending
    ) {
      return;
    }
    const orderType = orderTypeState.orderType;
    if (!orderType) {
      hint.setBlocker(tableGuestAvailabilityBlocked ? 'table-guest-unavailable' : 'order-type');
      return;
    }
    checkoutAttemptRef.current = true;
    setIsCheckoutPending(true);
    const selectionRevision = orderTypeSelectionRevisionRef.current;
    let routed = false;
    try {
      const blocker = await proceedToCheckout(orderType, analyticsSource);
      if (selectionRevision !== orderTypeSelectionRevisionRef.current || currentOrderTypeRef.current !== orderType) {
        return;
      }
      hint.setBlocker(blocker);
      // Missing contact/address detail is recoverable in one click: reopen the
      // type's own follow-up modal (forceModal, since Takeaway would otherwise
      // decide it has nothing to ask) rather than bouncing to /menu.
      if (blocker === 'details') {
        onProceed?.();
        pickType(orderType, analyticsSource, true);
      } else if (blocker === null) {
        routed = true;
        onProceed?.();
      }
    } finally {
      // A successful route is a one-shot action until this cart surface unmounts. Recoverable
      // blockers leave the surface available for another attempt after the guest fixes them.
      if (!routed) {
        checkoutAttemptRef.current = false;
        setIsCheckoutPending(false);
      }
    }
  };

  // proceedToCheckout has its own try/catch; fire-and-forget so the DOM handler
  // stays synchronous.
  const handleCheckout = () => void runCheckout();

  // The menu owns ordinary follow-up state above its lazy table-guest runtime. The cart reads the
  // admitted visit below that boundary, so active-visit picks must use this context and never the
  // page callback's loading/default view. Ordinary guests keep the page-owned modal flow.
  const pickTypeForCart = React.useCallback(
    (type: OrderType, source?: string, forceModal?: boolean): void | Promise<void> => {
      if (tableGuest.visitBound) {
        if (type === OrderTypeEnum.DineIn) selectActiveVisitDineIn(source ?? analyticsSource);
        return;
      }
      if (forceModal === undefined) return pickType(type, source);
      return pickType(type, source, forceModal);
    },
    [selectActiveVisitDineIn, pickType, analyticsSource, tableGuest.visitBound],
  );

  // Memoized so OrderTypeToggle doesn't re-render on every parent render, and so
  // the analytics surface tag flows into `order_type_selected`.
  const handlePick = React.useCallback(
    (type: OrderType) => {
      if (checkoutAttemptRef.current) return;
      orderTypeSelectionRevisionRef.current += 1;
      trackOrderTypePick(pickTypeForCart(type, analyticsSource));
    },
    [pickTypeForCart, analyticsSource, trackOrderTypePick],
  );

  return {
    items,
    itemCount,
    subtotal,
    canCheckout,
    /** Translated reason the CTA won't route yet ('' when nothing blocks it). */
    blockerMessage: hint.message,
    isOrderTypeSelectionPending,
    isCheckoutPending,
    isChannelRecoveryVisible: channelRecovery.isVisible,
    isChannelRecoveryRetrying: channelRecovery.isRetrying,
    channelRecoveryErrorMessage: channelRecovery.errorMessage,
    retryChannelRecovery: channelRecovery.retry,
    /** Count of refused checkout attempts that should focus the order-type picker. */
    orderTypeAttempts: hint.blocker === 'order-type' ? hint.attempts : 0,
    /** Cart mutation error text, rendered verbatim by both surfaces. */
    error: cartState.error,
    isSyncing: cartState.isSyncing,
    isResolving,
    handleQty,
    handleRemove,
    handleCheckout,
    handlePick,
  };
}
