'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CashierQueueState } from '@/types/cashier';
import type { OrderDto } from '@/types/order';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierReadOnlyQueuePanel from './CashierReadOnlyQueuePanel';
import CashierReadOnlyTicket from './CashierReadOnlyTicket';
import styles from './CashierWorkspaceView.module.css';

interface Pagination {
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface CashierReadOnlyDestinationProps {
  readonly destination: 'orders' | 'history';
  readonly description: string;
  readonly orders: readonly OrderDto[];
  readonly pagination: Pagination;
  readonly queueState: CashierQueueState;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly isConnected?: boolean;
  readonly selectedOrderId: string | null;
  readonly selectedOrder: OrderDto | null;
  readonly selectedOrderLoading: boolean;
  readonly selectedOrderError: string | null;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly paymentStatusFilter: string;
  readonly orderTypeFilter: string;
  readonly additionalFilters?: ReactNode;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onBack: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onSearchSubmit: () => void;
  readonly onStatusFilterChange: (value: string) => void;
  readonly onPaymentStatusFilterChange: (value: string) => void;
  readonly onOrderTypeFilterChange: (value: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
}

export default function CashierReadOnlyDestination({
  destination,
  description,
  orders,
  pagination,
  queueState,
  isLoading,
  error,
  isConnected,
  selectedOrderId,
  selectedOrder,
  selectedOrderLoading,
  selectedOrderError,
  searchQuery,
  statusFilter,
  paymentStatusFilter,
  orderTypeFilter,
  additionalFilters,
  onSelectOrder,
  onBack,
  onSearchChange,
  onSearchSubmit,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onOrderTypeFilterChange,
  onPageChange,
  onRetry,
}: CashierReadOnlyDestinationProps) {
  const { t } = useTranslation();
  const hasSelection = Boolean(selectedOrderId);

  return (
    <CashierWorkspaceShell activeDestination={destination} queueState={queueState} isConnected={isConnected}>
      <section className={styles.destination} aria-labelledby={`${destination}-title`}>
        <header className={styles.destinationHeader}>
          <div>
            <h1 id={`${destination}-title`} className={styles.destinationTitle}>
              {t(`cashier.workspace.${destination}`)}
            </h1>
            <p className={styles.destinationDescription}>{description}</p>
          </div>
          <button type="button" className={styles.refreshButton} onClick={onRetry} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={17} />
            {t('cashier.workspace.refresh')}
          </button>
        </header>
        <div className={`${styles.workspaceGrid} ${hasSelection ? styles.hasSelection : ''}`}>
          <CashierReadOnlyQueuePanel
            destination={destination}
            orders={orders}
            pagination={pagination}
            queueState={queueState}
            isLoading={isLoading}
            error={error}
            selectedOrderId={selectedOrderId}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            paymentStatusFilter={paymentStatusFilter}
            orderTypeFilter={orderTypeFilter}
            additionalFilters={additionalFilters}
            onSelectOrder={onSelectOrder}
            onSearchChange={onSearchChange}
            onSearchSubmit={onSearchSubmit}
            onStatusFilterChange={onStatusFilterChange}
            onPaymentStatusFilterChange={onPaymentStatusFilterChange}
            onOrderTypeFilterChange={onOrderTypeFilterChange}
            onPageChange={onPageChange}
            onRetry={onRetry}
          />
          <section className={styles.ticketPane} aria-label={t('cashier.workspace.order_details')}>
            <CashierReadOnlyTicket
              order={selectedOrder}
              isLoading={selectedOrderLoading}
              error={selectedOrderError}
              onBack={hasSelection ? onBack : undefined}
            />
          </section>
        </div>
      </section>
    </CashierWorkspaceShell>
  );
}
