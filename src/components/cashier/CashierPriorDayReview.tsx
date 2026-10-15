'use client';

import { useTranslation } from 'react-i18next';
import type { OrderDto, PagedResult } from '@/types/order';
import { getOrderDisplayNumber } from '@/utils/orderDisplay';
import styles from './CashierPriorDayReview.module.css';

interface CashierPriorDayReviewProps {
  readonly orders: PagedResult<OrderDto>;
  readonly dismissingOrderId: string | null;
  readonly error: string | null;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly onReview: (orderId: string) => void;
  readonly onDismiss: (orderId: string) => Promise<void>;
  readonly onLoadMore: () => Promise<void>;
}

export default function CashierPriorDayReview({
  orders,
  dismissingOrderId,
  error,
  hasMore,
  isLoadingMore,
  onReview,
  onDismiss,
  onLoadMore,
}: CashierPriorDayReviewProps) {
  const { t } = useTranslation();
  if (orders.totalCount === 0 && !error) return null;

  return (
    <section className={styles.panel} aria-label={t('cashier.workspace.prior_day_title')}>
      <details className={styles.disclosure}>
        <summary className={styles.panelHeading}>
          <h2>{t('cashier.workspace.prior_day_title')}</h2>
          <span>{orders.totalCount}</span>
        </summary>
        <p>{t('cashier.workspace.prior_day_description')}</p>
        <ul className={styles.orderList}>
          {orders.items.map((order) => (
            <li key={order.id}>
              <strong dir="auto">{getOrderDisplayNumber(order)}</strong>
              {order.businessDate && <span>{order.businessDate}</span>}
              <span>{t(`order_status_${order.status.toLowerCase()}`, order.status)}</span>
              <div className={styles.actions}>
                <button type="button" onClick={() => onReview(order.id)}>
                  {t('cashier.workspace.prior_day_review')}
                </button>
                <button
                  type="button"
                  onClick={() => void onDismiss(order.id).catch(() => undefined)}
                  disabled={dismissingOrderId === order.id}
                >
                  {dismissingOrderId === order.id
                    ? t('cashier.workspace.prior_day_dismissing')
                    : t('cashier.workspace.prior_day_dismiss')}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            className={styles.loadMore}
            onClick={() => void onLoadMore().catch(() => undefined)}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? t('cashier.workspace.prior_day_loading') : t('cashier.workspace.prior_day_load_more')}
          </button>
        )}
      </details>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
