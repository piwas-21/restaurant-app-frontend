import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import type { CashierQueueState } from '@/types/cashier';
import OrderList from './OrderList';
import OrderDetails from './OrderDetails';
import styles from './CashierMainContent.module.css';
import queueStatusStyles from './CashierQueueStatus.module.css';
import { ORDER_PAYMENT_STATUSES, paymentStatusLabel } from '@/lib/paymentStatus';

interface CashierMainContentProps {
  readonly filteredOrders: readonly OrderDto[];
  readonly pagination: {
    readonly totalCount: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
  };
  readonly selectedOrder: OrderDto | null;
  readonly selectedOrderId: string | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly queueState: CashierQueueState;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly paymentStatusFilter: string;
  readonly orderTypeFilter: string;
  readonly tableNumberFilter: string;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onStatusChange: (newStatus: string) => Promise<void>;
  readonly onAddPayment: () => void;
  readonly onRefund: () => void;
  readonly onCancel: () => void;
  readonly onToggleFocus: () => void;
  readonly onQuickConfirm: (orderId: string) => void;
  readonly onSearchChange: (query: string) => void;
  readonly onSearchSubmit: () => void;
  readonly onStatusFilterChange: (status: string) => void;
  readonly onPaymentStatusFilterChange: (status: string) => void;
  readonly onOrderTypeFilterChange: (type: string) => void;
  readonly onTableNumberFilterChange: (tableNumber: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry: () => void;
}

export default function CashierMainContent({
  filteredOrders,
  pagination,
  selectedOrder,
  selectedOrderId,
  isLoading,
  error,
  queueState,
  searchQuery,
  statusFilter,
  paymentStatusFilter,
  orderTypeFilter,
  tableNumberFilter,
  onSelectOrder,
  onStatusChange,
  onAddPayment,
  onRefund,
  onCancel,
  onToggleFocus,
  onQuickConfirm,
  onSearchChange,
  onSearchSubmit,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onOrderTypeFilterChange,
  onTableNumberFilterChange,
  onPageChange,
  onRetry,
}: CashierMainContentProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>{t('cashier.orders') || 'Orders'}</h2>
            <div className={styles.filterSection}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder={t('cashier.search_placeholder') || 'Search by order # or customer...'}
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onBlur={onSearchSubmit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearchSubmit();
                }}
              />
              <div className={styles.filterSelects}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.filterSelect}
                  value={tableNumberFilter}
                  onChange={(e) => onTableNumberFilterChange(e.target.value)}
                  placeholder={t('table_number')}
                  aria-label={t('table_number')}
                />
                <select
                  className={styles.filterSelect}
                  value={statusFilter}
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                  title={t('cashier.filter_status') || 'Filter by status'}
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Ready">Ready</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select
                  className={styles.filterSelect}
                  value={paymentStatusFilter}
                  onChange={(e) => onPaymentStatusFilterChange(e.target.value)}
                  title={t('cashier.filter_payment_status') || 'Filter by payment status'}
                >
                  {/* From ORDER_PAYMENT_STATUSES, not a hand-written list: this one offered `Paid`,
                      which the backend never emits, so selecting it matched no order at all. */}
                  <option value="all">{t('all_payment_statuses', 'All Payment Statuses')}</option>
                  {ORDER_PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {paymentStatusLabel(status, t)}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.filterSelect}
                  value={orderTypeFilter}
                  onChange={(e) => onOrderTypeFilterChange(e.target.value)}
                  title={t('cashier.filter_type') || 'Filter by order type'}
                >
                  <option value="all">All Types</option>
                  <option value="DineIn">Dine In</option>
                  <option value="Takeaway">Takeaway</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              <div className={styles.pagination} aria-live="polite">
                <span>
                  {t('showing_items', {
                    start: pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1,
                    end: Math.min(pagination.page * pagination.pageSize, pagination.totalCount),
                    total: pagination.totalCount,
                  })}
                </span>
                {pagination.totalPages > 1 && (
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      onClick={() => onPageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      {t('previous')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      {t('next')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {queueState === 'stale' && (
            <output className={`${queueStatusStyles.status} ${queueStatusStyles.warning}`}>
              <span>{t('cashier.queue_stale')}</span>
              <button className={queueStatusStyles.retryButton} type="button" onClick={onRetry} disabled={isLoading}>
                {t('retry')}
              </button>
            </output>
          )}

          {isLoading && filteredOrders.length === 0 && (
            <div className={styles.orderListEmpty}>
              <span>{t('cashier.loading') || 'Loading orders...'}</span>
            </div>
          )}
          {!isLoading && queueState === 'unavailable' && filteredOrders.length === 0 && (
            <div
              className={`${styles.orderListEmpty} ${queueStatusStyles.status} ${queueStatusStyles.error}`}
              role="alert"
            >
              <span>{t('cashier.queue_unavailable')}</span>
              <button className={queueStatusStyles.retryButton} type="button" onClick={onRetry} disabled={isLoading}>
                {t('retry')}
              </button>
            </div>
          )}
          {!isLoading && queueState !== 'unavailable' && filteredOrders.length === 0 && (
            <div className={styles.orderListEmpty}>
              <span>{t('cashier.no_orders') || 'No orders found'}</span>
            </div>
          )}
          {filteredOrders.length > 0 && (
            <section
              className={styles.orderList}
              tabIndex={0}
              aria-busy={isLoading}
              aria-label={t('cashier.orders') || 'Orders'}
              data-queue-state={queueState}
            >
              <OrderList
                orders={filteredOrders}
                selectedOrderId={selectedOrderId}
                onSelectOrder={onSelectOrder}
                isLoading={isLoading}
                error={error}
              />
            </section>
          )}
        </div>

        <div className={styles.main}>
          <div className={styles.detailsContainer}>
            {selectedOrder ? (
              <OrderDetails
                order={selectedOrder}
                onStatusChange={onStatusChange}
                onAddPayment={onAddPayment}
                onRefund={onRefund}
                onCancel={onCancel}
                onToggleFocus={onToggleFocus}
                onQuickConfirm={onQuickConfirm}
              />
            ) : (
              <div className={styles.noOrderSelected}>
                <span>{t('cashier.select_order') || 'Select an order to view details'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
