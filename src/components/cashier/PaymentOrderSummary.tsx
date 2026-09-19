import type { OrderDto } from '@/types/order';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import styles from './PaymentModal.module.css';

interface PaymentOrderSummaryProps {
  readonly order: OrderDto;
  readonly remainingBalance: number;
  readonly t: (key: string) => string;
}

export default function PaymentOrderSummary({ order, remainingBalance, t }: PaymentOrderSummaryProps) {
  return (
    <>
      <h3 className={styles.summaryTitle}>{t('cashier.order_summary')}</h3>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.total')}</span>
          <span className={styles.summaryValue}>{formatOrderCurrency(order.total, order)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.total_paid')}</span>
          <span className={styles.summaryValue}>{formatOrderCurrency(order.totalPaid, order)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.remaining')}</span>
          <span className={styles.summaryValue}>{formatOrderCurrency(remainingBalance, order)}</span>
        </div>
      </div>
    </>
  );
}
