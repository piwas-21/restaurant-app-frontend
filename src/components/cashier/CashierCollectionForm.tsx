import type { FormEvent } from 'react';
import { CreditCard } from 'lucide-react';
import { cashSuggestions } from '@/lib/cashierMoney';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import CashReceivedFields from './CashReceivedFields';
import CashierNumericKeypad from './CashierNumericKeypad';
import PaymentAmountField from './PaymentAmountField';
import PaymentMethodField from './PaymentMethodField';
import PaymentReferenceFields from './PaymentReferenceFields';
import styles from './CashierCollection.module.css';
import entry from './CashierCollectionEntry.module.css';

interface CashierCollectionFormProps {
  readonly order: OrderDto;
  readonly amount: string;
  readonly received: string;
  readonly method: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly isCheckingPayment: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  readonly onAmountChange: (value: string) => void;
  readonly onReceivedChange: (value: string) => void;
  readonly onMethodChange: (value: string) => void;
  readonly onTransactionChange: (value: string) => void;
  readonly onNotesChange: (value: string) => void;
  readonly onSetMaxAmount: () => void;
  readonly onExactCash: () => void;
  readonly onCashSuggestion: (value: number) => void;
  readonly t: (key: string) => string;
  readonly onReturnToOrder: () => void;
}

export default function CashierCollectionForm({
  order,
  amount,
  received,
  method,
  transactionId,
  notes,
  error,
  isPending,
  isCheckingPayment,
  onSubmit,
  onAmountChange,
  onReceivedChange,
  onMethodChange,
  onTransactionChange,
  onNotesChange,
  onSetMaxAmount,
  onExactCash,
  onCashSuggestion,
  t,
  onReturnToOrder,
}: CashierCollectionFormProps) {
  const pendingLabel = isCheckingPayment ? t('cashier.payment_checking') : t('common.loading');
  let submitLabel = pendingLabel;
  if (!isPending) {
    submitLabel = method === PaymentMethod.Cash ? t('cashier.add_payment') : t('cashier.record_card_payment');
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={entry.entryGrid}>
        <div className={entry.entryFields}>
          <PaymentAmountField
            amount={amount}
            remainingBalance={Math.max(0, order.remainingAmount)}
            disabled={isPending}
            error={error}
            onAmountChange={onAmountChange}
            onSetMaxAmount={onSetMaxAmount}
            t={t}
          />
          {method === PaymentMethod.Cash && (
            <CashReceivedFields
              amount={amount}
              received={received}
              currency={order.currency}
              suggestions={cashSuggestions(order.remainingAmount)}
              disabled={isPending}
              onReceivedChange={onReceivedChange}
              onExact={onExactCash}
              onSuggestion={onCashSuggestion}
              t={t}
            />
          )}
        </div>
        <CashierNumericKeypad
          value={amount}
          disabled={isPending}
          onChange={onAmountChange}
          t={t}
          className={entry.keypad}
        />
      </div>
      <div className={entry.stack}>
        <PaymentMethodField method={method} disabled={isPending} onChange={onMethodChange} t={t} />
        <PaymentReferenceFields
          transactionId={transactionId}
          notes={notes}
          disabled={isPending}
          onTransactionIdChange={onTransactionChange}
          onNotesChange={onNotesChange}
          t={t}
        />
      </div>
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} onClick={onReturnToOrder} disabled={isPending}>
          {t('cashier.collection.return_order')}
        </button>
        <button type="submit" className={styles.submitButton} disabled={isPending || order.remainingAmount <= 0}>
          <CreditCard size={19} aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
