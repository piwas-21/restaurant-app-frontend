'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckout, type CustomerInfo, type DeliveryAddress } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { getProfileCompleteness, pickPreferredAddress } from '@/lib/checkout/profileCompleteness';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';

/**
 * Why a Proceed-to-Checkout click could not route, so the caller can say so and
 * offer the fix in place. `null` means it routed.
 *
 *   'order-type' — nothing picked yet; the order-type toggle is the next step.
 *   'details'    — a type is picked but its contact/address data is incomplete,
 *                  so the type's follow-up modal has to collect the rest.
 */
export type CheckoutBlocker = 'order-type' | 'details';

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
   *   3. Otherwise → return the blocker. This used to `router.push('/menu')`
   *      instead, which was a silent dead end: on /menu that push is a no-op
   *      (the button looked like it did nothing but reload) and from /cart it
   *      bounced the customer back to the menu with no explanation. Routing is
   *      now the caller's business — it owns the surface that can unblock.
   *
   * Errors fetching profile/addresses (network blip, 401 after token
   * expiry, etc.) also report 'details' — the safe default — so a transient
   * outage degrades to "we'll ask you for these" rather than blocking the order.
   *
   * `source` is forwarded to the `checkout_opened` analytics event so the
   * funnel can attribute the click to the surface that fired it (desktop
   * sidebar, mobile bottom-sheet, legacy /cart page). Defaults to
   * 'sidebar' for back-compat with callers that don't supply one.
   */
  proceedToCheckout: (orderType: OrderType | null, source?: string) => Promise<CheckoutBlocker | null>;
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
    async (orderType: OrderType | null, source = 'sidebar'): Promise<CheckoutBlocker | null> => {
      if (!orderType) return 'order-type';

      // Fast path: the type modals (§C1.5.e) already wrote everything we
      // need into CheckoutContext. No API calls, no smart-skip logic — just
      // go to review.
      if (checkoutContextSatisfies(orderType, checkoutState.customerInfo, checkoutState.deliveryAddress)) {
        // checkout_opened — fires on the user-action path (Proceed click),
        // not from a route-watching effect, so it never double-fires on
        // hydration/replay. Only emitted once we've confirmed the route is
        // actually about to happen (i.e. inputs are sufficient).
        trackEvent('checkout_opened', {
          orderType,
          source,
          loggedIn: isLoggedInForAnalytics(),
        });
        router.push('/checkout/review');
        return null;
      }

      if (!isLoggedIn()) return 'details';

      setIsResolving(true);
      try {
        const user = await getCurrentUser();
        const addresses = orderType === OrderType.Delivery ? await getMyAddresses() : undefined;
        const { complete } = getProfileCompleteness(user, orderType, addresses);

        if (!complete) return 'details';

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

        // checkout_opened — smart-skip variant. The logged-in path lands
        // here when the profile was sufficient and we filled CheckoutContext
        // from the API. Same payload shape as the fast-path emission above.
        trackEvent('checkout_opened', {
          orderType,
          source,
          loggedIn: true,
        });
        router.push('/checkout/review');
        return null;
      } catch (error) {
        console.warn('Smart-skip checkout could not resolve profile, falling back:', error);
        return 'details';
      } finally {
        setIsResolving(false);
      }
    },
    [router, checkoutState.customerInfo, checkoutState.deliveryAddress, setCustomerInfo, setDeliveryAddress],
  );

  return { proceedToCheckout, isResolving };
}
