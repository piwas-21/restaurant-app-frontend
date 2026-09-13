import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrderDto } from '@/types/order';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import styles from './CashierCollection.module.css';

interface LastPayment {
  readonly applied: number;
  readonly change: number;
  readonly remaining: number;
}

interface CashierCollectionSuccessProps {
  readonly order: OrderDto;
  readonly payment: LastPayment;
  readonly onNextSale: () => void;
  readonly onReturnToOrder: () => void;
  readonly onPrintReceipt?: (order: OrderDto) => void;
}

export default function CashierCollectionSuccess({
  order,
  payment,
  onNextSale,
  onReturnToOrder,
  onPrintReceipt = () => undefined,
}: CashierCollectionSuccessProps) {
  const { t } = useTranslation();
  const [receiptChoice, setReceiptChoice] = useState<'printed' | 'skipped' | null>(null);
  const remainingMessage =
    payment.remaining > 0
      ? t('cashier.collection.remaining', { amount: formatOrderCurrency(payment.remaining, order) })
      : payment.remaining < 0
        ? t('cashier.collection.credit', { amount: formatOrderCurrency(Math.abs(payment.remaining), order) })
        : t('cashier.collection.settled');
  return (
    <div className={styles.successPanel} role="status" aria-live="polite">
      <CheckCircle size={20} aria-hidden="true" />
      <div>
        <strong>{t('cashier.collection.success')}</strong>
        <p>{t('cashier.collection.applied', { amount: formatOrderCurrency(payment.applied, order) })}</p>
        {payment.change > 0 && (
          <p>{t('cashier.collection.change', { amount: formatOrderCurrency(payment.change, order) })}</p>
        )}
        <p>{remainingMessage}</p>
        {receiptChoice && (
          <p role="status">
            {receiptChoice === 'printed'
              ? t('cashier.collection.receipt_printed')
              : t('cashier.collection.receipt_skipped')}
          </p>
        )}
      </div>
      <div className={styles.successActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            onPrintReceipt(order);
            setReceiptChoice('printed');
          }}
        >
          {t('cashier.collection.print_receipt')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => setReceiptChoice('skipped')}>
          {t('cashier.collection.no_receipt')}
        </button>
      </div>
      <div className={styles.successActions}>
        <button type="button" className={styles.secondaryButton} onClick={onNextSale}>
          {t('cashier.collection.next_sale')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReturnToOrder}>
          {t('cashier.collection.return_order')}
        </button>
      </div>
    </div>
  );
}
