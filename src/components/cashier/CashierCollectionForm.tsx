import type { FormEvent } from 'react';
import { CreditCard } from 'lucide-react';
import { cashSuggestions, formatOrderCurrency, orderCurrency } from '@/lib/cashierMoney';
import { amountFromMinor, inputFromMinor, orderTenderTotalMinor } from '@/lib/orderPaymentMoney';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import TipSelector from '@/components/checkout/TipSelector';
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
  readonly tip: string;
  readonly tipValid: boolean;
  readonly received: string;
  readonly method: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly isBusy: boolean;
  readonly isCheckingPayment: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  readonly onAmountChange: (value: string) => void;
  readonly onTipChange: (value: string) => void;
  readonly onTipValidityChange: (valid: boolean) => void;
  readonly onReceivedChange: (value: string) => void;
  readonly onMethodChange: (value: string) => void;
  readonly onTransactionChange: (value: string) => void;
  readonly onNotesChange: (value: string) => void;
  readonly onSetMaxAmount: () => void;
  readonly onExactCash: () => void;
  readonly onCashSuggestion: (value: number) => void;
  readonly locale: string;
  readonly t: (key: string) => string;
  readonly onReturnToOrder: () => void;
}

export default function CashierCollectionForm({
  order,
  amount,
  tip,
  tipValid,
  received,
  method,
  transactionId,
  notes,
  error,
  isPending,
  isBusy,
  isCheckingPayment,
  onSubmit,
  onAmountChange,
  onTipChange,
  onTipValidityChange,
  onReceivedChange,
  onMethodChange,
  onTransactionChange,
  onNotesChange,
  onSetMaxAmount,
  onExactCash,
  onCashSuggestion,
  locale,
  t,
  onReturnToOrder,
}: CashierCollectionFormProps) {
  const currency = orderCurrency(order);
  const totalMinor = orderTenderTotalMinor(amount, tip, currency, locale) ?? 0;
  const tenderTotal = amountFromMinor(totalMinor);
  let submitLabel = method === PaymentMethod.Cash ? t('cashier.add_payment') : t('cashier.record_card_payment');
  if (isCheckingPayment) submitLabel = t('cashier.payment_checking');
  else if (isBusy) submitLabel = t('common.loading');

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={entry.entryGrid}>
        <div className={entry.entryFields}>
          <PaymentAmountField
            amount={amount}
            disabled={isPending}
            error={error}
            onAmountChange={onAmountChange}
            onSetMaxAmount={onSetMaxAmount}
            t={t}
          />
          <small>{t('cashier.collection.staff_tip_description')}</small>
          <TipSelector
            key={order.id}
            subtotal={(parseCurrencyAmountMinor(amount, currency, locale) ?? 0) / 100}
            selectedTipAmount={(parseCurrencyAmountMinor(tip || '0', currency, locale) ?? 0) / 100}
            onTipChange={(value) => onTipChange(inputFromMinor(Math.round(value * 100)))}
            onValidityChange={onTipValidityChange}
            disabled={isPending}
            currency={currency}
            locale={locale}
          />
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
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isPending || !tipValid || order.remainingAmount <= 0}
        >
          <CreditCard size={19} aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
