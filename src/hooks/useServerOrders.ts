'use client';

import { useCallback } from 'react';
import { updateOrderStatus as updateOrderStatusService, ServerTableDto } from '@/services/serverService';
import { OrderDto } from '@/types/order';
import { useServerOrdersData } from './serverOrders/useServerOrdersData';
import { useServerOrdersStream, ConnectionState } from './serverOrders/useServerOrdersStream';

interface UseServerOrdersReturn {
  orders: OrderDto[];
  tables: ServerTableDto[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  refreshOrders: () => Promise<void>;
  refreshTables: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  getOrdersForTable: (tableNumber: string) => OrderDto[];
}

/**
 * Public hook for the server (waitstaff) view. Composed from:
 *   - `useServerOrdersData` — fetches orders + tables, runs the 5s polling cycle
 *   - `useServerOrdersStream` — owns the SSE connection + reconnect logic
 * Mutations and the `getOrdersForTable` selector remain here because they
 * touch both layers (mutation merges into orders state and refreshes tables).
 *
 * The public return type is identical to the pre-split hook — callers
 * (`src/app/server/page.tsx`) need no changes.
 */
export function useServerOrders(): UseServerOrdersReturn {
  const { orders, tables, isLoading, error, setError, setOrders, refreshOrders, refreshTables, isMountedRef } =
    useServerOrdersData();

  const { isConnected, lastEventTime, connectionState } = useServerOrdersStream({
    onOrderUpdate: (updater) => {
      if (isMountedRef.current) setOrders(updater);
    },
    onTablesRefreshRequested: () => {
      // Fire-and-forget — the 5s polling cycle recovers from transient failures.
      void refreshTables();
    },
    onVisibilityResume: () => {
      // Fire-and-forget — polling continues regardless.
      void refreshOrders();
      void refreshTables();
    },
  });

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, status: string) => {
      try {
        const updatedOrder = await updateOrderStatusService(orderId, status);
        let mergedOrder: OrderDto | undefined;
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id === orderId) {
              mergedOrder = { ...order, ...updatedOrder };
              return mergedOrder;
            }
            return order;
          }),
        );
        await refreshTables();
        return mergedOrder || updatedOrder;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
        setError(errorMessage);
        throw err;
      }
    },
    [refreshTables, setError, setOrders],
  );

  const getOrdersForTable = useCallback(
    (tableNumber: string) => orders.filter((order) => order.tableNumber?.toString() === tableNumber),
    [orders],
  );

  return {
    orders,
    tables,
    isConnected,
    isLoading,
    error,
    lastEventTime,
    connectionState,
    refreshOrders,
    refreshTables,
    updateOrderStatus: handleUpdateOrderStatus,
    getOrdersForTable,
  };
}
