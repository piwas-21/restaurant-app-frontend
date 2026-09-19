import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { OrderDto } from '@/types/order';
import { formatOrderCurrency } from '@/lib/cashierMoney';
import styles from './CashierCollection.module.css';

function remainingMessageFor(
  remaining: number,
  order: OrderDto,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (remaining > 0) {
    return t('cashier.collection.remaining', { amount: formatOrderCurrency(remaining, order) });
  }
  if (remaining < 0) {
    return t('cashier.collection.credit', { amount: formatOrderCurrency(Math.abs(remaining), order) });
  }
  return t('cashier.collection.settled');
}

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

/**
 * The committed-tender confirmation, as a centered modal (pilot feedback: the inline panel sat
 * at the bottom of the collection column where it was missed). Closing the modal returns to the
 * order — the tender is already recorded, so dismissal is safe; the outcome stays visible on
 * the order itself.
 */
export default function CashierCollectionSuccess({
  order,
  payment,
  onNextSale,
  onReturnToOrder,
  onPrintReceipt = () => undefined,
}: CashierCollectionSuccessProps) {
  const { t } = useTranslation();
  const [receiptChoice, setReceiptChoice] = useState<'printed' | 'skipped' | null>(null);
  const remainingMessage = remainingMessageFor(payment.remaining, order, t);
  return (
    <BaseModal title={t('cashier.collection.success')} onClose={onReturnToOrder} isOpen>
      <div className={styles.successBody} role="status" aria-live="polite">
        <CheckCircle size={20} aria-hidden="true" />
        <p>{t('cashier.collection.applied', { amount: formatOrderCurrency(payment.applied, order) })}</p>
        {payment.change > 0 && (
          <p>{t('cashier.collection.change', { amount: formatOrderCurrency(payment.change, order) })}</p>
        )}
        <p>{remainingMessage}</p>
        {receiptChoice && (
          <p>
            <output>
              {receiptChoice === 'printed'
                ? t('cashier.collection.receipt_printed')
                : t('cashier.collection.receipt_skipped')}
            </output>
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
        <button type="button" className={styles.submitButton} onClick={onNextSale}>
          {t('cashier.collection.next_sale')}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReturnToOrder}>
          {t('cashier.collection.return_order')}
        </button>
      </div>
    </BaseModal>
  );
}
