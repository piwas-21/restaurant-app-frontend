'use client';

import { useTranslation } from 'react-i18next';
import { useCashierHistoryFilters } from '@/hooks/cashier/useCashierHistoryFilters';
import { useCashierHistoryOrders } from '@/hooks/cashier/useCashierHistoryOrders';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import CashierHistoryFilters from './CashierHistoryFilters';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';

export default function CashierHistoryWorkspace() {
  const { t } = useTranslation();
  const filters = useCashierHistoryFilters();
  const queue = useCashierHistoryOrders(filters.query, {
    enabled: filters.rangeReady,
    // A refresh of the tenant clock must not turn an already-valid query into a second queue fetch.
    // The loading state is only meaningful while there is no usable range yet.
    blockedState: filters.rangeReady ? 'unavailable' : filters.tenantDayLoading ? 'loading' : 'unavailable',
  });
  const route = useCashierOrderRoute();
  const selection = useCashierOrderSelection(queue.orders, route.selectedOrderId);
  const effectiveQueueState =
    filters.range !== 'custom' && filters.tenantDayError && filters.tenantDay ? 'stale' : queue.queueState;
  const rangeError =
    !filters.rangeReady && filters.range === 'custom'
      ? filters.tenantDayLoading
        ? null
        : t('cashier.workspace.history_select_dates')
      : !filters.rangeReady && filters.tenantDayError
        ? filters.tenantDayErrorMessage || t('cashier.workspace.tenant_day_unavailable')
        : null;

  const retry = () => {
    if (filters.range === 'custom') {
      if (filters.rangeReady) void queue.refreshOrders();
      return;
    }
    if (filters.tenantDayError) void filters.refreshTenantDay();
    if (filters.rangeReady) void queue.refreshOrders();
  };
  const canRetry = filters.rangeReady || (filters.range !== 'custom' && filters.tenantDayError);

  return (
    <CashierReadOnlyDestination
      destination="history"
      description={t('cashier.workspace.history_description')}
      timeZone={filters.tenantTimeZone}
      orders={queue.orders}
      pagination={queue.pagination}
      queueState={effectiveQueueState}
      isLoading={queue.isLoading}
      error={rangeError || queue.error}
      selectedOrderId={route.selectedOrderId}
      selectedOrder={selection.order}
      selectedOrderLoading={selection.isLoading}
      selectedOrderError={selection.error}
      searchQuery={filters.searchQuery}
      statusFilter={filters.statusFilter}
      paymentStatusFilter={filters.paymentStatusFilter}
      orderTypeFilter={filters.orderTypeFilter}
      additionalFilters={<CashierHistoryFilters filters={filters} />}
      onSelectOrder={route.navigateWithOrder}
      onCollect={route.navigateToCollection}
      onBack={route.clearOrder}
      onSearchChange={filters.setSearchQuery}
      onSearchSubmit={filters.submitSearch}
      onStatusFilterChange={filters.setStatusFilter}
      onPaymentStatusFilterChange={filters.setPaymentStatusFilter}
      onOrderTypeFilterChange={filters.setOrderTypeFilter}
      onPageChange={filters.setPage}
      onRetry={canRetry ? retry : undefined}
    />
  );
}
