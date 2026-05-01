'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCashierOrders,
  updateOrderStatus,
  addPaymentToOrder,
  refundPayment,
  cancelOrder,
  toggleFocusOrder,
} from '@/services/cashierService';
import { OrderDto } from '@/types/order';
import { useCashierOrdersStream, ConnectionState } from './cashier/useCashierOrdersStream';

const POLLING_INTERVAL_MS = 5000;

export interface CashierDateRange {
  startDate?: Date;
  endDate?: Date;
}

interface UseCashierOrdersReturn {
  orders: OrderDto[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: any) => Promise<OrderDto>;
  refundPayment: (orderId: string, paymentId: string, amount?: number) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
}

export function useCashierOrders(dateRange?: CashierDateRange): UseCashierOrdersReturn {
  const dateRangeRef = useRef<CashierDateRange | undefined>(dateRange);
  dateRangeRef.current = dateRange;

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const lastPolledAtRef = useRef<Date | null>(null);
  const primaryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshOrders = useCallback(async (modifiedSince?: Date) => {
    if (!isMountedRef.current) return;
    try {
      setError(null);
      const range = dateRangeRef.current;
      const filters = {
        ...(modifiedSince ? { modifiedSince } : {}),
        ...(range?.startDate ? { startDate: range.startDate } : {}),
        ...(range?.endDate ? { endDate: range.endDate } : {}),
      };
      const result = await getCashierOrders(Object.keys(filters).length > 0 ? filters : undefined);
      if (!isMountedRef.current) return;

      if (modifiedSince && result.items && result.items.length > 0) {
        // Incremental: merge new/updated rows in place.
        setOrders((prev) => {
          const next = [...prev];
          for (const order of result.items) {
            const existingIndex = next.findIndex((o) => o.id === order.id);
            if (existingIndex >= 0) next[existingIndex] = order;
            else next.unshift(order);
          }
          return next;
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

  const stream = useCashierOrdersStream({
    onOrderUpdate: (updater) => setOrders(updater),
    onReconnectRequested: () => {
      void refreshOrders();
    },
  });

  // Polling: primary delivery mechanism, runs always (SSE is enhancement).
  useEffect(() => {
    isMountedRef.current = true;
    void refreshOrders();

    const startTimeout = setTimeout(() => {
      if (!isMountedRef.current || primaryPollingIntervalRef.current) return;
      primaryPollingIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        void refreshOrders(lastPolledAtRef.current || undefined);
      }, POLLING_INTERVAL_MS);
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(startTimeout);
      if (primaryPollingIntervalRef.current) {
        clearInterval(primaryPollingIntervalRef.current);
        primaryPollingIntervalRef.current = null;
      }
    };
    // Mount-once lifecycle (see useCashierOrdersStream for the same rationale).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on date-range change after the initial mount; drop cached
  // orders so the previous window doesn't bleed into the new one.
  const isFirstRangeEffectRef = useRef(true);
  const startDateMs = dateRange?.startDate?.getTime();
  const endDateMs = dateRange?.endDate?.getTime();
  useEffect(() => {
    if (isFirstRangeEffectRef.current) {
      isFirstRangeEffectRef.current = false;
      return;
    }
    setOrders([]);
    setIsLoading(true);
    lastPolledAtRef.current = null;
    void refreshOrders();
  }, [startDateMs, endDateMs, refreshOrders]);

  // Mutation helper: call the API, merge the returned order into local state,
  // surface errors via setError. Replaces five near-identical handlers.
  const applyMutation = useCallback(
    async (orderId: string, mutate: () => Promise<OrderDto>, errorFallback: string): Promise<OrderDto> => {
      try {
        const updatedOrder = await mutate();
        let mergedOrder: OrderDto | undefined;
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            mergedOrder = { ...order, ...updatedOrder };
            return mergedOrder;
          }),
        );
        return mergedOrder || updatedOrder;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : errorFallback;
        setError(errorMessage);
        throw err;
      }
    },
    [],
  );

  return {
    orders,
    isConnected: stream.isConnected,
    isLoading,
    error: error || stream.error,
    lastEventTime: stream.lastEventTime,
    connectionState: stream.connectionState,
    refreshOrders: useCallback(() => refreshOrders(), [refreshOrders]),
    updateOrderStatus: useCallback(
      (orderId, status) => applyMutation(orderId, () => updateOrderStatus(orderId, status), 'Failed to update status'),
      [applyMutation],
    ),
    addPayment: useCallback(
      (orderId, paymentData) =>
        applyMutation(orderId, () => addPaymentToOrder(orderId, paymentData), 'Failed to add payment'),
      [applyMutation],
    ),
    refundPayment: useCallback(
      (orderId, paymentId, amount) =>
        applyMutation(orderId, () => refundPayment(orderId, paymentId, amount), 'Failed to refund'),
      [applyMutation],
    ),
    cancelOrder: useCallback(
      (orderId, reason) => applyMutation(orderId, () => cancelOrder(orderId, reason), 'Failed to cancel order'),
      [applyMutation],
    ),
    toggleFocusOrder: useCallback(
      (orderId, isFocus, priority, reason) =>
        applyMutation(orderId, () => toggleFocusOrder(orderId, isFocus, priority, reason), 'Failed to toggle focus'),
      [applyMutation],
    ),
  };
}
