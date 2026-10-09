'use client';

import { useCallback, useState } from 'react';
import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import { useCheckout, type CustomerInfo, type DeliveryAddress } from '@/contexts/CheckoutContext';
import { useCheckoutTableGuestState } from '@/contexts/CheckoutTableGuestStateContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { getProfileCompleteness, pickPreferredAddress } from '@/lib/checkout/profileCompleteness';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import { useTableGuestDineInAvailability } from './useTableGuestDineInAvailability';

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
  proceedToCheckout: (orderType: OrderType | null, source?: string) => Promise<CheckoutBlocker | null>;
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

function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  // Read the auth key directly to keep this SSR-safe check independent of the auth surface.
  return !!localStorage.getItem('auth_token');
}

function checkoutContextSatisfies(
  orderType: OrderType,
  customerInfo: CustomerInfo | null,
  deliveryAddress: DeliveryAddress | null,
): boolean {
  if (!customerInfo?.name?.trim() || !customerInfo?.email?.trim()) return false;
  if (orderType === OrderType.DineIn) return true;
  // Takeaway + Delivery both need a phone we can call.
  if (!customerInfo?.phone?.trim()) return false;
  if (orderType === OrderType.Delivery) {
    return !!(
      deliveryAddress?.street?.trim() &&
      deliveryAddress?.city?.trim() &&
      deliveryAddress?.postalCode?.trim() &&
      deliveryAddress?.country?.trim()
    );
  }
  return true;
}

interface OrdinaryCheckoutOptions {
  readonly orderType: OrderType | null;
  readonly source: string;
  readonly customerInfo: CustomerInfo | null;
  readonly deliveryAddress: DeliveryAddress | null;
  readonly push: (path: string) => void;
  readonly setCustomerInfo: (customerInfo: CustomerInfo) => void;
  readonly setDeliveryAddress: (deliveryAddress: DeliveryAddress) => void;
  readonly setIsResolving: (resolving: boolean) => void;
}

async function resolveOrdinaryCheckout({
  orderType,
  source,
  customerInfo,
  deliveryAddress,
  push,
  setCustomerInfo,
  setDeliveryAddress,
  setIsResolving,
}: OrdinaryCheckoutOptions): Promise<CheckoutBlocker | null> {
  if (!orderType) return 'order-type';
  if (checkoutContextSatisfies(orderType, customerInfo, deliveryAddress)) {
    trackEvent('checkout_opened', { orderType, source, loggedIn: isLoggedInForAnalytics() });
    push('/checkout/review');
    return null;
  }
  if (!isLoggedIn()) return 'details';

  setIsResolving(true);
  try {
    const user = await getCurrentUser();
    const addresses = orderType === OrderType.Delivery ? await getMyAddresses() : undefined;
    const { complete } = getProfileCompleteness(user, orderType, addresses);
    if (!complete) return 'details';

    if (!customerInfo) {
      setCustomerInfo({
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phoneNumber ?? '',
      });
    }

    if (orderType === OrderType.Delivery && !deliveryAddress && addresses) {
      const preferred = pickPreferredAddress(addresses);
      if (preferred) {
        setDeliveryAddress({
          street: preferred.addressLine1,
          city: preferred.city,
          postalCode: preferred.postalCode,
          country: preferred.country,
          additionalInfo: preferred.deliveryInstructions,
        });
      }
    }

    trackEvent('checkout_opened', { orderType, source, loggedIn: true });
    push('/checkout/review');
    return null;
  } catch (error) {
    console.warn('Smart-skip checkout could not resolve profile, falling back:', error);
    return 'details';
  } finally {
    setIsResolving(false);
  }
}

export function useSmartCheckoutRouter(): SmartCheckoutRouter {
  const { push } = useTenantLocaleRouter();
  const { state: checkoutState, setCustomerInfo, setDeliveryAddress } = useCheckout();
  const tableVisit = useCheckoutTableGuestState();
  const tableDineIn = useTableGuestDineInAvailability();
  const [isResolving, setIsResolving] = useState(false);

  const proceedToCheckout = useCallback(
    async (orderType: OrderType | null, source = 'sidebar'): Promise<CheckoutBlocker | null> => {
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
