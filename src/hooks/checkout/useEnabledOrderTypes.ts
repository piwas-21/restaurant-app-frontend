'use client';

import { useEffect, useState } from 'react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';

const ALL_ORDER_TYPES = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as const;

/**
 * Fetches the admin-enabled order types on mount. On fetch failure,
 * falls back to all order types (matches the pre-extraction behaviour
 * — error visible in the console, but the user can still place an
 * order rather than seeing a hard wall).
 */
export function useEnabledOrderTypes() {
  const [enabled, setEnabled] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await orderTypeConfigurationService.getEnabled();
        if (!cancelled) setEnabled(result);
      } catch (error) {
        console.error('Error fetching enabled order types:', error);
        if (!cancelled) setEnabled([...ALL_ORDER_TYPES]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
