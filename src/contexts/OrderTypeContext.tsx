'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { OrderType } from '@/types/order';
import { type DeliveryAddress, useCheckout } from '@/contexts/CheckoutContext';
import { useOrderTypeEnabledGuard } from '@/hooks/order/useOrderTypeEnabledGuard';

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

interface OrderTypeState {
  orderType: OrderType | null;
  table: string;
  deliveryAddress: DeliveryAddress | null;
  /**
   * When the order type was chosen, epoch ms. Drives the TTL below; `null` on a state with no
   * choice, and on a payload written before this field existed (which then expires immediately —
   * deliberate, since we cannot tell a five-minute-old choice from a month-old one).
   */
  chosenAt: number | null;
}

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

const STORAGE_KEY = 'rumi_order_type_state';

/**
 * How long a persisted order type stays valid. It is in localStorage, so it survives the browser
 * being closed: without this, a Delivery chosen last month silently filters the menu on the next
 * visit and prefills a stale address. Past the window the choice is dropped and the guest is back
 * in the no-type browse state, which is the app's normal starting point anyway.
 */
export const ORDER_TYPE_TTL_MS = 24 * 60 * 60 * 1000;

const initialState: OrderTypeState = {
  orderType: null,
  table: '',
  deliveryAddress: null,
  chosenAt: null,
};

const VALID_ORDER_TYPES: ReadonlySet<OrderType> = new Set([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery]);

function loadState(): OrderTypeState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<OrderTypeState> & { orderType?: unknown; chosenAt?: unknown };
    // Defend against stale/malformed payloads (older app versions, hand-
    // edited devtools, half-written writes from a crash). A `null`
    // orderType means "unset" — anything else must be a known enum value
    // or we fall back to initialState rather than gaslight the welcome
    // modal into thinking the user has already chosen.
    const orderType =
      parsed.orderType === null || parsed.orderType === undefined
        ? null
        : VALID_ORDER_TYPES.has(parsed.orderType as OrderType)
          ? (parsed.orderType as OrderType)
          : null;
    const chosenAt = typeof parsed.chosenAt === 'number' ? parsed.chosenAt : null;
    // Expire the whole choice, not just the type: the table number and delivery address are
    // companions of it, and keeping either around would leave an orphan the UI would still read.
    if (orderType !== null && (chosenAt === null || Date.now() - chosenAt > ORDER_TYPE_TTL_MS)) {
      return initialState;
    }

    return {
      orderType,
      table: typeof parsed.table === 'string' ? parsed.table : '',
      deliveryAddress: parsed.deliveryAddress ?? null,
      chosenAt,
    };
  } catch (err) {
    console.error('Failed to load order-type state:', err);
    return initialState;
  }
}

function saveState(state: OrderTypeState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save order-type state:', err);
  }
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
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Memoised: `useOrderTypeEnabledGuard` has these in an effect dep array, and a fresh identity
  // on every provider render re-ran the guard on every render.
  const setOrderType = useCallback(
    (type: OrderType) => {
      setState((prev) => ({ ...prev, orderType: type, chosenAt: Date.now() }));
      checkout.setOrderType(type); // MIRROR(CheckoutContext) — drop after C1.5.d
    },
    [checkout],
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
  }, [checkout]);

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
