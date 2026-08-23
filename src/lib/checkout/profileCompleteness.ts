import { OrderType } from '@/types/order';
import type { UserDto } from '@/types/user';
import type { AddressDto } from '@/services/addressService';

export type MissingField = 'firstName' | 'lastName' | 'email' | 'phoneNumber' | 'address';

export interface ProfileCompleteness {
  complete: boolean;
  missing: MissingField[];
}

/**
 * Returns whether the logged-in user already has every piece of profile
 * data the chosen order type needs to skip the customer-info page.
 *
 * The floor per order type is the SAME one the contact modals collect
 * (`TableSelectionModal` name+email, `TakeawayInfoModal` and
 * `DeliveryAddressModal` name+email+phone) and the same one
 * `checkoutContextSatisfies` applies to the fast path in
 * `useSmartCheckoutRouter`:
 *  - DineIn:   name + email (the table is captured in OrderTypeContext)
 *  - Takeaway: name + email + phone
 *  - Delivery: name + email + phone + at least one saved address
 *
 * That agreement is new. DineIn used to return `complete` for ANY logged-in
 * user, checking nothing at all, and no type checked the email: a profile
 * missing either skipped the contact step and the review page placed the
 * order with an empty `customerName` / `customerEmail`. Nothing downstream
 * catches that — the backend's `CreateOrderCommandValidator` validates items
 * and tip only — so the kitchen ticket had no-one on it and the confirmation
 * mail had nowhere to go, while the identical emptiness arriving through
 * CheckoutContext was refused by the fast path one function away. A profile
 * below the floor now returns incomplete, and the caller opens the modal that
 * asks for the rest.
 *
 * Pure — `addresses` is optional so callers that haven't fetched them
 * (DineIn / Takeaway) don't have to. For Delivery, the absence of any
 * address counts as missing. A `null` user (not logged in, or a profile
 * fetch that came back empty) is simply a user missing every field.
 */
export function getProfileCompleteness(
  user: UserDto | null,
  orderType: OrderType,
  addresses?: AddressDto[],
): ProfileCompleteness {
  const missing: MissingField[] = [];

  if (!user?.firstName?.trim()) missing.push('firstName');
  if (!user?.lastName?.trim()) missing.push('lastName');
  if (!user?.email?.trim()) missing.push('email');
  if (orderType !== OrderType.DineIn && !user?.phoneNumber?.trim()) missing.push('phoneNumber');
  if (orderType === OrderType.Delivery && !addresses?.length) missing.push('address');

  return { complete: missing.length === 0, missing };
}

/**
 * Picks the address that smart-skip should auto-attach to the order.
 * Default address wins; otherwise the first one returned by the API.
 * Returns null if the list is empty.
 */
export function pickPreferredAddress(addresses: AddressDto[]): AddressDto | null {
  if (addresses.length === 0) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}
