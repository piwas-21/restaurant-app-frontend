import { OrderDto } from '@/types/order';
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
          <span className={styles.summaryValue}>{order.total.toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.total_paid')}</span>
          <span className={styles.summaryValue}>{order.totalPaid.toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.remaining')}</span>
          <span className={styles.summaryValue}>{remainingBalance.toFixed(2)}</span>
        </div>
      </div>
    </>
  );
}
