'use client';

import { useEffect, useState } from 'react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';

const ALL_ORDER_TYPES = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as const;

/**
 * Fetches the admin-enabled order types on mount. Falls back to all
 * order types on fetch failure OR when the API returns an empty list
 * (e.g. greenfield deployment where the order_type_configurations
 * table hasn't been seeded). An empty configuration is treated as
 * "no preference set" rather than "everything disabled" — the user
 * can still place an order rather than facing a hard wall. An admin
 * who genuinely wants to disable a type must enable the others.
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
        if (cancelled) return;
        setEnabled(result.length > 0 ? result : [...ALL_ORDER_TYPES]);
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
