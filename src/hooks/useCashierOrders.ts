'use client';

import { useState, useEffect, useCallback, useRef, type SetStateAction } from 'react';
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
import type { CashierQueueState } from '@/types/cashier';
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
  /** Whether the visible rows are a current, stale, or unavailable server snapshot. */
  queueState: CashierQueueState;
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

export function useCashierOrders(query: CashierOrdersQuery = DEFAULT_QUEUE_QUERY): UseCashierOrdersReturn {
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
  const [queueState, setQueueState] = useState<CashierQueueState>('loading');

  const isMountedRef = useRef(true);
  const primaryPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestRequestRef = useRef(0);
  const dataRevisionRef = useRef(0);
  const hasSnapshotRef = useRef(false);
  const updateOrders = useCallback((updater: SetStateAction<OrderDto[]>) => {
    dataRevisionRef.current += 1;
    setOrders(updater);
  }, []);

  const refreshOrders = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return false;
    const requestId = ++latestRequestRef.current;
    const revisionAtRequest = dataRevisionRef.current;
    try {
      setError(null);
      const {
        tenantDay: _tenantDay,
        startDate: _startDate,
        endDate: _endDate,
        ...queryWithoutDates
      } = queryRef.current;
      const result = await getCashierOrders({ ...queryWithoutDates, scope: 'Operational' });
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;
      if (hasSnapshotRef.current && revisionAtRequest !== dataRevisionRef.current) {
        setIsLoading(false);
        return false;
      }

      const items = Array.isArray(result.items) ? result.items : [];
      const pageSize = result.pageSize > 0 ? result.pageSize : queryRef.current.pageSize;
      const totalCount = Number.isFinite(result.totalCount) ? result.totalCount : items.length;
      const page = result.page > 0 ? result.page : queryRef.current.page;
      const totalPages = result.totalPages > 0 ? result.totalPages : Math.ceil(totalCount / pageSize);

      updateOrders(items);
      setPagination({ totalCount, page, pageSize, totalPages });
      hasSnapshotRef.current = true;
      setQueueState('ready');
      setIsLoading(false);
      return true;
    } catch (error_) {
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;
      const errorMessage = getErrorMessage(error_) ?? 'Failed to load orders';
      setError(errorMessage);
      setQueueState(hasSnapshotRef.current ? 'stale' : 'unavailable');
      setIsLoading(false);
      console.error('Error fetching orders:', error_);
      return false;
    }
  }, [updateOrders]);

  const stream = useCashierOrdersStream({
    onOrderUpdate: () => {
      void refreshOrders();
    },
    onReconnectRequested: () => {
      void refreshOrders();
    },
  });
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
  }, [refreshOrders]);

  const fetchKey = JSON.stringify(query);
  const isFirstFetchEffectRef = useRef(true);
  useEffect(() => {
    if (isFirstFetchEffectRef.current) {
      isFirstFetchEffectRef.current = false;
      return;
    }
    setIsLoading(true);
    void refreshOrders();
  }, [fetchKey, refreshOrders]);

  const applyMutation = useCashierOrderMutation(updateOrders, setError);

  return {
    orders,
    pagination,
    isConnected: stream.isConnected,
    isLoading,
    error: error || stream.error,
    queueState,
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
