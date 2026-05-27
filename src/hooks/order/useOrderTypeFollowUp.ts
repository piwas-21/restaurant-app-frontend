'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

/** Which follow-up modal to display after a type is picked. */
export type OrderTypeFollowUp = 'table' | 'address' | 'takeaway' | null;

interface FollowUpState {
  /**
   * Which follow-up modal is currently open: 'table' for dine-in,
   * 'address' for delivery, 'takeaway' for guests / incomplete-profile
   * users picking takeaway, null when nothing is open.
   */
  followUp: OrderTypeFollowUp;
  /**
   * Pick a type. DineIn and Delivery always open their detail modal
   * (the modal also captures any missing customer info for guests).
   * Takeaway opens its info modal only when the customer needs to
   * provide name/email/phone — logged-in users with all three on file
   * commit silently and proceed straight to the cart.
   *
   * `source` is the analytics surface tag forwarded to
   * `order_type_selected` so the funnel can distinguish desktop sidebar
   * vs. mobile bottom-sheet. Defaults to 'sidebar'.
   */
  pickType: (type: OrderType, source?: string) => void;
  closeFollowUp: () => void;
}

function isLoggedInClient(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}

/**
 * Owns the order-type picking flow exposed by the cart sidebar
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.c + §C1.5.e).
 *
 *   1. QR-scan landings (table context present) → auto-pin DineIn + the
 *      scanned table number on first mount. No modal pops.
 *   2. Sidebar order-type toggle → `pickType(type)` commits the type
 *      to OrderTypeContext and opens the relevant detail modal:
 *        - DineIn → 'table' modal (always; also captures guest info)
 *        - Delivery → 'address' modal (always; also captures guest info)
 *        - Takeaway → 'takeaway' modal *only* if the user needs to
 *          provide name/email/phone (guest, OR logged-in with any of
 *          those fields missing on profile). Logged-in users with all
 *          three on file see no modal and the type just commits.
 *   3. Modal Confirm captures the detail; Cancel leaves the type set
 *      with empty detail (recoverable: user can re-click the toggle).
 *
 * The Takeaway-needs-modal? decision is fast-pathed off CheckoutContext
 * first — if customerInfo is already there from a prior modal in this
 * session, no API call. Only when context is empty do we hit
 * /api/User/profile to decide; failure falls through to "open the modal"
 * (safe default — the modal asks for everything anyway).
 */
export function useOrderTypeFollowUp(): FollowUpState {
  const { hasChosenOrderType, setOrderType, setTable } = useOrderType();
  const { hasTableContext, tableContext } = useTableContext();
  const { state: checkoutState } = useCheckout();
  const [followUp, setFollowUp] = useState<OrderTypeFollowUp>(null);

  // QR-scan landing → pin DineIn + the scanned table.
  useEffect(() => {
    if (hasTableContext && tableContext.tableNumber && !hasChosenOrderType) {
      setOrderType(OrderType.DineIn);
      setTable(tableContext.tableNumber);
    }
  }, [hasTableContext, tableContext.tableNumber, hasChosenOrderType, setOrderType, setTable]);

  const pickType = useCallback(
    async (type: OrderType, source = 'sidebar') => {
      setOrderType(type);
      // Funnel anchor — fires once per click, regardless of whether a
      // follow-up modal opens (the modal is a sub-step of the same intent).
      trackEvent('order_type_selected', {
        orderType: type,
        source,
        loggedIn: isLoggedInForAnalytics(),
      });
      if (type === OrderType.DineIn) {
        setFollowUp('table');
        return;
      }
      if (type === OrderType.Delivery) {
        setFollowUp('address');
        return;
      }

      // Takeaway: open the info modal only when something is needed.
      if (await needsTakeawayInfoModal(checkoutState.customerInfo)) {
        setFollowUp('takeaway');
      } else {
        setFollowUp(null);
      }
    },
    [setOrderType, checkoutState.customerInfo],
  );

  const closeFollowUp = useCallback(() => setFollowUp(null), []);

  return { followUp, pickType, closeFollowUp };
}

async function needsTakeawayInfoModal(
  existingCustomerInfo: { name: string; email: string; phone: string } | null,
): Promise<boolean> {
  if (existingCustomerInfo?.name && existingCustomerInfo?.email && existingCustomerInfo?.phone) {
    return false;
  }
  if (!isLoggedInClient()) return true;
  try {
    const user = await getCurrentUser();
    const complete = !!(
      user.firstName?.trim() &&
      user.lastName?.trim() &&
      user.email?.trim() &&
      user.phoneNumber?.trim()
    );
    return !complete;
  } catch (err) {
    console.warn('Profile fetch failed deciding takeaway modal; opening modal:', err);
    return true;
  }
}
