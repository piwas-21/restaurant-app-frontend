import type { TFunction } from 'i18next';
import { orderStatusLabel } from '@/lib/orderStatus';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import { recoveryDispositionTranslationKey } from '@/lib/tableOccupancyRecoveryLabels';
import type { TableOccupancyRecoveryOrder } from '@/types/tableOccupancyRecovery';
import styles from './TableReadinessAction.module.css';

interface Props {
  readonly orders: readonly TableOccupancyRecoveryOrder[];
  readonly currency: string | null;
  readonly locale: string;
  readonly t: TFunction;
  readonly money: (value: number, currency: string | null, locale: string) => string;
}

export default function TableOccupancyRecoveryOrders({ orders, currency, locale, t, money }: Props) {
  return (
    <ul className={styles.recoveryOrders}>
      {orders.map((order) => (
        <li key={order.orderId} className={styles.recoveryOrder}>
          <strong>{order.orderNumber}</strong>
          <span>{t(recoveryDispositionTranslationKey(order.disposition))}</span>
          <span>
            {t('accountPayments.recovery.original_state', {
              status: orderStatusLabel(order.originalStatus, t),
              payment: paymentStatusLabel(order.originalPaymentStatus, t),
            })}
          </span>
          <span>
            {t('accountPayments.recovery.order_amounts', {
              total: money(order.originalTotal, currency, locale),
              credit: money(order.originalBillingCreditAmount, currency, locale),
              paid: money(order.originalTotalPaid, currency, locale),
              remaining: money(order.originalRemainingAmount, currency, locale),
            })}
          </span>
          {(order.wasKitchenReleased || order.hadRoutingHistory) && (
            <span>{t('accountPayments.recovery.kitchen_history')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
