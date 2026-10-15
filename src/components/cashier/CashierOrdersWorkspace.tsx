'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCashierOrders } from '@/hooks/useCashierOrders';
import { useNotification } from '@/hooks/useNotification';
import { useCashierFilters } from '@/hooks/cashier/useCashierFilters';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import { useCashierTenantTimeZoneState } from '@/hooks/cashier/useCashierTenantTimeZone';
import { useCashierHistoryOrders } from '@/hooks/cashier/useCashierHistoryOrders';
import { useCashierNewOrderAlerts } from '@/hooks/cashier/useCashierNewOrderAlerts';
import { useConfirmationFlowConfig } from '@/hooks/orderTypes/useConfirmationFlowConfig';
import { approveOrder, rejectOrder } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { shouldQueuePendingReview } from './cashierOrderReviewQueue';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';
import MarketplacePendingInbox from '@/components/order/MarketplacePendingInbox';
import CashierPriorDayReview from './CashierPriorDayReview';
import { filterCashierGroupsToBusinessDate, filterOrdersToBusinessDate } from '@/utils/orderBusinessDate';

const CashierConfirmModal = dynamic(() => import('./CashierConfirmModal'), { ssr: false });

export default function CashierOrdersWorkspace() {
  const { t } = useTranslation();
  const filters = useCashierFilters();
  const tenantContext = useCashierTenantTimeZoneState();
  const queueQuery = tenantContext.date ? { ...filters.query, tenantDay: tenantContext.date } : filters.query;
  const queue = useCashierOrders(queueQuery, filters.setPage, Boolean(tenantContext.date));
  const visibleOrders = useMemo(
    () => filterOrdersToBusinessDate(queue.orders, tenantContext.date, tenantContext.timeZone),
    [queue.orders, tenantContext.date, tenantContext.timeZone],
  );
  const visibleGroups = useMemo(
    () => filterCashierGroupsToBusinessDate(queue.groups, tenantContext.date, tenantContext.timeZone),
    [queue.groups, tenantContext.date, tenantContext.timeZone],
  );
  const priorDayQueue = useCashierHistoryOrders(
    {
      scope: 'All',
      page: 1,
      pageSize: 50,
      archiveBusinessDate: tenantContext.date,
    },
    {
      enabled: Boolean(tenantContext.date),
      blockedState: tenantContext.isLoading ? 'loading' : 'unavailable',
    },
  );
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
  const approveActiveReview = useCallback(async (orderId: string, preparationMinutes: number | null) => {
    await approveOrder(orderId, preparationMinutes);
  }, []);
  const rejectActiveReview = useCallback(async (orderId: string, reason: string) => {
    await rejectOrder(orderId, reason);
  }, []);
  const route = useCashierOrderRoute();
  const selection = useCashierOrderSelection(queue.orders, route.selectedOrderId);
  const refreshAllOrders = () => {
    tenantContext.refresh();
    void queue.refreshOrders();
    if (tenantContext.date) void priorDayQueue.refreshOrders();
  };
  const showMarketplaceInbox = useCallback(() => {
    filters.setSearchQuery('');
    filters.submitSearch();
    filters.setOrderTypeFilter('all');
    filters.setPaymentStatusFilter('all');
    filters.setMarketplaceOnlyFilter(true);
    filters.setStatusFilter('PendingApproval');
  }, [filters]);
  const clearMarketplaceInbox = useCallback(() => {
    filters.setMarketplaceOnlyFilter(false);
    filters.setStatusFilter('all');
  }, [filters]);

  return (
    <>
      <CashierReadOnlyDestination
        destination="orders"
        description={t('cashier.workspace.orders_description')}
        timeZone={tenantContext.timeZone}
        orders={visibleOrders}
        groups={visibleGroups}
        pagination={queue.pagination}
        queueState={
          tenantContext.isLoading && !tenantContext.date
            ? 'loading'
            : tenantContext.hasError
              ? tenantContext.date
                ? 'stale'
                : 'unavailable'
              : queue.queueState
        }
        isLoading={queue.isLoading || (tenantContext.isLoading && !tenantContext.date)}
        error={tenantContext.hasError ? t('cashier.workspace.tenant_day_unavailable') : queue.error}
        isConnected={queue.isConnected}
        selectedOrderId={route.selectedOrderId}
        selectedOrder={selection.order}
        selectedOrderLoading={selection.isLoading}
        selectedOrderRefreshing={selection.isRefreshing}
        selectedOrderError={selection.error}
        onRefreshSelectedOrder={selection.refresh}
        onOrderChanged={refreshAllOrders}
        searchQuery={filters.searchQuery}
        statusFilter={filters.statusFilter}
        paymentStatusFilter={filters.paymentStatusFilter}
        orderTypeFilter={filters.orderTypeFilter}
        marketplaceOnlyFilter={filters.marketplaceOnlyFilter}
        additionalFilters={
          <>
            {(priorDayQueue.priorDayUnresolvedOrders.totalCount > 0 ||
              priorDayQueue.error ||
              priorDayQueue.priorDayError) && (
              <CashierPriorDayReview
                orders={priorDayQueue.priorDayUnresolvedOrders}
                dismissingOrderId={priorDayQueue.dismissingOrderId}
                error={priorDayQueue.dismissError ?? priorDayQueue.priorDayError ?? priorDayQueue.error}
                hasMore={priorDayQueue.hasMorePriorDayOrders}
                isLoadingMore={priorDayQueue.isLoadingPriorDayPage}
                onReview={route.navigateWithOrder}
                onDismiss={priorDayQueue.dismissPriorDayOrder}
                onLoadMore={priorDayQueue.loadMorePriorDayOrders}
              />
            )}
            <MarketplacePendingInbox
              active={filters.marketplaceOnlyFilter && filters.statusFilter === 'PendingApproval'}
              onSelect={showMarketplaceInbox}
              onClear={clearMarketplaceInbox}
            />
          </>
        }
        onSelectOrder={route.navigateWithOrder}
        onCollect={(orderId, serviceSessionId) => {
          if (serviceSessionId) route.navigateToSessionCollection(serviceSessionId, orderId, undefined, 'orders');
          else route.navigateToCollection(orderId);
        }}
        onCollectSession={(serviceSessionId) =>
          route.navigateToSessionCollection(serviceSessionId, undefined, undefined, 'orders')
        }
        onBack={route.clearOrder}
        onSearchChange={filters.setSearchQuery}
        onSearchSubmit={filters.submitSearch}
        onStatusFilterChange={filters.setStatusFilter}
        onPaymentStatusFilterChange={filters.setPaymentStatusFilter}
        onOrderTypeFilterChange={filters.setOrderTypeFilter}
        onMarketplaceOnlyFilterChange={filters.setMarketplaceOnlyFilter}
        onPageChange={filters.setPage}
        onPageSizeChange={filters.setPageSize}
        onRetry={refreshAllOrders}
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
