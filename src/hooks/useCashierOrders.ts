'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCashierOrders,
  updateOrderStatus,
  addPaymentToOrder,
  refundPayment,
  getOrderById,
  cancelOrder,
  toggleFocusOrder,
  AddPaymentRequest,
} from '@/services/cashierService';
import { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { useCashierOrdersStream, ConnectionState } from './cashier/useCashierOrdersStream';
import { useCashierOrderMutation } from './cashier/useCashierOrderMutation';
import { CashierOrdersQuery, DEFAULT_QUEUE_QUERY } from './cashier/useCashierFilters';

const POLLING_INTERVAL_MS = 5000;

interface UseCashierOrdersReturn {
  orders: OrderDto[];
  pagination: { totalCount: number; page: number; pageSize: number; totalPages: number };
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  /** `true` when the fetch landed, `false` when it failed; the failure itself is on `error`. */
  refreshOrders: () => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  refundPayment: (orderId: string, paymentId: string, amount: number, reason: string) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
}

export function useCashierOrders(
  tenantDay?: string,
  query: CashierOrdersQuery = DEFAULT_QUEUE_QUERY,
): UseCashierOrdersReturn {
  const tenantDayRef = useRef<string | undefined>(tenantDay);
  tenantDayRef.current = tenantDay;
  const queryRef = useRef<CashierOrdersQuery>(query);
  queryRef.current = query;

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [pagination, setPagination] = useState({
    totalCount: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const primaryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestRequestRef = useRef(0);

  const refreshOrders = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const requestId = ++latestRequestRef.current;
    try {
      setError(null);
      const day = tenantDayRef.current;
      const currentQuery = queryRef.current;
      const filters = {
        ...currentQuery,
        ...(day ? { tenantDay: day } : {}),
      };
      const result = await getCashierOrders(filters);
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;

      // A complete page replaces the prior page: incremental `modifiedSince` deltas cannot
      // carry a truthful total, so the operational queue polls the server-filtered page.
      setOrders(result.items || []);
      setPagination({
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
      setIsLoading(false);
      return true;
    } catch (err) {
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;
      const errorMessage = getErrorMessage(err) ?? 'Failed to load orders';
      setError(errorMessage);
      setIsLoading(false);
      console.error('Error fetching orders:', err);
      return false;
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
        void refreshOrders();
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

  // Refresh when the venue day, server-side filters, search, or page changes. Keep the
  // prior page visible while the new page loads so a selected order does not blink away during a
  // normal refresh; the response atomically replaces it.
  const fetchKey = `${tenantDay ?? ''}:${JSON.stringify(query)}`;
  const isFirstFetchEffectRef = useRef(true);
  useEffect(() => {
    if (isFirstFetchEffectRef.current) {
      isFirstFetchEffectRef.current = false;
      return;
    }
    setIsLoading(true);
    void refreshOrders();
  }, [fetchKey, refreshOrders]);

  // Call the API, merge the returned order into local state, surface errors via setError.
  // Replaces five near-identical handlers; lives in its own file since §4.
  const applyMutation = useCashierOrderMutation(setOrders, setError);

  return {
    orders,
    pagination,
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
      (orderId, paymentId, amount, reason) =>
        // The refund endpoint returns its payment record, not the order aggregate. Fetch the
        // authoritative order before `applyMutation` merges anything into cashier state.
        applyMutation(
          orderId,
          async () => {
            await refundPayment(orderId, paymentId, amount, reason);
            return getOrderById(orderId);
          },
          'Failed to refund',
        ),
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
