'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCashierOrderGroups,
  updateOrderStatus,
  addPaymentToOrder,
  refundPayment,
  getOrderById,
  cancelOrder,
  toggleFocusOrder,
  getPaymentOperation,
} from '@/services/cashierService';
import type { CashierQueueState } from '@/types/cashier';
import { getErrorMessage } from '@/utils/apiClient';
import { useCashierOrdersStream } from './cashier/useCashierOrdersStream';
import { useCashierOrderMutation } from './cashier/useCashierOrderMutation';
import { CashierOrdersQuery, DEFAULT_QUEUE_QUERY } from './cashier/useCashierFilters';
import { resolveCashierQueuePage } from './cashier/cashierQueuePage';
import type { UseCashierOrdersReturn } from './cashier/useCashierOrdersTypes';
import { useCashierOrderGroupState } from './cashier/useCashierOrderGroupState';

const POLLING_INTERVAL_MS = 5000;

export function useCashierOrders(
  query: CashierOrdersQuery = DEFAULT_QUEUE_QUERY,
  onPageChange?: (page: number) => void,
): UseCashierOrdersReturn {
  const queryRef = useRef<CashierOrdersQuery>(query);
  queryRef.current = query;

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
  const { groups, orders, replaceGroups, updateOrders } = useCashierOrderGroupState(dataRevisionRef);

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
      const result = await getCashierOrderGroups({ ...queryWithoutDates, scope: 'Operational' });
      if (!isMountedRef.current || requestId !== latestRequestRef.current) return false;
      if (hasSnapshotRef.current && revisionAtRequest !== dataRevisionRef.current) {
        setIsLoading(false);
        return false;
      }

      const pageResult = resolveCashierQueuePage(result, queryRef.current.page, queryRef.current.pageSize);
      setPagination(pageResult.pagination);
      if (pageResult.requestedPageWasOutOfRange) {
        replaceGroups([]);
        onPageChange?.(pageResult.pagination.page);
        setIsLoading(true);
        return false;
      }

      replaceGroups(pageResult.items);
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
  }, [onPageChange, replaceGroups]);
  const stream = useCashierOrdersStream({
    onOrderUpdate: () => void refreshOrders(),
    onReconnectRequested: () => void refreshOrders(),
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
    groups,
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
    reconcilePayment: useCallback(
      async (orderId: string, operationId: string) => {
        const result = await getPaymentOperation(orderId, operationId);
        const authoritativeOrder = result.order;
        const sameOrder = authoritativeOrder?.id?.toLowerCase() === orderId.toLowerCase();
        const sameOperation = result.operationId?.toLowerCase() === operationId.toLowerCase();
        if (authoritativeOrder && sameOrder && sameOperation && isMountedRef.current) {
          updateOrders((previous) => previous.map((order) => (order.id === orderId ? authoritativeOrder : order)));
        }
        return result;
      },
      [updateOrders],
    ),
    refundPayment: useCallback(
      (orderId, paymentId, amount, reason) =>
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
