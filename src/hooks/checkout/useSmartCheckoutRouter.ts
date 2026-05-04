'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckout, type CustomerInfo, type DeliveryAddress } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { getProfileCompleteness, pickPreferredAddress } from '@/lib/checkout/profileCompleteness';

interface SmartCheckoutRouter {
  /**
   * Decide whether the chosen order type already has the data it needs
   * to land on /checkout/review, pre-populate CheckoutContext from the
   * user's profile and (for Delivery) preferred saved address, then
   * route to the next page.
   *
   * Priority:
   *   1. CheckoutContext already has everything this type needs
   *      (e.g. filled inline by the type-modal in §C1.5.e) — skip the
   *      API calls entirely and go straight to /checkout/review.
   *   2. Logged-in + profile complete → populate context, push to review.
   *   3. Otherwise → /menu (the type modal will collect what's missing
   *      via §C1.5.e's inline contact-info fields).
   *
   * Errors fetching profile/addresses (network blip, 401 after token
   * expiry, etc.) also fall through to /menu — the safe default — so
   * a transient outage never blocks the customer from ordering.
   */
  proceedToCheckout: (orderType: OrderType) => Promise<void>;
  isResolving: boolean;
}

function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  // Key written by services/authService.ts on login; mirrored here to avoid
  // pulling in the whole auth surface for a single SSR-safe boolean check.
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

export function useSmartCheckoutRouter(): SmartCheckoutRouter {
  const router = useRouter();
  const { state: checkoutState, setCustomerInfo, setDeliveryAddress } = useCheckout();
  const [isResolving, setIsResolving] = useState(false);

  const proceedToCheckout = useCallback(
    async (orderType: OrderType) => {
      // Fast path: the type modals (§C1.5.e) already wrote everything we
      // need into CheckoutContext. No API calls, no smart-skip logic — just
      // go to review.
      if (checkoutContextSatisfies(orderType, checkoutState.customerInfo, checkoutState.deliveryAddress)) {
        router.push('/checkout/review');
        return;
      }

      if (!isLoggedIn()) {
        router.push('/menu');
        return;
      }

      setIsResolving(true);
      try {
        const user = await getCurrentUser();
        const addresses = orderType === OrderType.Delivery ? await getMyAddresses() : undefined;
        const { complete } = getProfileCompleteness(user, orderType, addresses);

        if (!complete) {
          router.push('/menu');
          return;
        }

        // Only populate fields the user hasn't already set in this session —
        // a manually filled DeliveryAddressModal must not be clobbered by
        // the default saved address.
        if (!checkoutState.customerInfo) {
          setCustomerInfo({
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            phone: user.phoneNumber ?? '',
          });
        }

        if (orderType === OrderType.Delivery && !checkoutState.deliveryAddress && addresses) {
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

        router.push('/checkout/review');
      } catch (error) {
        console.warn('Smart-skip checkout could not resolve profile, falling back:', error);
        router.push('/menu');
      } finally {
        setIsResolving(false);
      }
    },
    [router, checkoutState.customerInfo, checkoutState.deliveryAddress, setCustomerInfo, setDeliveryAddress],
  );

  return { proceedToCheckout, isResolving };
}
