import StatusBadge from '@/components/design-system/StatusBadge';
import type { PendingPaymentOperation } from '@/lib/cashierPendingPayment';
import styles from './CashierPendingPaymentNotice.module.css';

interface CashierPendingPaymentNoticeProps {
  readonly pendingPayment: PendingPaymentOperation;
  readonly isBusy: boolean;
  readonly onRetry: () => void;
  readonly onAbandon: () => void;
  readonly t: (key: string) => string;
}

export default function CashierPendingPaymentNotice({
  pendingPayment,
  isBusy,
  onRetry,
  onAbandon,
  t,
}: CashierPendingPaymentNoticeProps) {
  const checking = pendingPayment.status === 'Checking';
  let labelKey = 'cashier.payment_check_failed';
  if (checking) {
    labelKey = 'cashier.payment_checking';
  } else if (pendingPayment.status === 'Unknown') {
    labelKey = 'cashier.payment_result_unknown';
  }
  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <StatusBadge tone={checking ? 'info' : 'warning'}>{t(labelKey)}</StatusBadge>
      <span>{t('cashier.collection.pending')}</span>
      {!checking && (
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onRetry} disabled={isBusy}>
            {t('cashier.collection.retry_payment_check')}
          </button>
          {pendingPayment.status === 'Unknown' && (
            <button type="button" className={styles.button} onClick={onAbandon} disabled={isBusy}>
              {t('cashier.collection.abandon_payment')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
