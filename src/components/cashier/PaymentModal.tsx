'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';
import { OrderDto, PaymentMethod } from '@/types/order';
import { paymentModalSchema } from './paymentModalSchema';

import styles from './PaymentModal.module.css';

import CashReceivedFields from './CashReceivedFields';
import PaymentReferenceFields from './PaymentReferenceFields';
import PaymentOrderSummary from './PaymentOrderSummary';
import PaymentModalFooter from './PaymentModalFooter';
import PaymentMethodField from './PaymentMethodField';

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

export default function PaymentModal({ order, isOpen, onClose, onConfirm, isLoading = false }: PaymentModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [received, setReceived] = useState('');
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
        if (method === PaymentMethod.Cash) setReceived(value);
        resetOperation();
        setError(null);
      }
    },
    [method, resetOperation],
  );
  const handleSetMaxAmount = useCallback(() => {
    setAmount(remainingBalance.toFixed(2));
    if (method === PaymentMethod.Cash) setReceived(remainingBalance.toFixed(2));
    resetOperation();
    setError(null);
  }, [method, remainingBalance, resetOperation]);

  const handleConfirm = useCallback(async () => {
    const parsed = paymentModalSchema.safeParse({ amount, paymentMethod: method, cashReceived: received });
    if (!parsed.success) {
      const invalidField = parsed.error.issues[0]?.path[0];
      let validationMessage = t('cashier.payment_amount_required');
      if (invalidField === 'cashReceived') validationMessage = t('cashier.cash_received_too_low');
      else if (invalidField === 'paymentMethod') validationMessage = t('cashier.payment_method_required');
      setError(validationMessage);
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
      setReceived('');
      setTransactionId('');
      setNotes('');
      onClose();
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : t('cashier.payment_failed') || 'Failed to add payment');
    }
  }, [
    amount,
    method,
    received,
    transactionId,
    notes,
    remainingBalance,
    onConfirm,
    onClose,
    operationFor,
    resetOperation,
    t,
  ]);

  if (!order) return null;

  const footer = (
    <PaymentModalFooter
      amount={amount}
      method={method}
      pending={isLoading}
      onCancel={onClose}
      onConfirm={handleConfirm}
      t={t}
    />
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cashier.add_payment') || 'Add Payment'}
      footer={footer}
      isPending={isLoading}
    >
      <PaymentOrderSummary order={order} remainingBalance={remainingBalance} t={t} />

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
      {method === PaymentMethod.Cash && (
        <CashReceivedFields
          amount={amount}
          received={received}
          disabled={isLoading}
          onReceivedChange={setReceived}
          onExact={() => setReceived(amount)}
          t={t}
        />
      )}
      <PaymentMethodField method={method} disabled={isLoading} onChange={setMethod} t={t} />
      <PaymentReferenceFields
        transactionId={transactionId}
        notes={notes}
        disabled={isLoading}
        onTransactionIdChange={setTransactionId}
        onNotesChange={setNotes}
        t={t}
      />
    </BaseModal>
  );
}
