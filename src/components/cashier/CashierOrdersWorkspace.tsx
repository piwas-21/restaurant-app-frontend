'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCashierOrders } from '@/hooks/useCashierOrders';
import { useNotification } from '@/hooks/useNotification';
import { useCashierFilters } from '@/hooks/cashier/useCashierFilters';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import { useCashierTenantTimeZone } from '@/hooks/cashier/useCashierTenantTimeZone';
import { useCashierNewOrderAlerts } from '@/hooks/cashier/useCashierNewOrderAlerts';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';

export default function CashierOrdersWorkspace() {
  const { t } = useTranslation();
  const filters = useCashierFilters();
  const queue = useCashierOrders(filters.query);
  const { notifyNewOrder } = useNotification();
  const { enqueueSnackbar } = useSnackbar();
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
  // Sound + a visible snackbar, never a modal or focus takeover.
  useCashierNewOrderAlerts({
    orders: queue.orders,
    isInitialLoading: queue.isLoading,
    notifyNewOrder: announceNewOrder,
  });
  const route = useCashierOrderRoute();
  const selection = useCashierOrderSelection(queue.orders, route.selectedOrderId);
  const timeZone = useCashierTenantTimeZone();

  return (
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
  );
}
