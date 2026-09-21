'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCashierOrders } from '@/hooks/useCashierOrders';
import { useNotification } from '@/hooks/useNotification';
import { useCashierFilters } from '@/hooks/cashier/useCashierFilters';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import { useCashierTenantTimeZone } from '@/hooks/cashier/useCashierTenantTimeZone';
import { useCashierNewOrderAlerts } from '@/hooks/cashier/useCashierNewOrderAlerts';
import { useConfirmationFlowConfig } from '@/hooks/orderTypes/useConfirmationFlowConfig';
import { approveOrder, rejectOrder } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { shouldQueuePendingReview } from './cashierOrderReviewQueue';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';

const CashierConfirmModal = dynamic(() => import('./CashierConfirmModal'), { ssr: false });

export default function CashierOrdersWorkspace() {
  const { t } = useTranslation();
  const filters = useCashierFilters();
  const queue = useCashierOrders(filters.query);
  const { notifyNewOrder } = useNotification();
  const { enqueueSnackbar } = useSnackbar();
  const { isLoading: flowsLoading, flowByType } = useConfirmationFlowConfig();
  const [reviewQueue, setReviewQueue] = useState<OrderDto[]>([]);
  const announceNewOrder = useCallback(
    (orderNumber: string, customerName: string) => {
      notifyNewOrder(orderNumber, customerName);
      enqueueSnackbar(
        customerName
          ? t('cashier.new_order_alert_customer', { orderNumber, customerName })
          : t('cashier.new_order_alert', { orderNumber }),
        { variant: 'info' },
      );
    },
    [enqueueSnackbar, notifyNewOrder, t],
  );
  const enqueuePendingReview = useCallback(
    (order: OrderDto) => {
      if (!shouldQueuePendingReview(order.type, flowsLoading, flowByType)) return;
      setReviewQueue((current) =>
        current.some((candidate) => candidate.id === order.id) ? current : [...current, order],
      );
    },
    [flowByType, flowsLoading],
  );

  // Sound + visible snackbar for every new Pending order. Review-flow orders additionally enter
  // the immediate decision queue once their tenant configuration is known.
  useCashierNewOrderAlerts({
    orders: queue.orders,
    isInitialLoading: queue.isLoading,
    notifyNewOrder: announceNewOrder,
    onPendingOrder: enqueuePendingReview,
  });

  useEffect(() => {
    if (flowsLoading) return;
    setReviewQueue((current) => current.filter((order) => flowByType?.get(order.type)?.flow === 'acknowledge'));
  }, [flowByType, flowsLoading]);

  useEffect(() => {
    setReviewQueue((current) =>
      current.filter((candidate) => {
        const fresh = queue.orders.find((order) => order.id === candidate.id);
        return !fresh || fresh.status === 'Pending';
      }),
    );
  }, [queue.orders]);

  const activeReview = reviewQueue[0] ?? null;
  const dismissActiveReview = useCallback(() => {
    setReviewQueue((current) => current.slice(1));
  }, []);
  const closeActiveReview = useCallback(() => {
    dismissActiveReview();
    void queue.refreshOrders();
  }, [dismissActiveReview, queue]);
  const approveActiveReview = useCallback(async (orderId: string, preparationMinutes: number) => {
    await approveOrder(orderId, preparationMinutes);
  }, []);
  const rejectActiveReview = useCallback(async (orderId: string, reason: string) => {
    await rejectOrder(orderId, reason);
  }, []);
  const route = useCashierOrderRoute();
  const selection = useCashierOrderSelection(queue.orders, route.selectedOrderId);
  const timeZone = useCashierTenantTimeZone();

  return (
    <>
      <CashierReadOnlyDestination
        destination="orders"
        description={t('cashier.workspace.orders_description')}
        timeZone={timeZone}
        orders={queue.orders}
        pagination={queue.pagination}
        queueState={queue.queueState}
        isLoading={queue.isLoading}
        error={queue.error}
        isConnected={queue.isConnected}
        selectedOrderId={route.selectedOrderId}
        selectedOrder={selection.order}
        selectedOrderLoading={selection.isLoading}
        selectedOrderError={selection.error}
        onOrderChanged={() => void queue.refreshOrders()}
        searchQuery={filters.searchQuery}
        statusFilter={filters.statusFilter}
        paymentStatusFilter={filters.paymentStatusFilter}
        orderTypeFilter={filters.orderTypeFilter}
        onSelectOrder={route.navigateWithOrder}
        onCollect={route.navigateToCollection}
        onBack={route.clearOrder}
        onSearchChange={filters.setSearchQuery}
        onSearchSubmit={filters.submitSearch}
        onStatusFilterChange={filters.setStatusFilter}
        onPaymentStatusFilterChange={filters.setPaymentStatusFilter}
        onOrderTypeFilterChange={filters.setOrderTypeFilter}
        onPageChange={filters.setPage}
        onRetry={() => void queue.refreshOrders()}
      />
      <CashierConfirmModal
        order={activeReview}
        isOpen={activeReview !== null}
        onClose={closeActiveReview}
        onConfirm={approveActiveReview}
        onReject={rejectActiveReview}
        confirmationFlow="acknowledge"
      />
    </>
  );
}
