'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDineInOrders, getTablesWithStatus, ServerTableDto } from '@/services/serverService';
import { OrderDto } from '@/types/order';

const POLLING_INTERVAL_MS = 5000;
const POLLING_START_DELAY_MS = 100;

export interface UseServerOrdersDataReturn {
  orders: OrderDto[];
  tables: ServerTableDto[];
  isLoading: boolean;
  error: string | null;
  /** Replace error state — used by the parent hook to surface mutation errors. */
  setError: (msg: string | null) => void;
  /** Apply an updater to the orders list — used by the SSE stream and mutations. */
  setOrders: React.Dispatch<React.SetStateAction<OrderDto[]>>;
  /** Full or incremental fetch. With no arg, fetches everything. */
  refreshOrders: () => Promise<void>;
  refreshTables: () => Promise<void>;
  isMountedRef: React.MutableRefObject<boolean>;
}

/**
 * Owns data fetching for the server (waitstaff) view: orders + tables,
 * with a 5s polling cycle that uses `modifiedSince` for incremental
 * updates. Mount-once lifecycle, identical to the pre-split hook.
 */
export function useServerOrdersData(): UseServerOrdersDataReturn {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [tables, setTables] = useState<ServerTableDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const lastPolledAtRef = useRef<Date | null>(null);
  const primaryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = useCallback(async (modifiedSince?: Date) => {
    if (!isMountedRef.current) return;
    try {
      setError(null);
      const result = await getDineInOrders(modifiedSince ? { modifiedSince } : undefined);
      if (!isMountedRef.current) return;

      if (modifiedSince && result.items && result.items.length > 0) {
        // Incremental update: merge new/updated orders.
        setOrders((prev) => {
          const newOrders = [...prev];
          for (const order of result.items) {
            const existingIndex = newOrders.findIndex((o) => o.id === order.id);
            if (existingIndex >= 0) {
              newOrders[existingIndex] = order;
            } else {
              newOrders.unshift(order);
            }
          }
          return newOrders;
        });
      } else if (!modifiedSince) {
        setOrders(result.items || []);
      }
      lastPolledAtRef.current = new Date();
      setIsLoading(false);
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Error fetching orders:', err);
    }
  }, []);

  const refreshOrders = useCallback(() => fetchOrders(), [fetchOrders]);

  const refreshTables = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const tablesWithStatus = await getTablesWithStatus();
      if (isMountedRef.current) setTables(tablesWithStatus);
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  }, []);

  // Mount-once: initial fetch + start the 5s polling cycle (incremental
  // via `modifiedSince`). Matches pre-split behaviour exactly.
  useEffect(() => {
    isMountedRef.current = true;

    void fetchOrders();
    void refreshTables();

    const pollingStartTimeout = setTimeout(() => {
      if (!isMountedRef.current || primaryPollingIntervalRef.current) return;
      primaryPollingIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        // Fire-and-forget — both refresh fns self-absorb errors.
        void fetchOrders(lastPolledAtRef.current || undefined);
        void refreshTables();
      }, POLLING_INTERVAL_MS);
    }, POLLING_START_DELAY_MS);

    return () => {
      isMountedRef.current = false;
      clearTimeout(pollingStartTimeout);
      if (primaryPollingIntervalRef.current) {
        clearInterval(primaryPollingIntervalRef.current);
        primaryPollingIntervalRef.current = null;
      }
    };
    // Mount-once lifecycle — adding deps would tear down polling on every
    // function-ref change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    orders,
    tables,
    isLoading,
    error,
    setError,
    setOrders,
    refreshOrders,
    refreshTables,
    isMountedRef,
  };
}
