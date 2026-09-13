'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import CashReceivedFields from './CashReceivedFields';
import CashierNumericKeypad from './CashierNumericKeypad';
import PaymentMethodField from './PaymentMethodField';
import PaymentReferenceFields from './PaymentReferenceFields';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { billTenderSchema } from '@/schemas/tableBill.schema';
import { cashSuggestions } from '@/lib/cashierMoney';
import { formatTableMoney, tableSessionCurrency, tableSessionEligibleOutstanding } from '@/lib/cashierTableSession';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';
import sessionStyles from './CashierTableSession.module.css';
import styles from './CashierTablePayment.module.css';

interface CashierTablePaymentFormProps {
  readonly session: TableServiceSessionDto;
  readonly disabled: boolean;
  readonly onSubmit: (payment: AddTableServiceSessionPaymentRequest) => Promise<void>;
}

export default function CashierTablePaymentForm({ session, disabled, onSubmit }: CashierTablePaymentFormProps) {
  const { t } = useTranslation();
  const eligibleOutstanding = tableSessionEligibleOutstanding(session);
  const [amount, setAmount] = useState(() => eligibleOutstanding.toFixed(2));
  const [received, setReceived] = useState('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cashReceivedError, setCashReceivedError] = useState<string | null>(null);
  const { operationFor, resetOperation } = usePaymentOperationKey();
  const currency = tableSessionCurrency(session);
  const currencyUnknown = currency === null;

  useEffect(() => {
    setAmount(eligibleOutstanding.toFixed(2));
    setReceived('');
    setError(null);
    setCashReceivedError(null);
    resetOperation();
  }, [
    resetOperation,
    session.serviceSessionId,
    session.version,
    eligibleOutstanding,
    session.currency,
    session.bill.currency,
  ]);

  const updateAmount = (value: string) => {
    setAmount(value);
    resetOperation();
    setError(null);
    setCashReceivedError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currencyUnknown) {
      setError('cashier.tables.currency_unknown');
      setCashReceivedError(null);
      return;
    }
    const parsed = billTenderSchema.safeParse({
      amount,
      paymentMethod: method,
      cashReceived: method === PaymentMethod.Cash ? received : undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'cashReceived') {
        setCashReceivedError('cashier.cash_received_too_low');
        setError(null);
      } else {
        setError(issue?.message ?? 'cashier.table_bill.error.amount');
        setCashReceivedError(null);
      }
      return;
    }
    setError(null);
    setCashReceivedError(null);
    try {
      await onSubmit({
        operationId: operationFor(),
        expectedVersion: session.version,
        paymentMethod: parsed.data.paymentMethod,
        amount: parsed.data.amount,
        ...(currency ? { currency } : {}),
        transactionId: transactionId.trim() || undefined,
        paymentNotes: notes.trim() || undefined,
      });
      // A completed tender starts a new payload. Do not carry terminal references or notes
      // into the next round, even if the parent keeps this form mounted for a partial bill.
      resetOperation();
      setMethod(PaymentMethod.Cash);
      setTransactionId('');
      setNotes('');
    } catch (_error) {
      // The session hook owns the authoritative refusal/unknown-operation message.
    }
  };

  return (
    <section className={styles.payment} aria-labelledby="cashier-table-payment-title">
      <h3 id="cashier-table-payment-title">{t('cashier.tables.payment_title')}</h3>
      <p className={sessionStyles.muted}>
        {currency ? t('cashier.tables.payment_currency', { currency }) : t('cashier.tables.currency_unknown')} ·{' '}
        {formatTableMoney(eligibleOutstanding, session) ?? t('cashier.tables.currency_unknown')}
      </p>
      {currencyUnknown && (
        <p className={sessionStyles.warning} role="alert">
          {t('cashier.tables.currency_unknown')}
        </p>
      )}
      <form className={styles.paymentForm} onSubmit={submit} noValidate>
        <div className={styles.paymentGrid}>
          <FormField label={t('cashier.payment_amount')} error={error ? t(error) : undefined}>
            <input
              type="number"
              className={`form-input ${styles.amount}`}
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => updateAmount(event.target.value)}
              disabled={disabled || currencyUnknown}
            />
          </FormField>
          <PaymentMethodField
            method={method}
            disabled={disabled || currencyUnknown}
            onChange={(value) => {
              setMethod(value);
              resetOperation();
              setError(null);
              setCashReceivedError(null);
            }}
            t={t}
          />
        </div>
        <CashierNumericKeypad value={amount} disabled={disabled || currencyUnknown} onChange={updateAmount} t={t} />
        {method === PaymentMethod.Cash && (
          <CashReceivedFields
            amount={amount}
            received={received}
            currency={currency}
            suggestions={cashSuggestions(Number.parseFloat(amount) || 0)}
            disabled={disabled || currencyUnknown}
            error={cashReceivedError ? t(cashReceivedError) : undefined}
            onReceivedChange={(value) => {
              setReceived(value);
              setError(null);
              setCashReceivedError(null);
            }}
            onExact={() => {
              setReceived(amount);
              setError(null);
              setCashReceivedError(null);
            }}
            onSuggestion={(value) => {
              setReceived(value.toFixed(2));
              setError(null);
              setCashReceivedError(null);
            }}
            t={t}
          />
        )}
        <PaymentReferenceFields
          transactionId={transactionId}
          notes={notes}
          disabled={disabled || currencyUnknown}
          onTransactionIdChange={(value) => {
            setTransactionId(value);
            resetOperation();
            setError(null);
          }}
          onNotesChange={(value) => {
            setNotes(value);
            resetOperation();
            setError(null);
          }}
          t={t}
        />
        <div className={sessionStyles.formActions}>
          <StaffButton
            variant="primary"
            className={sessionStyles.primaryButton}
            type="submit"
            disabled={disabled || currencyUnknown || eligibleOutstanding <= 0}
          >
            {disabled ? t('cashier.tables.operation_checking') : t('cashier.tables.payment_submit')}
          </StaffButton>
        </div>
      </form>
    </section>
  );
}
