'use client';

import { useEnabledOrderTypes } from './useEnabledOrderTypes';
import type { OrderType } from '@/types/order';

export type CheckoutOrderAvailabilityState = 'loading' | 'unknown' | 'closed' | 'type-unavailable' | 'available';

export function useCheckoutOrderAvailability(orderType: OrderType | null) {
  const availability = useEnabledOrderTypes();
  const selectedTypeAvailable = orderType !== null && availability.enabled.includes(orderType);
  const state: CheckoutOrderAvailabilityState = availability.loading
    ? 'loading'
    : !availability.confirmed
      ? 'unknown'
      : availability.enabled.length === 0
        ? 'closed'
        : selectedTypeAvailable
          ? 'available'
          : 'type-unavailable';

  return {
    state,
    canSubmit: state === 'available',
    isRefreshing: availability.loading,
    refresh: availability.refresh,
  } as const;
}
