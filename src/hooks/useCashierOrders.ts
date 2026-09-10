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

export interface CashierDateRange {
  startDate?: Date;
  endDate?: Date;
}

interface UseCashierOrdersReturn {
  orders: OrderDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  /**
   * `true` when the fetch landed, `false` when it failed — the failure itself is already on
   * screen via `error`, so the boolean exists only so a CALLER can tell the two apart. It could
   * not before: this resolves on both paths, so the cashier page's manual-refresh handler
   * announced "Orders refreshed" over the top of the error banner every time the backend was
   * down, and the `catch` it wrote for that case was unreachable.
   */
  refreshOrders: () => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  refundPayment: (orderId: string, paymentId: string, amount?: number) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
}

export function useCashierOrders(
  dateRange?: CashierDateRange,
  query: CashierOrdersQuery = DEFAULT_QUEUE_QUERY,
): UseCashierOrdersReturn {
  const dateRangeRef = useRef<CashierDateRange | undefined>(dateRange);
  dateRangeRef.current = dateRange;
  const queryRef = useRef<CashierOrdersQuery>(query);
  queryRef.current = query;

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(query.page);
  const [pageSize, setPageSize] = useState(query.pageSize);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const lastPolledAtRef = useRef<Date | null>(null);
  const primaryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestRequestRef = useRef(0);

  const refreshOrders = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const requestId = ++latestRequestRef.current;
    try {
      setError(null);
      const range = dateRangeRef.current;
      const currentQuery = queryRef.current;
      const filters = {
        ...currentQuery,
        ...(range?.startDate ? { startDate: range.startDate } : {}),
        ...(range?.endDate ? { endDate: range.endDate } : {}),
      };
      const result = await getCashierOrders(filters);
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;

      // A complete page replaces the prior page. Incremental `modifiedSince` results cannot
      // carry a truthful total or stable page boundaries, so the operational queue polls the
      // server-filtered page instead.
      setOrders(result.items || []);
      setTotalCount(result.totalCount);
      setPage(result.page);
      setPageSize(result.pageSize);
      setTotalPages(result.totalPages);
      lastPolledAtRef.current = new Date();
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

  // Refresh when the date window, server-side filters, search, or page changes. Keep the
  // prior page visible while the new page loads so a selected order does not blink away during a
  // normal refresh; the response atomically replaces it.
  const startDateMs = dateRange?.startDate?.getTime();
  const endDateMs = dateRange?.endDate?.getTime();
  const queryKey = JSON.stringify(query);
  const fetchKey = `${startDateMs ?? ''}:${endDateMs ?? ''}:${queryKey}`;
  const isFirstFetchEffectRef = useRef(true);
  useEffect(() => {
    if (isFirstFetchEffectRef.current) {
      isFirstFetchEffectRef.current = false;
      return;
    }
    setIsLoading(true);
    lastPolledAtRef.current = null;
    void refreshOrders();
  }, [fetchKey, refreshOrders]);

  // Call the API, merge the returned order into local state, surface errors via setError.
  // Replaces five near-identical handlers; lives in its own file since §4.
  const applyMutation = useCashierOrderMutation(setOrders, setError);

  return {
    orders,
    totalCount,
    page,
    pageSize,
    totalPages,
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
        // The refund endpoint returns its payment record, not the order aggregate. Fetch the
        // authoritative order before `applyMutation` merges anything into cashier state.
        applyMutation(
          orderId,
          async () => {
            await refundPayment(orderId, paymentId, amount);
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
