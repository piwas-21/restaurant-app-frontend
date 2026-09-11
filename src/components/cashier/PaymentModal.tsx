'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';
import { OrderDto, PaymentMethod } from '@/types/order';
import { paymentModalSchema } from './paymentModalSchema';
import styles from './PaymentModal.module.css';

interface PaymentModalProps {
  readonly order: OrderDto | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (paymentData: PaymentModalData) => Promise<void>;
  readonly isLoading?: boolean;
}

export interface PaymentModalData {
  operationId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  paymentNotes?: string;
}

/** Cashier tender form. BaseModal owns focus and prevents dismissal while money is unresolved. */
export default function PaymentModal({ order, isOpen, onClose, onConfirm, isLoading = false }: PaymentModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { operationFor, resetOperation } = usePaymentOperationKey();

  useEffect(() => {
    if (isOpen && order) setTransactionId(order.orderNumber || order.id || '');
  }, [isOpen, order]);

  const remainingBalance = order?.remainingAmount || 0;
  const handleAmountChange = useCallback(
    (value: string) => {
      if (!Number.isNaN(Number.parseFloat(value)) || value === '') {
        setAmount(value);
        resetOperation();
        setError(null);
      }
    },
    [resetOperation],
  );
  const handleSetMaxAmount = useCallback(() => {
    setAmount(remainingBalance.toFixed(2));
    resetOperation();
    setError(null);
  }, [remainingBalance, resetOperation]);

  const handleConfirm = useCallback(async () => {
    const parsed = paymentModalSchema.safeParse({ amount, paymentMethod: method });
    if (!parsed.success) {
      const methodInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'paymentMethod');
      setError(
        methodInvalid
          ? t('cashier.payment_method_required') || 'Please select a payment method'
          : t('cashier.payment_amount_required') || 'Please enter a valid payment amount',
      );
      return;
    }
    const paymentAmount = parsed.data.amount;
    if (paymentAmount > remainingBalance) {
      setError(t('cashier.payment_exceeds_balance') || `Payment amount cannot exceed ${remainingBalance.toFixed(2)}`);
      return;
    }
    const tender = {
      amount: paymentAmount,
      paymentMethod: method,
      transactionId: transactionId || undefined,
      paymentNotes: notes || undefined,
    };
    try {
      await onConfirm({ ...tender, operationId: operationFor() });
      resetOperation();
      setAmount('');
      setMethod(PaymentMethod.Cash);
      setTransactionId('');
      setNotes('');
      onClose();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : t('cashier.payment_failed') || 'Failed to add payment');
    }
  }, [amount, method, transactionId, notes, remainingBalance, onConfirm, onClose, operationFor, resetOperation, t]);

  if (!order) return null;
  let confirmLabel = t('cashier.add_payment') || 'Add Payment';
  if (isLoading) confirmLabel = t('common.loading') || 'Loading...';
  else if (method !== PaymentMethod.Cash) confirmLabel = t('cashier.record_card_payment');

  const footer = (
    <>
      <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isLoading}>
        {t('common.cancel') || 'Cancel'}
      </button>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={handleConfirm}
        disabled={!amount || !method || isLoading}
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cashier.add_payment') || 'Add Payment'}
      footer={footer}
      isPending={isLoading}
    >
      <h3 className={styles.summaryTitle}>{t('cashier.order_summary')}</h3>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.total') || 'Total'}</span>
          <span className={styles.summaryValue}>{(order.total || 0).toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.total_paid') || 'Total Paid'}</span>
          <span className={styles.summaryValue}>{(order.totalPaid || 0).toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{t('cashier.remaining') || 'Remaining'}</span>
          <span className={styles.summaryValue}>{remainingBalance.toFixed(2)}</span>
        </div>
      </div>
      <FormField label={`${t('cashier.payment_amount') || 'Payment Amount'} *`} error={error ?? undefined}>
        <input
          type="number"
          className={styles.input}
          placeholder="0.00"
          value={amount}
          onChange={(event) => handleAmountChange(event.target.value)}
          disabled={isLoading}
          min="0"
          step="0.01"
          max={remainingBalance}
        />
      </FormField>
      <button
        type="button"
        className={styles.maxButton}
        onClick={handleSetMaxAmount}
        disabled={isLoading}
        title={t('cashier.use_remaining')}
      >
        {t('cashier.max') || 'Max'}
      </button>
      <FormField label={`${t('cashier.payment_method') || 'Payment Method'} *`}>
        <select
          className={styles.select}
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          disabled={isLoading}
        >
          <option value={PaymentMethod.Cash}>{t('cashier.table_bill.method_cash')}</option>
          <option value={PaymentMethod.CreditCard}>{t('cashier.table_bill.method_credit_card')}</option>
          <option value={PaymentMethod.DebitCard}>{t('cashier.table_bill.method_debit_card')}</option>
        </select>
      </FormField>
      {method !== PaymentMethod.Cash && (
        <p role="note" className={styles.cardNotice}>
          {t('cashier.standalone_card_instruction')}
        </p>
      )}
      <FormField label={t('cashier.transaction_id') || 'Transaction ID (optional)'}>
        <input
          type="text"
          className={styles.input}
          placeholder={t('cashier.transaction_id_placeholder')}
          value={transactionId}
          onChange={(event) => setTransactionId(event.target.value)}
          disabled={isLoading}
        />
      </FormField>
      <FormField label={t('cashier.notes') || 'Notes (optional)'}>
        <textarea
          className={styles.textarea}
          placeholder={t('cashier.payment_notes_placeholder')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isLoading}
          rows={3}
        />
      </FormField>
    </BaseModal>
  );
}
