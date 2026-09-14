import { PaymentMethod } from '@/types/order';
import styles from './PaymentModal.module.css';

interface PaymentModalFooterProps {
  readonly amount: string;
  readonly method: string;
  readonly pending: boolean;
  readonly checking?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly t: (key: string) => string;
}

export default function PaymentModalFooter({
  amount,
  method,
  pending,
  checking = false,
  onCancel,
  onConfirm,
  t,
}: PaymentModalFooterProps) {
  let confirmLabel = t('cashier.add_payment');
  if (checking) confirmLabel = t('cashier.payment_checking');
  else if (pending) confirmLabel = t('common.loading');
  else if (method !== PaymentMethod.Cash) confirmLabel = t('cashier.record_card_payment');

  return (
    <>
      <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={pending}>
        {t('common.cancel')}
      </button>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={onConfirm}
        disabled={!amount || !method || pending}
      >
        {confirmLabel}
      </button>
    </>
  );
}
