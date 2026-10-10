'use client';

import { useCallback, useState } from 'react';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCheckoutTableGuestState } from '@/contexts/CheckoutTableGuestStateContext';
import { OrderType } from '@/types/order';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';
import { resolveOrdinaryCheckout } from './resolveOrdinaryCheckout';

/**
 * Why a Proceed-to-Checkout click could not route, so the caller can say so and
 * offer the fix in place. `null` means it routed.
 *
 *   'order-type' — nothing picked yet; the order-type toggle is the next step.
 *   'details'    — a type is picked but its contact/address data is incomplete,
 *                  so the type's follow-up modal has to collect the rest.
 */
export type CheckoutBlocker = 'order-type' | 'details' | 'table-guest-unavailable';

interface SmartCheckoutRouter {
  /** Resolve checkout prerequisites; `source` tags the event and defaults to `sidebar`.
   */
  proceedToCheckout: (
    orderType: OrderType | null,
    source?: string,
    isCurrent?: () => boolean,
  ) => Promise<CheckoutBlocker | null>;
  isResolving: boolean;
}

function shouldRouteTableGuestToReview(
  phase: string,
  hasPendingRound: boolean,
  visitBound: boolean,
  active: boolean,
): boolean {
  return (
    hasPendingRound ||
    (phase !== 'notJoined' && phase !== 'loading' && phase !== 'active') ||
    (visitBound && !active) ||
    active ||
    phase === 'active'
  );
}

export function useSmartCheckoutRouter(): SmartCheckoutRouter {
  const { push } = useTenantLocaleRouter();
  const { state: checkoutState, setCustomerInfo, setDeliveryAddress } = useCheckout();
  const tableVisit = useCheckoutTableGuestState();
  const tableDineIn = useTableGuestDineInAvailability();
  const [isResolving, setIsResolving] = useState(false);

  const proceedToCheckout = useCallback(
    async (
      orderType: OrderType | null,
      source = 'sidebar',
      isCurrent: () => boolean = () => true,
    ): Promise<CheckoutBlocker | null> => {
      if (!isCurrent()) return 'details';
      // Route admitted, pending, and unavailable visits to the guarded review; default loading
      // context alone is not evidence of a visit.
      if (
        shouldRouteTableGuestToReview(
          tableVisit.phase,
          tableVisit.hasPendingRound,
          tableDineIn.visitBound,
          tableDineIn.active,
        )
      ) {
        const activeVisit = tableDineIn.active || tableVisit.phase === 'active';
        // An admitted visit owns the order channel. Never send it through ordinary checkout when
        // Dine-In is unavailable or a stale persisted type has not yet been restored.
        if (activeVisit && !tableVisit.hasPendingRound && !tableDineIn.dineInAvailable) {
          return 'table-guest-unavailable';
        }
        trackEvent('checkout_opened', {
          orderType: activeVisit ? OrderType.DineIn : (orderType ?? undefined),
          source,
          loggedIn: isLoggedInForAnalytics(),
        });
        push('/checkout/review');
        return null;
      }

      return resolveOrdinaryCheckout({
        orderType,
        source,
        customerInfo: checkoutState.customerInfo,
        deliveryAddress: checkoutState.deliveryAddress,
        push,
        setCustomerInfo,
        setDeliveryAddress,
        setIsResolving,
        isCurrent,
      });
    },
    [
      push,
      checkoutState.customerInfo,
      checkoutState.deliveryAddress,
      setCustomerInfo,
      setDeliveryAddress,
      tableVisit.hasPendingRound,
      tableVisit.phase,
      tableDineIn.active,
      tableDineIn.dineInAvailable,
      tableDineIn.visitBound,
    ],
  );

  return { proceedToCheckout, isResolving };
}
