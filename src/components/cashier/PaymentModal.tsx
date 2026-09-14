'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import StatusBadge from '@/components/design-system/StatusBadge';
import { usePaymentOperationKey } from '@/hooks/cashier/usePaymentOperationKey';
import { usePaymentModalLifecycle } from '@/hooks/cashier/usePaymentModalLifecycle';
import { OrderDto, PaymentMethod } from '@/types/order';
import { paymentModalSchema } from './paymentModalSchema';
import styles from './PaymentModal.module.css';
import CashReceivedFields from './CashReceivedFields';
import PaymentAmountField from './PaymentAmountField';
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
  readonly isCheckingPayment?: boolean;
}

export interface PaymentModalData {
  operationId: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  paymentNotes?: string;
}

/** Cashier tender form. BaseModal owns focus and prevents dismissal while money is unresolved. */
export default function PaymentModal({
  order,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  isCheckingPayment = false,
}: PaymentModalProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [received, setReceived] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { operationFor, resetOperation } = usePaymentOperationKey();
  const { aliveRef, openRef } = usePaymentModalLifecycle(isOpen, order, resetOperation, setTransactionId);

  const remainingBalance = order?.remainingAmount || 0;
  const isPending = isLoading || isCheckingPayment;
  const updatePaymentField = useCallback(
    (setValue: (value: string) => void, value: string) => {
      setValue(value);
      resetOperation();
      setError(null);
    },
    [resetOperation],
  );
  const handleAmountChange = useCallback(
    (value: string) => {
      if (Number.isNaN(Number.parseFloat(value)) && value !== '') return;
      setAmount(value);
      if (method === PaymentMethod.Cash) setReceived(value);
      resetOperation();
      setError(null);
    },
    [method, resetOperation],
  );
  const handleSetMaxAmount = useCallback(() => {
    const value = remainingBalance.toFixed(2);
    setAmount(value);
    if (method === PaymentMethod.Cash) setReceived(value);
    resetOperation();
    setError(null);
  }, [method, remainingBalance, resetOperation]);
  const handleReceivedChange = useCallback((value: string) => setReceived(value), []);

  const handleConfirm = useCallback(async () => {
    if (isPending) return;
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
    try {
      await onConfirm({
        amount: paymentAmount,
        paymentMethod: method,
        transactionId: transactionId || undefined,
        paymentNotes: notes || undefined,
        operationId: operationFor(),
      });
      if (!aliveRef.current || !openRef.current) return;
      resetOperation();
      setAmount('');
      setMethod(PaymentMethod.Cash);
      setReceived('');
      setTransactionId(order?.orderNumber || order?.id || '');
      setNotes('');
      setError(null);
      onClose();
    } catch (error_) {
      if (!aliveRef.current || !openRef.current) return;
      setError(error_ instanceof Error ? error_.message : t('cashier.payment_failed') || 'Failed to add payment');
    }
  }, [
    amount,
    method,
    received,
    transactionId,
    notes,
    remainingBalance,
    order,
    onConfirm,
    onClose,
    operationFor,
    resetOperation,
    isPending,
    aliveRef,
    openRef,
    t,
  ]);

  if (!order) return null;
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cashier.add_payment') || 'Add Payment'}
      footer={
        <PaymentModalFooter
          amount={amount}
          method={method}
          pending={isPending}
          checking={isCheckingPayment}
          onCancel={onClose}
          onConfirm={handleConfirm}
          t={t}
        />
      }
      isPending={isPending}
    >
      {isCheckingPayment && (
        <output aria-label={t('cashier.payment_checking')} className={styles.checkingNotice}>
          <StatusBadge tone="info">{t('cashier.payment_checking')}</StatusBadge>
        </output>
      )}
      <PaymentOrderSummary order={order} remainingBalance={remainingBalance} t={t} />
      <PaymentAmountField
        amount={amount}
        remainingBalance={remainingBalance}
        disabled={isPending}
        error={error}
        onAmountChange={handleAmountChange}
        onSetMaxAmount={handleSetMaxAmount}
        t={t}
      />
      {method === PaymentMethod.Cash && (
        <CashReceivedFields
          amount={amount}
          received={received}
          disabled={isPending}
          onReceivedChange={handleReceivedChange}
          onExact={() => setReceived(amount)}
          t={t}
        />
      )}
      <PaymentMethodField
        method={method}
        disabled={isPending}
        onChange={(value) => updatePaymentField(setMethod, value)}
        t={t}
      />
      <PaymentReferenceFields
        transactionId={transactionId}
        notes={notes}
        disabled={isPending}
        onTransactionIdChange={(value) => updatePaymentField(setTransactionId, value)}
        onNotesChange={(value) => updatePaymentField(setNotes, value)}
        t={t}
      />
    </BaseModal>
  );
}
