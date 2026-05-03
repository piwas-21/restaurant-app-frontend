'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckout } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { getProfileCompleteness, pickPreferredAddress } from '@/lib/checkout/profileCompleteness';

interface SmartCheckoutRouter {
  /**
   * Decide whether the chosen order type can skip /checkout/customer-info,
   * pre-populate CheckoutContext from the user's profile and (for Delivery)
   * preferred saved address, then route to the next page.
   *
   *  - logged-out OR profile incomplete → /checkout/customer-info  (existing flow)
   *  - logged-in AND profile complete   → /checkout/review        (skip customer-info)
   *
   * Errors fetching profile/addresses (network blip, 401 after token expiry,
   * etc.) fall through to /checkout/customer-info — the safe default — so a
   * transient outage never blocks the customer from ordering.
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

export function useSmartCheckoutRouter(): SmartCheckoutRouter {
  const router = useRouter();
  const { state: checkoutState, setCustomerInfo, setDeliveryAddress } = useCheckout();
  const [isResolving, setIsResolving] = useState(false);

  const proceedToCheckout = useCallback(
    async (orderType: OrderType) => {
      if (!isLoggedIn()) {
        router.push('/checkout/customer-info');
        return;
      }

      setIsResolving(true);
      try {
        const user = await getCurrentUser();
        const addresses = orderType === OrderType.Delivery ? await getMyAddresses() : undefined;
        const { complete } = getProfileCompleteness(user, orderType, addresses);

        if (!complete) {
          router.push('/checkout/customer-info');
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
        router.push('/checkout/customer-info');
      } finally {
        setIsResolving(false);
      }
    },
    [router, checkoutState.customerInfo, checkoutState.deliveryAddress, setCustomerInfo, setDeliveryAddress],
  );

  return { proceedToCheckout, isResolving };
}
