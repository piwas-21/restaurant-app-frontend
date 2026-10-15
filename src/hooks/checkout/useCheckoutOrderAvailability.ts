'use client';

import { useEnabledOrderTypes } from './useEnabledOrderTypes';
import type { OrderType } from '@/types/order';

export type CheckoutOrderAvailabilityState = 'loading' | 'unknown' | 'closed' | 'type-unavailable' | 'available';

export function useCheckoutOrderAvailability(orderType: OrderType | null) {
  const availability = useEnabledOrderTypes();
  const selectedTypeAvailable = orderType !== null && availability.enabled.includes(orderType);
  let state: CheckoutOrderAvailabilityState;
  if (availability.loading) {
    state = 'loading';
  } else if (!availability.confirmed) {
    state = 'unknown';
  } else if (availability.enabled.length === 0) {
    state = 'closed';
  } else if (selectedTypeAvailable) {
    state = 'available';
  } else {
    state = 'type-unavailable';
  }

  return {
    state,
    canSubmit: state === 'available',
    isRefreshing: availability.loading,
    refresh: availability.refresh,
  } as const;
}
