import type { FormEvent } from 'react';
import { CreditCard } from 'lucide-react';
import { cashSuggestions, formatOrderCurrency, orderCurrency } from '@/lib/cashierMoney';
import { amountFromMinor, inputFromMinor, orderTenderTotalMinor } from '@/lib/orderPaymentMoney';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import FormField from '@/components/design-system/FormField';
import CashReceivedFields from './CashReceivedFields';
import CashierNumericKeypad from './CashierNumericKeypad';
import PaymentAmountField from './PaymentAmountField';
import PaymentMethodField from './PaymentMethodField';
import PaymentReferenceFields from './PaymentReferenceFields';
import styles from './CashierCollection.module.css';
import entry from './CashierCollectionEntry.module.css';
import fields from './PaymentModal.module.css';

interface CashierCollectionFormProps {
  readonly order: OrderDto;
  readonly amount: string;
  readonly tip: string;
  readonly received: string;
  readonly method: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly isCheckingPayment: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  readonly onAmountChange: (value: string) => void;
  readonly onTipChange: (value: string) => void;
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
  tip,
  received,
  method,
  transactionId,
  notes,
  error,
  isPending,
  isCheckingPayment,
  onSubmit,
  onAmountChange,
  onTipChange,
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
  const currency = orderCurrency(order);
  const totalMinor = orderTenderTotalMinor(amount, tip, currency) ?? 0;
  const tenderTotal = amountFromMinor(totalMinor);
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
          <FormField label={t('cashier.collection.staff_tip')}>
            <input
              type="number"
              className={fields.input}
              min="0"
              step="0.01"
              value={tip}
              onChange={(event) => onTipChange(event.target.value)}
              disabled={isPending}
            />
          </FormField>
          <small>{t('cashier.collection.staff_tip_description')}</small>
          <output aria-live="polite">
            {t('cashier.collection.total_to_collect')}: {formatOrderCurrency(tenderTotal, order)}
          </output>
          {method === PaymentMethod.Cash && (
            <CashReceivedFields
              amount={inputFromMinor(totalMinor)}
              received={received}
              currency={currency}
              suggestions={cashSuggestions(tenderTotal)}
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
