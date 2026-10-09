'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSessionContext } from '@/contexts/SessionContext';
import {
  isBasketChannelSessionChangedError,
  releaseUncommittedBasketChannelSelection,
  setBasketOrderTypeAndRefresh,
  useAssertBasketChannel,
} from '@/hooks/order/useAssertBasketChannel';
import type { BasketChannelConflict } from '@/types/basketChannel';
import { OrderType } from '@/types/order';

/**
 * A switch the guest has to confirm because it would remove lines.
 *
 * It carries the ORIGINATING intent (`source`, `forceModal`) rather than the caller parking that in
 * a ref: the confirm can only ever replay the pick that created it, so a second, refused pick
 * cannot silently retarget the surface tag or drop a `forceModal` the cart page asked for.
 */
export interface PendingOrderTypeSwitch {
  orderType: OrderType;
  conflicts: BasketChannelConflict[];
  /** Analytics surface tag of the pick that raised this confirm. */
  source: string;
  /** Whether that pick wanted its follow-up modal forced open. */
  forceModal: boolean;
}

export interface OrderTypeSwitchFlow {
  /** Non-null while the itemized confirm is open. */
  pending: PendingOrderTypeSwitch | null;
  /** True while the confirmed removal is in flight — the modal disables its exits on this. */
  isApplying: boolean;
  /** Set when a confirmed removal failed, so the modal can say so instead of just vanishing. */
  error: string | null;
  /**
   * Ask the server to move the basket onto `orderType`.
   *
   * Resolves `true` when the caller may commit the type, `false` when it must NOT — either an
   * itemized confirm is now open, or another switch is already resolving.
   */
  request: (orderType: OrderType, source: string, forceModal: boolean) => Promise<boolean>;
  /**
   * Apply the pending switch, removing the conflicting lines. Resolves the switch to commit —
   * intent included — or null when it failed.
   */
  confirm: () => Promise<PendingOrderTypeSwitch | null>;
  /** Abandon the pending switch. The basket and the order type are both left alone. */
  cancel: () => void;
}

/**
 * The two-phase basket order-type switch (ORDER-TYPE-AVAILABILITY-PLAN §4.4).
 *
 * Telling the server the channel is the point, not a side effect: `Basket.OrderType` starts null,
 * null is permissive, and **nothing in this app has ever set it** — so `BasketChannelGuard` has been
 * permitting every add since the feature shipped. Wiring the switch is what arms it, and the confirm
 * modal is what makes arming it safe, because a switch that arms the guard is also a switch that can
 * orphan lines already in the cart.
 */
export function useOrderTypeSwitch(): OrderTypeSwitchFlow {
  const { state, syncBasket } = useCart();
  const { state: orderTypeState } = useOrderType();
  const { ensureSession } = useSessionContext();
  const [pending, setPending] = useState<PendingOrderTypeSwitch | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `state.items`, NOT `state.basket.items`. An optimistic add lands in `items` immediately and only
  // reaches `basket` when the server response dispatches SYNC_BASKET — so reading `basket` calls a
  // cart that just gained a line "empty", skips the conflict check, and orphans that very line.
  // `basket` is also null outright after a failed mount sync.
  const lineCount = state.items.length;
  const hasLines = lineCount > 0;

  // One switch resolves at a time. The toggle offers no pending affordance and does not disable, so
  // a second tap is fully available; interleaved resolutions otherwise leave the modal naming one
  // channel while the toggle shows another, and the confirm then deletes lines for the channel the
  // guest already left.
  const inFlightRef = useRef(false);

  // Reconcile from the last synced basket; optimistic items separately decide whether a switch checks conflicts.
  const { markAttempted } = useAssertBasketChannel(state.basket, orderTypeState.orderType, syncBasket);

  const request = useCallback(
    async (orderType: OrderType, source: string, forceModal: boolean): Promise<boolean> => {
      // Re-picking the type already in force is not a switch — the cart and details surfaces do
      // exactly this to re-open the contact/address modal when something is missing. Running a
      // conflict check there offers to delete items over a switch that is not happening.
      if (orderType === orderTypeState.orderType) return true;
      if (inFlightRef.current || pending !== null) return false;

      // An empty cart has nothing to conflict, so the guest must not wait on a round-trip to see
      // their own tap register. The server is still told — fire-and-forget — because that call is
      // what arms the guard. `ensureSession` first: without a session header the request is refused
      // outright, and the FIRST pick a guest makes is usually on an empty cart.
      //
      // Since §9.13 that call STICKS when the cart really is empty: the endpoint upserts instead of
      // 404ing, so the basket is created already carrying the channel rather than being armed later
      // by the effect below. "Really is" matters — the client can believe the cart is empty when a
      // mount sync failed — so the effect remains the backstop for a failed or refused call.
      if (!hasLines) {
        // Inside the try: `ensureSession` reads/writes storage and rethrows on failure, and an
        // exception escaping here would reject `pickType` from inside an onClick — the guest's tap
        // would do nothing at all, over a pre-flight nicety.
        try {
          ensureSession();
          markAttempted(orderTypeState.orderType);
          // Keep the tap immediate, but do not enable table-round submission until this mutation
          // and its canonical read settle. The old marker is held only until commitType changes it.
          void setBasketOrderTypeAndRefresh(orderType, state.basket, syncBasket)
            .then(({ result, basketRefreshed }) => {
              if (!result.applied || !basketRefreshed) markAttempted(orderType);
            })
            .catch((err) => {
              markAttempted(orderType);
              console.warn('Could not pre-set the basket order type:', err);
            });
        } catch (err) {
          markAttempted(null);
          console.warn('Could not pre-set the basket order type:', err);
        }
        return true;
      }

      inFlightRef.current = true;
      // Do not let the reconciliation effect race this user-directed switch against the old choice.
      markAttempted(orderTypeState.orderType);
      try {
        const { result, basketRefreshed } = await setBasketOrderTypeAndRefresh(orderType, state.basket, syncBasket);
        if (result.applied || result.conflicts.length === 0) {
          if (!result.applied || !basketRefreshed) markAttempted(orderType);
          return true;
        }
        setPending({ orderType, conflicts: result.conflicts, source, forceModal });
        return false;
      } catch (err) {
        if (isBasketChannelSessionChangedError(err)) return false;
        // Fail open on a network error; OrderChannelGuard still blocks an unfulfillable order.
        console.warn('Order-type conflict check failed; allowing the switch:', err);
        markAttempted(orderType);
        return true;
      } finally {
        inFlightRef.current = false;
      }
    },
    [hasLines, pending, state.basket, syncBasket, orderTypeState.orderType, ensureSession, markAttempted],
  );

  const confirm = useCallback(async (): Promise<PendingOrderTypeSwitch | null> => {
    if (!pending || isApplying) return null;
    setIsApplying(true);
    setError(null);
    markAttempted(orderTypeState.orderType);
    try {
      const { result, basketRefreshed } = await setBasketOrderTypeAndRefresh(
        pending.orderType,
        state.basket,
        syncBasket,
        true,
      );
      if (!result.applied || !basketRefreshed) {
        throw new Error('The basket channel switch was not reconciled.');
      }
      setPending(null);
      return pending;
    } catch (err) {
      // Unlike the CHECK, this fails CLOSED: the guest agreed to a removal that did not happen, so
      // committing the type would arm the new channel over a cart still holding lines it forbids.
      // The dialog stays open carrying the reason — vanishing silently leaves the guest believing
      // they removed items they still have.
      console.error('Failed to apply the order-type switch:', err);
      setError('order_type_conflict_error');
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [pending, isApplying, state.basket, syncBasket, orderTypeState.orderType, markAttempted]);

  const cancel = useCallback(() => {
    releaseUncommittedBasketChannelSelection(orderTypeState.orderType);
    setPending(null);
    setError(null);
  }, [orderTypeState.orderType]);

  // Memoised so this hook is not the thing churning `pickType`'s identity. It does NOT make
  // `pickType` stable — `syncBasket`, `ensureSession` and `setOrderType` are all unmemoised arrows
  // inside unmemoised provider values, so the three "stable pickType" comments downstream
  // (useCartContents, OrderFlowModals, menu/page) were already false before this PR. Memoising
  // those provider values is its own chore; this is just not adding to the problem.
  return useMemo(
    () => ({ pending, isApplying, error, request, confirm, cancel }),
    [pending, isApplying, error, request, confirm, cancel],
  );
}
