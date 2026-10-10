import type { CustomerInfo, DeliveryAddress } from '@/contexts/CheckoutContext';
import { OrderType } from '@/types/order';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { getProfileCompleteness, pickPreferredAddress } from '@/lib/checkout/profileCompleteness';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import type { CheckoutBlocker } from './useSmartCheckoutRouter';

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
  readonly isCurrent: () => boolean;
}

export async function resolveOrdinaryCheckout({
  orderType,
  source,
  customerInfo,
  deliveryAddress,
  push,
  setCustomerInfo,
  setDeliveryAddress,
  setIsResolving,
  isCurrent,
}: OrdinaryCheckoutOptions): Promise<CheckoutBlocker | null> {
  if (!isCurrent()) return 'details';
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
    if (!complete || !isCurrent()) return 'details';

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
