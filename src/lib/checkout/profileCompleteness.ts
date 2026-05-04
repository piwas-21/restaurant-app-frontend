import { OrderType } from '@/types/order';
import type { UserDto } from '@/types/user';
import type { AddressDto } from '@/services/addressService';

export type MissingField = 'firstName' | 'lastName' | 'phoneNumber' | 'address';

export interface ProfileCompleteness {
  complete: boolean;
  missing: MissingField[];
}

/**
 * Returns whether the logged-in user already has every piece of profile
 * data the chosen order type needs to skip the customer-info page.
 *
 * Order-type rules (BUGS-IMPROVEMENTS-PLAN §C1.5.d):
 *  - DineIn:   nothing extra (table is captured in OrderTypeContext)
 *  - Takeaway: name + phone
 *  - Delivery: name + phone + at least one saved address
 *
 * Pure — `addresses` is optional so callers that haven't fetched them
 * (DineIn / Takeaway) don't have to. For Delivery, the absence of any
 * address counts as missing.
 */
export function getProfileCompleteness(
  user: UserDto | null,
  orderType: OrderType,
  addresses?: AddressDto[],
): ProfileCompleteness {
  if (!user) {
    return { complete: false, missing: ['firstName', 'lastName', 'phoneNumber'] };
  }

  const missing: MissingField[] = [];

  if (orderType === OrderType.DineIn) {
    return { complete: true, missing };
  }

  if (!user.firstName?.trim()) missing.push('firstName');
  if (!user.lastName?.trim()) missing.push('lastName');
  if (!user.phoneNumber?.trim()) missing.push('phoneNumber');

  if (orderType === OrderType.Delivery && (!addresses || addresses.length === 0)) {
    missing.push('address');
  }

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
