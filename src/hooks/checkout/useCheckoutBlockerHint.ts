'use client';

// Shared "why can't I check out?" state for every Proceed-to-Checkout surface
// (menu sidebar, mobile sheet, /cart page). Before this, a blocked click just
// pushed /menu — a no-op on the menu itself, and an unexplained bounce from
// /cart. Now each surface renders this hint instead, so the customer is never
// left guessing.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCheckout } from '@/contexts/CheckoutContext';
import type { CheckoutBlocker } from './useSmartCheckoutRouter';

export interface CheckoutBlockerHint {
  /**
   * The blocker to surface: whatever the last click reported, or — before any
   * click — the one thing we can see up front, a cart with no order type.
   * `null` when there is nothing to explain.
   */
  blocker: CheckoutBlocker | null;
  /** Translated one-liner for `blocker`, or '' when there's nothing to say. */
  message: string;
  /** Record what a Proceed click reported (null clears it). */
  setBlocker: (next: CheckoutBlocker | null) => void;
}

/**
 * Owns the blocker message shown next to a Proceed-to-Checkout button.
 *
 * The 'order-type' case is derived, not clicked into existence: an order type
 * is the one prerequisite we can check synchronously, so the hint is up
 * BEFORE the customer clicks. 'details' can only be known after the router has
 * consulted the profile, so it's recorded by the click handler.
 */
export function useCheckoutBlockerHint(hasChosenOrderType: boolean, hasItems: boolean): CheckoutBlockerHint {
  const { t } = useTranslation();
  const { state: checkoutState } = useCheckout();
  const [blocker, setBlocker] = useState<CheckoutBlocker | null>(null);

  // Anything that could have unblocked the flow — a type pick, a follow-up
  // modal that filled in the contact details or address, an emptied cart —
  // retires the last complaint. Without this the hint outlives its problem:
  // the customer completes the modal and the panel still tells them off.
  const resolvedSignal = [
    hasChosenOrderType,
    hasItems,
    checkoutState.customerInfo?.email ?? '',
    checkoutState.customerInfo?.phone ?? '',
    checkoutState.deliveryAddress?.street ?? '',
  ].join('|');
  useEffect(() => setBlocker(null), [resolvedSignal]);

  const shown = blocker ?? (hasItems && !hasChosenOrderType ? 'order-type' : null);

  let message = '';
  if (shown === 'order-type') {
    message = t('checkout_blocked_order_type', 'Choose how you want to order to continue');
  } else if (shown === 'details') {
    message = t('checkout_blocked_details', 'We need a few more details before checkout');
  }

  return { blocker: shown, message, setBlocker };
}
