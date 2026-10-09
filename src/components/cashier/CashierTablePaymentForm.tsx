'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StaffButton from '@/components/design-system/StaffButton';
import TipSelector from '@/components/checkout/TipSelector';
import CashReceivedFields from './CashReceivedFields';
import CashierNumericKeypad from './CashierNumericKeypad';
import PaymentMethodField from './PaymentMethodField';
import PaymentReferenceFields from './PaymentReferenceFields';
import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { cashSuggestions } from '@/lib/cashierMoney';
import { inputFromMinor } from '@/lib/orderPaymentMoney';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { validateTableTenderDraft } from './tableTenderDraft';
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
  const { t, i18n } = useTranslation();
  const eligibleOutstanding = tableSessionEligibleOutstanding(session);
  const [amount, setAmount] = useState(() => eligibleOutstanding.toFixed(2));
  const [tip, setTip] = useState('');
  const [received, setReceived] = useState('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [tipValid, setTipValid] = useState(true);
  const [cashReceivedError, setCashReceivedError] = useState<string | null>(null);
  const { operationFor, resetOperation } = usePaymentOperationKey();
  const currency = tableSessionCurrency(session);
  const locale = i18n.language || 'en';
  const currencyUnknown = currency === null;
  const totalMinor =
    (parseCurrencyAmountMinor(amount, currency ?? '', locale) ?? 0) +
    (parseCurrencyAmountMinor(tip || '0', currency ?? '', locale) ?? 0);

  useEffect(() => {
    setAmount(eligibleOutstanding.toFixed(2));
    setReceived('');
    setTip('');
    setError(null);
    setTipError(null);
    setTipValid(true);
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
    setTipError(null);
    setCashReceivedError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currencyUnknown) {
      setError('cashier.tables.currency_unknown');
      setCashReceivedError(null);
      return;
    }
    if (!tipValid) {
      setTipError('cashier.table_bill.error.tip');
      return;
    }
    const draft = validateTableTenderDraft(amount, tip, received, method, currency ?? '', locale);
    if ('error' in draft) {
      if (draft.error === 'cashier.cash_received_too_low') setCashReceivedError(draft.error);
      else if (draft.error === 'cashier.table_bill.error.tip') setTipError(draft.error);
      else setError(draft.message ?? draft.error);
      if (draft.error !== 'cashier.table_bill.error.amount') setError(null);
      if (draft.error !== 'cashier.table_bill.error.tip') setTipError(null);
      if (draft.error !== 'cashier.cash_received_too_low') setCashReceivedError(null);
      return;
    }
    const { data, tipMinor } = draft;
    setError(null);
    setTipError(null);
    setTipValid(true);
    setCashReceivedError(null);
    try {
      await onSubmit({
        operationId: operationFor(),
        expectedVersion: session.version,
        paymentMethod: data.paymentMethod,
        amount: data.amount,
        tipMinor,
        ...(currency ? { currency } : {}),
        transactionId: transactionId.trim() || undefined,
        paymentNotes: notes.trim() || undefined,
      });
      // A completed tender starts a new payload. Do not carry terminal references or notes
      // into the next round, even if the parent keeps this form mounted for a partial bill.
      resetOperation();
      setMethod(PaymentMethod.Cash);
      setTip('');
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
              type="text"
              inputMode="decimal"
              className={`form-input ${styles.amount}`}
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
        <TipSelector
          key={session.serviceSessionId}
          subtotal={(parseCurrencyAmountMinor(amount, currency ?? '', locale) ?? 0) / 100}
          selectedTipAmount={(parseCurrencyAmountMinor(tip || '0', currency ?? '', locale) ?? 0) / 100}
          onTipChange={(value) => {
            setTip(inputFromMinor(Math.round(value * 100)));
            resetOperation();
            setError(null);
            setTipError(null);
            setCashReceivedError(null);
          }}
          onValidityChange={(valid) => {
            setTipValid(valid);
            setTipError(valid ? null : 'cashier.table_bill.error.tip');
          }}
          currency={currency ?? undefined}
          locale={locale}
          error={tipError ? t(tipError) : undefined}
          disabled={disabled || currencyUnknown}
        />
        <CashierNumericKeypad value={amount} disabled={disabled || currencyUnknown} onChange={updateAmount} t={t} />
        {method === PaymentMethod.Cash && (
          <CashReceivedFields
            amount={inputFromMinor(totalMinor)}
            received={received}
            currency={currency}
            suggestions={cashSuggestions(totalMinor / 100)}
            disabled={disabled || currencyUnknown}
            error={cashReceivedError ? t(cashReceivedError) : undefined}
            onReceivedChange={(value) => {
              setReceived(value);
              setError(null);
              setCashReceivedError(null);
            }}
            onExact={() => {
              setReceived(inputFromMinor(totalMinor));
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
            disabled={disabled || currencyUnknown || !tipValid || eligibleOutstanding <= 0}
          >
            {disabled ? t('cashier.tables.operation_checking') : t('cashier.tables.payment_submit')}
          </StaffButton>
        </div>
      </form>
    </section>
  );
}
