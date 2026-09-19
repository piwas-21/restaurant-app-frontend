import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './CashierStatusBadges.module.css';

/**
 * The ticket's two status badges, each under an explicit label (pilot feedback: two
 * unlabeled pills read as one unknown pair). Fulfilment comes from the shared order
 * adapter; payment keeps its own shared label — the same vocabulary as the filters.
 */
export default function CashierStatusBadges({ order }: { readonly order: OrderDto }) {
  const { t } = useTranslation();
  return (
    <div className={styles.badges}>
      <div className={styles.badgeGroup}>
        <span className={styles.badgeLabel}>{t('cashier.workspace.badge_fulfilment')}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className={styles.badgeGroup}>
        <span className={styles.badgeLabel}>{t('cashier.workspace.badge_payment')}</span>
        <StatusBadge tone="neutral">{paymentStatusLabel(order.paymentStatus, t)}</StatusBadge>
      </div>
    </div>
  );
}
