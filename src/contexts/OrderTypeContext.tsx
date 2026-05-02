'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { OrderType } from '@/types/order';
import { type DeliveryAddress, useCheckout } from '@/contexts/CheckoutContext';

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
}

interface OrderTypeContextType {
  state: OrderTypeState;
  setOrderType: (type: OrderType) => void;
  setTable: (table: string) => void;
  setAddress: (address: DeliveryAddress) => void;
  /** True when an order type has been chosen — drives the welcome modal's open state. */
  hasChosenOrderType: boolean;
  clearOrderType: () => void;
}

const STORAGE_KEY = 'rumi_order_type_state';

const initialState: OrderTypeState = {
  orderType: null,
  table: '',
  deliveryAddress: null,
};

const VALID_ORDER_TYPES: ReadonlySet<OrderType> = new Set([OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery]);

function loadState(): OrderTypeState {
  if (typeof window === 'undefined') return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<OrderTypeState> & { orderType?: unknown };
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
    return {
      orderType,
      table: typeof parsed.table === 'string' ? parsed.table : '',
      deliveryAddress: parsed.deliveryAddress ?? null,
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
  const checkout = useCheckout();

  // One-time migration: if we have nothing in our own storage but the
  // legacy CheckoutContext does (existing sessions from before this MR
  // shipped), backfill from there. Prevents a divergence window where
  // the welcome modal opens for someone who already chose. Reverse-mirror
  // is intentionally NOT installed — CheckoutContext writes only flow
  // here from the new (sticky-header / welcome-modal) surfaces; the old
  // /checkout/order-type page still writes to CheckoutContext directly
  // and the next save cycle here will pick that up via the effect below
  // if and only if our own state is still empty.
  useEffect(() => {
    const loaded = loadState();
    if (loaded.orderType === null && checkout.state.orderType !== null) {
      setState({
        orderType: checkout.state.orderType,
        table: checkout.state.tableNumber ?? '',
        deliveryAddress: checkout.state.deliveryAddress,
      });
    } else {
      setState(loaded);
    }
    // Run once on mount. checkout.state changes after this trigger normal
    // re-renders but must not re-run the migration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setOrderType = (type: OrderType) => {
    setState((prev) => ({ ...prev, orderType: type }));
    checkout.setOrderType(type); // MIRROR(CheckoutContext) — drop after C1.5.d
  };

  const setTable = (table: string) => {
    setState((prev) => ({ ...prev, table }));
    checkout.setTableNumber(table); // MIRROR(CheckoutContext)
  };

  const setAddress = (address: DeliveryAddress) => {
    setState((prev) => ({ ...prev, deliveryAddress: address }));
    checkout.setDeliveryAddress(address); // MIRROR(CheckoutContext)
  };

  const clearOrderType = () => {
    setState(initialState);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Note: we deliberately do NOT clear CheckoutContext here — that would
    // wipe customerInfo/tip/etc. Existing `clearCheckout()` is the right
    // hammer for that.
  };

  const value: OrderTypeContextType = {
    state,
    setOrderType,
    setTable,
    setAddress,
    hasChosenOrderType: state.orderType !== null,
    clearOrderType,
  };

  return <OrderTypeContext.Provider value={value}>{children}</OrderTypeContext.Provider>;
}

export const useOrderType = () => {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) {
    throw new Error('useOrderType must be used within an OrderTypeProvider');
  }
  return ctx;
};
