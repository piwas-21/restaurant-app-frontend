/**
 * Checkout Context
 *
 * Manages checkout flow state including order type, customer info, and delivery details
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OrderType } from '@/types/order';

/**
 * Delivery address structure
 */
export interface DeliveryAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  additionalInfo?: string;
}

/**
 * Customer information structure
 */
export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

/**
 * Checkout state structure
 */
interface CheckoutState {
  orderType: OrderType | null;
  tableNumber: string;
  deliveryAddress: DeliveryAddress | null;
  customerInfo: CustomerInfo | null;
  specialInstructions: string;
  tipAmount: number;
}

/**
 * Checkout context type
 */
interface CheckoutContextType {
  state: CheckoutState;
  /**
   * False until the localStorage hydration effect has run. `state` is the empty
   * `initialState` during that window, so anything that treats a missing
   * orderType/customerInfo as "the user hasn't got that far" (e.g. the
   * /checkout/review prereq guard) must wait for this — otherwise it acts on a
   * blank slate and redirects a valid checkout away.
   */
  isHydrated: boolean;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (tableNumber: string) => void;
  setDeliveryAddress: (address: DeliveryAddress) => void;
  setCustomerInfo: (info: CustomerInfo) => void;
  setSpecialInstructions: (instructions: string) => void;
  setTipAmount: (tipAmount: number) => void;
  /** Clear the order type + table + address, keeping contact info. See the implementation. */
  clearOrderTypeSelection: () => void;
  clearCheckout: () => void;
}

const CHECKOUT_STORAGE_KEY = 'rumi_checkout_state';

const initialState: CheckoutState = {
  orderType: null,
  tableNumber: '',
  deliveryAddress: null,
  customerInfo: null,
  specialInstructions: '',
  tipAmount: 0,
};

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

/**
 * Load checkout state from localStorage
 */
const loadCheckoutState = (): CheckoutState => {
  if (typeof window === 'undefined') return initialState;

  try {
    const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load checkout state:', error);
  }
  return initialState;
};

/**
 * Save checkout state to localStorage
 */
const saveCheckoutState = (state: CheckoutState) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save checkout state:', error);
  }
};

/**
 * Checkout Provider Component
 */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckoutState>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const loaded = loadCheckoutState();
    setState(loaded);
    setIsHydrated(true);
  }, []);

  // Save state to localStorage whenever it changes — but not before hydration,
  // or the first render's empty initialState would overwrite the stored one.
  useEffect(() => {
    if (!isHydrated) return;
    saveCheckoutState(state);
  }, [state, isHydrated]);

  const setOrderType = (type: OrderType) => {
    setState((prev) => ({ ...prev, orderType: type }));
  };

  const setTableNumber = (tableNumber: string) => {
    setState((prev) => ({ ...prev, tableNumber }));
  };

  const setDeliveryAddress = (address: DeliveryAddress) => {
    setState((prev) => ({ ...prev, deliveryAddress: address }));
  };

  const setCustomerInfo = (info: CustomerInfo) => {
    setState((prev) => ({ ...prev, customerInfo: info }));
  };

  const setSpecialInstructions = (instructions: string) => {
    setState((prev) => ({ ...prev, specialInstructions: instructions }));
  };

  const setTipAmount = (tipAmount: number) => {
    setState((prev) => ({ ...prev, tipAmount }));
  };

  /**
   * Drop the order-type decision and its companions, keeping customerInfo / tip / instructions.
   *
   * The mirror is one-directional (OrderTypeContext writes here), so without this every clear on
   * that side was a HALF clear: the menu-side state went to "no type chosen" while this store —
   * the one `useCheckoutPrereqGuard` and the tax calculation actually read — kept the abandoned
   * channel. A guest whose stored Delivery expired, or whose channel the admin just disabled,
   * could still place a Delivery order from /checkout/review. `clearCheckout` is too big a hammer
   * for that: it would also wipe the contact details they just typed in.
   */
  const clearOrderTypeSelection = () => {
    setState((prev) => ({ ...prev, orderType: null, tableNumber: '', deliveryAddress: null }));
  };

  const clearCheckout = () => {
    setState(initialState);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    }
  };

  const value: CheckoutContextType = {
    state,
    isHydrated,
    setOrderType,
    setTableNumber,
    setDeliveryAddress,
    setCustomerInfo,
    setSpecialInstructions,
    setTipAmount,
    clearOrderTypeSelection,
    clearCheckout,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

/**
 * Hook to use checkout context
 */
export const useCheckout = () => {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout must be used within a CheckoutProvider');
  }
  return context;
};
