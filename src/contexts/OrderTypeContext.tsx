'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { OrderType } from '@/types/order';
import { type DeliveryAddress, useCheckout } from '@/contexts/CheckoutContext';
import { useOrderTypeEnabledGuard } from '@/hooks/order/useOrderTypeEnabledGuard';
import { useServerChannelDisarm } from '@/hooks/order/useServerChannelDisarm';
import {
  ORDER_TYPE_TTL_MS,
  STORAGE_KEY,
  type OrderTypeState,
  initialState,
  loadState,
  saveState,
} from '@/lib/orderTypeStorage';

// Re-exported: the TTL is part of this context's public surface and consumers/tests import it here.
export { ORDER_TYPE_TTL_MS };

/**
 * OrderTypeContext — single source of truth for the order-type decision
 * (and its companion data: dine-in table, delivery address) made on /menu
 * via the welcome modal / sticky header (BUGS-IMPROVEMENTS-PLAN §C1.5).
 *
 * During the C1.5.a → C1.5.d transition, this provider also mirrors writes
 * to CheckoutContext so existing flows (the legacy /checkout/* pages and
 * the cart page's QR-aware redirects) keep working unchanged. Once the
 * legacy flows are deleted (end of C1.5.d), drop the mirror — see the
 * `// MIRROR(CheckoutContext)` markers below.
 *
 * State is persisted to localStorage under its own key so a refresh on
 * /menu re-shows the chosen type without re-prompting the welcome modal.
 */

interface OrderTypeContextType {
  state: OrderTypeState;
  setOrderType: (type: OrderType) => void;
  setTable: (table: string) => void;
  setAddress: (address: DeliveryAddress) => void;
  /** True when an order type has been chosen — drives the welcome modal's open state. */
  hasChosenOrderType: boolean;
  clearOrderType: () => void;
  /**
   * False until the persisted choice has been read back from localStorage.
   *
   * `state.orderType` is `null` both before hydration and when the guest genuinely has no choice,
   * and the two are indistinguishable — so anything whose REQUEST depends on the channel (the menu
   * fetch sends `RequestedOrderType`) must wait, or it fires once with `null` and again with the
   * restored value, flashing every restricted card from undimmed to dimmed. Consumers that merely
   * RENDER the state need not gate on this.
   */
  hydrated: boolean;
}

const OrderTypeContext = createContext<OrderTypeContextType | undefined>(undefined);

export function OrderTypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrderTypeState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const checkout = useCheckout();

  // Hydrate from our own storage. There used to be a one-time backfill here from CheckoutContext,
  // for sessions predating this context — it was dead code and has been removed:
  //
  //  * React runs CHILD effects before PARENT ones, and `CheckoutProvider` wraps this provider
  //    (client-providers.tsx). Its own hydration effect had therefore not run yet, so
  //    `checkout.state.orderType` was always null here and the branch never fired. The test that
  //    "covered" it passed only because the mock supplied a pre-hydrated checkout state.
  //  * Do not reinstate it by reordering the providers either: a backfill would resurrect an
  //    expired choice from `rumi_checkout_state` (which has no TTL of its own) and re-stamp it,
  //    renewing the 24h window forever. The mirror is one-directional on purpose.
  //
  // Also note: an older comment here claimed "/checkout/order-type still writes to
  // CheckoutContext directly". That was false, and the claim leaked into a plan as a phantom
  // divergence bug (ORDER-TYPE-AVAILABILITY-PLAN §3.3 refutes it). The only writers of
  // CheckoutContext.orderType are the mirrored calls below.
  const { requestServerDisarm, cancelPendingDisarm } = useServerChannelDisarm();

  useEffect(() => {
    const { state: loaded, expired } = loadState();
    setState(loaded);
    setHydrated(true);

    // The TTL does NOT run through `clearOrderType` — `loadState` returns the empty state directly —
    // so without this the flagship §9.17 case stayed open: a month-old Delivery expires locally, the
    // server basket stays armed on Delivery, and every add is refused for a channel the guest no
    // longer holds. Sharpest for a payload written before `chosenAt` existed, which expires on the
    // very next load, well inside any plausible basket lifetime.
    if (expired) requestServerDisarm();
  }, [requestServerDisarm]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Memoised: `useOrderTypeEnabledGuard` has these in an effect dep array, and a fresh identity
  // on every provider render re-ran the guard on every render.
  const setOrderType = useCallback(
    (type: OrderType) => {
      // Cancels any disarm still pending. The guest now HOLDS a channel, so a DELETE queued moments
      // ago (G4 clearing before G8 assigned this one) must not land after the PUT that asserts it.
      cancelPendingDisarm();
      setState((prev) => ({ ...prev, orderType: type, chosenAt: Date.now() }));
      checkout.setOrderType(type); // MIRROR(CheckoutContext) — drop after C1.5.d
    },
    [checkout, cancelPendingDisarm],
  );

  // Deliberately does NOT refresh `chosenAt`: picking a table is not a fresh decision about the
  // CHANNEL, and renewing on every companion write would let an always-open tab stay valid
  // indefinitely — the one thing the TTL exists to stop.
  const setTable = (table: string) => {
    setState((prev) => ({ ...prev, table }));
    checkout.setTableNumber(table); // MIRROR(CheckoutContext)
  };

  const setAddress = (address: DeliveryAddress) => {
    setState((prev) => ({ ...prev, deliveryAddress: address }));
    checkout.setDeliveryAddress(address); // MIRROR(CheckoutContext)
  };

  const clearOrderType = useCallback(() => {
    setState(initialState);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    // MIRROR(CheckoutContext). This used to clear only OUR half, on the reasoning that touching
    // CheckoutContext would wipe customerInfo/tip. True of `clearCheckout()` — but leaving the
    // mirror stale meant every clear path (the 24h TTL, the enabled-list guard, clearing the
    // table) left the abandoned channel in the store that `useCheckoutPrereqGuard` and the tax
    // calculation read, so the guest could still place an order on it. `clearOrderTypeSelection`
    // drops exactly the mirrored fields and keeps the contact details.
    checkout.clearOrderTypeSelection();

    // §9.17. Clearing locally is only half of it: the SERVER basket keeps whatever channel it was
    // given, and `BasketChannelGuard` judges every later add against it — so a guest who now holds
    // no channel could still be refused for one. Until the DELETE existed the client could not say
    // this at all, because the PUT takes a non-nullable order type.
    //
    // Callers, all of which genuinely leave the guest holding nothing: `useOrderTypeEnabledGuard`
    // (G4 — the held channel is no longer offered), `TableBanner` (only when the pin is the
    // scan-derived DineIn) and `useCheckoutReview` (after the cart is emptied). The 24h TTL is NOT
    // among them — it never reaches this function — and is handled at hydration instead.
    //
    // Safe unconditionally: the endpoint is idempotent, never removes lines, and answers success
    // when there is no basket, so a guest with an empty cart costs one cheap no-op.
    requestServerDisarm();
  }, [checkout, requestServerDisarm]);

  const value: OrderTypeContextType = {
    state,
    setOrderType,
    setTable,
    setAddress,
    hasChosenOrderType: state.orderType !== null,
    clearOrderType,
    hydrated,
  };

  return (
    <OrderTypeContext.Provider value={value}>
      <OrderTypeEnabledGuard />
      {children}
    </OrderTypeContext.Provider>
  );
}

/**
 * Renders nothing; exists so the G4/G8 guard runs exactly once, app-wide, and INSIDE the provider
 * whose state it reads. Keeping it out of `OrderTypeProvider` itself means the provider does not
 * grow an API fetch, and the guard stays unit-testable on its own.
 */
function OrderTypeEnabledGuard() {
  useOrderTypeEnabledGuard();
  return null;
}

export const useOrderType = () => {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) {
    throw new Error('useOrderType must be used within an OrderTypeProvider');
  }
  return ctx;
};
