'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { QUEUE_SEARCH_MAX, queueSearchSchema } from '@/schemas/cashierQueueSearch.schema';
import { ORDER_PAYMENT_STATUSES, paymentStatusLabel } from '@/lib/paymentStatus';
import { ORDER_STATUSES, orderStatusLabel } from '@/lib/orderStatus';
import type { CashierQueueState } from '@/types/cashier';
import type { OrderDto } from '@/types/order';
import CashierReadOnlyOrderList from './CashierReadOnlyOrderList';
import styles from './CashierWorkspaceQueue.module.css';

interface Pagination {
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface CashierReadOnlyQueuePanelProps {
  readonly destination: 'orders' | 'history';
  readonly orders: readonly OrderDto[];
  readonly pagination: Pagination;
  readonly queueState: CashierQueueState;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly selectedOrderId: string | null;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly paymentStatusFilter: string;
  readonly orderTypeFilter: string;
  readonly timeZone?: string;
  readonly additionalFilters?: ReactNode;
  readonly onSelectOrder: (orderId: string) => void;
  readonly onOrderRowRef?: (orderId: string, node: HTMLButtonElement | null) => void;
  readonly onSearchChange: (value: string) => void;
  readonly onSearchSubmit: () => void;
  readonly onStatusFilterChange: (value: string) => void;
  readonly onPaymentStatusFilterChange: (value: string) => void;
  readonly onOrderTypeFilterChange: (value: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onRetry?: () => void;
}

export default function CashierReadOnlyQueuePanel({
  destination,
  orders,
  pagination,
  queueState,
  isLoading,
  error,
  selectedOrderId,
  searchQuery,
  statusFilter,
  paymentStatusFilter,
  orderTypeFilter,
  timeZone,
  additionalFilters,
  onSelectOrder,
  onOrderRowRef,
  onSearchChange,
  onSearchSubmit,
  onStatusFilterChange,
  onPaymentStatusFilterChange,
  onOrderTypeFilterChange,
  onPageChange,
  onRetry,
}: CashierReadOnlyQueuePanelProps) {
  const { t } = useTranslation();
  const isHistory = destination === 'history';
  const start = pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.totalCount);

  return (
    <section className={styles.queuePane} aria-label={t('cashier.workspace.queue')} aria-busy={isLoading}>
      <div className={styles.queueToolbar}>
        <form
          className={styles.searchForm}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <FormField
            label={t('cashier.workspace.search')}
            srOnlyLabel
            htmlFor={`${destination}-search`}
            className={styles.searchField}
          >
            <input
              id={`${destination}-search`}
              className={styles.searchInput}
              type="search"
              value={searchQuery}
              maxLength={QUEUE_SEARCH_MAX}
              onChange={(event) => {
                // The parsed value is the only thing that reaches the URL and the API query.
                const parsed = queueSearchSchema.safeParse({ search: event.target.value });
                if (parsed.success) onSearchChange(parsed.data.search);
              }}
              placeholder={t('cashier.workspace.search_placeholder')}
            />
          </FormField>
          <button type="submit" className={styles.searchSubmit} aria-label={t('cashier.workspace.search')}>
            <Search aria-hidden="true" size={18} />
          </button>
        </form>
        {additionalFilters}
        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <span>{t('cashier.workspace.status_filter')}</span>
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
            >
              <option value="all">{t('cashier.workspace.all_statuses')}</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>{t('cashier.workspace.payment_filter')}</span>
            <select
              className={styles.filterSelect}
              value={paymentStatusFilter}
              onChange={(event) => onPaymentStatusFilterChange(event.target.value)}
            >
              <option value="all">{t('cashier.workspace.all_payment_statuses')}</option>
              {ORDER_PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {paymentStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>{t('cashier.workspace.channel_filter')}</span>
            <select
              className={styles.filterSelect}
              value={orderTypeFilter}
              onChange={(event) => onOrderTypeFilterChange(event.target.value)}
            >
              <option value="all">{t('cashier.workspace.all_channels')}</option>
              <option value="DineIn">{t('cashier.workspace.channel_dine_in')}</option>
              <option value="Takeaway">{t('cashier.workspace.channel_takeaway')}</option>
              <option value="Delivery">{t('cashier.workspace.channel_delivery')}</option>
            </select>
          </label>
        </div>
        <p className={styles.resultCount} aria-live="polite">
          {t('cashier.workspace.showing', { start, end, total: pagination.totalCount })}
        </p>
      </div>
      {queueState === 'stale' && (
        <output className={styles.stateMessageWarning}>
          <span>{t('cashier.workspace.queue_stale')}</span>
          {onRetry && (
            <button type="button" className={styles.stateAction} onClick={onRetry} disabled={isLoading}>
              {t('cashier.workspace.retry')}
            </button>
          )}
        </output>
      )}
      <div className={styles.orderListViewport}>
        {isLoading && orders.length === 0 && (
          <output className={styles.stateMessage}>{t('cashier.workspace.queue_loading')}</output>
        )}
        {!isLoading && queueState === 'unavailable' && (
          <div className={styles.stateMessage} role="alert">
            <span>
              {error || t(isHistory ? 'cashier.workspace.history_unavailable' : 'cashier.workspace.queue_unavailable')}
            </span>
            {onRetry && (
              <button type="button" className={styles.stateAction} onClick={onRetry}>
                {t('cashier.workspace.retry')}
              </button>
            )}
          </div>
        )}
        {!isLoading && queueState !== 'unavailable' && orders.length === 0 && (
          <div className={styles.stateMessage}>{t('cashier.workspace.no_matches')}</div>
        )}
        {orders.length > 0 && (
          <CashierReadOnlyOrderList
            orders={orders}
            selectedOrderId={selectedOrderId}
            timeZone={timeZone}
            onSelectOrder={onSelectOrder}
            onOrderRowRef={onOrderRowRef}
          />
        )}
      </div>
      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.stateAction}
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            {t('previous')}
          </button>
          <span>{t('cashier.workspace.page_value', { page: pagination.page, total: pagination.totalPages })}</span>
          <button
            type="button"
            className={styles.stateAction}
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            {t('next')}
          </button>
        </div>
      )}
    </section>
  );
}
