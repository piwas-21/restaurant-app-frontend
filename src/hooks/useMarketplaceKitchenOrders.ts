'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderDto } from '@/types/order';
import { getMarketplaceOperationalOrders } from '@/services/serverService';
import { getErrorMessage } from '@/utils/apiClient';

const REFRESH_MS = 5_000;

export function useMarketplaceKitchenOrders(enabled: boolean) {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const generation = ++requestGeneration.current;
    try {
      const result = await getMarketplaceOperationalOrders();
      if (generation !== requestGeneration.current) return;
      setOrders(result);
      setError(null);
    } catch (cause: unknown) {
      if (generation !== requestGeneration.current) return;
      setError(getErrorMessage(cause) ?? 'Failed to load marketplace kitchen orders');
    } finally {
      if (generation === requestGeneration.current) setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      requestGeneration.current += 1;
    };
  }, [enabled, refresh]);

  return { orders, isLoading, error, isStale: Boolean(error && orders.length), refresh };
}
