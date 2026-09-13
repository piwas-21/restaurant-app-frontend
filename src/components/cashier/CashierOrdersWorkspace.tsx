'use client';

import { useTranslation } from 'react-i18next';
import { useCashierOrders } from '@/hooks/useCashierOrders';
import { useCashierFilters } from '@/hooks/cashier/useCashierFilters';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import { useCashierOrderSelection } from '@/hooks/cashier/useCashierOrderSelection';
import { useCashierTenantTimeZone } from '@/hooks/cashier/useCashierTenantTimeZone';
import CashierReadOnlyDestination from './CashierReadOnlyDestination';

export default function CashierOrdersWorkspace() {
  const { t } = useTranslation();
  const filters = useCashierFilters();
  const queue = useCashierOrders(filters.query);
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
      searchQuery={filters.searchQuery}
      statusFilter={filters.statusFilter}
      paymentStatusFilter={filters.paymentStatusFilter}
      orderTypeFilter={filters.orderTypeFilter}
      onSelectOrder={route.navigateWithOrder}
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
