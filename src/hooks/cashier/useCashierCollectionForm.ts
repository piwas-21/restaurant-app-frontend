import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { usePaymentOperationKey } from './usePaymentOperationKey';
import {
  PaymentCheckFailedError,
  PaymentResultUnknownError,
  StalePaymentOutcomeError,
} from './useCashierCollectionOutcome';
import { paymentModalSchema } from '@/components/cashier/paymentModalSchema';
import type {
  CashierCollectionFormController,
  CashierCollectionPaymentOutcome,
  UseCashierCollectionFormOptions,
} from './useCashierCollectionForm.types';

const initialAmount = (order: OrderDto): string => (order.remainingAmount > 0 ? order.remainingAmount.toFixed(2) : '');

function errorText(error: unknown, t: (key: string) => string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('cashier.')) return t(message);
  return message || t('cashier.payment_failed');
}

export function useCashierCollectionForm({
  order,
  isPending,
  pendingPayment,
  recoveredPayment,
  onSubmit,
  t,
}: UseCashierCollectionFormOptions): CashierCollectionFormController {
  const [amount, setAmount] = useState(() => initialAmount(order));
  const [method, setMethod] = useState<string>(PaymentMethod.Cash);
  const [received, setReceived] = useState(() => initialAmount(order));
  // Prefilled with the order id (pilot feedback): a recorded card tender then carries a
  // meaningful reference by default, and the cashier can still overwrite or clear it.
  const [transactionId, setTransactionId] = useState(() => order.id);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<CashierCollectionPaymentOutcome | null>(recoveredPayment ?? null);
  const orderIdRef = useRef(order.id);
  const { operationFor, resetOperation } = usePaymentOperationKey(pendingPayment?.operationId);
  const pendingBlocksForm = pendingPayment != null && pendingPayment.status !== 'Refused';
  const controlsDisabled = isPending || pendingBlocksForm;

  useEffect(() => {
    if (recoveredPayment) setLastPayment(recoveredPayment);
  }, [recoveredPayment]);
  useEffect(() => {
    if (orderIdRef.current === order.id) return;
    orderIdRef.current = order.id;
    const nextAmount = initialAmount(order);
    setAmount(nextAmount);
    setReceived(nextAmount);
    setMethod(PaymentMethod.Cash);
    setTransactionId(order.id);
    setNotes('');
    setError(null);
    setLastPayment(null);
    resetOperation();
  }, [order, resetOperation]);

  const clearTransient = useCallback(() => {
    resetOperation();
    setError(null);
    setLastPayment(null);
  }, [resetOperation]);
  const handleAmountChange = useCallback(
    (value: string) => {
      if (Number.isNaN(Number.parseFloat(value)) && value !== '') return;
      setAmount(value);
      if (method === PaymentMethod.Cash) setReceived(value);
      clearTransient();
    },
    [clearTransient, method],
  );
  const handleReceivedChange = useCallback((value: string) => setReceived(value), []);
  const handleCashSuggestion = useCallback((value: number) => {
    setReceived(value.toFixed(2));
    setError(null);
  }, []);
  const handleSetAmount = useCallback((value: number) => handleAmountChange(value.toFixed(2)), [handleAmountChange]);
  const handleMethodChange = useCallback(
    (value: string) => {
      setMethod(value);
      clearTransient();
    },
    [clearTransient],
  );
  const handleTransactionChange = useCallback(
    (value: string) => {
      setTransactionId(value);
      clearTransient();
    },
    [clearTransient],
  );
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      clearTransient();
    },
    [clearTransient],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (controlsDisabled || !canCollectPayment(order)) return;
      const parsed = paymentModalSchema.safeParse({ amount, paymentMethod: method, cashReceived: received });
      if (!parsed.success) {
        const invalidField = parsed.error.issues[0]?.path[0];
        setError(
          invalidField === 'cashReceived' ? t('cashier.cash_received_too_low') : t('cashier.payment_amount_required'),
        );
        return;
      }
      if (parsed.data.amount > order.remainingAmount) {
        setError(t('cashier.payment_exceeds_balance'));
        return;
      }
      setError(null);
      const applied = parsed.data.amount;
      const cashReceived = Number.parseFloat(received) || 0;
      try {
        const updated = await onSubmit({
          operationId: operationFor(),
          expectedVersion: order.version,
          amount: applied,
          paymentMethod: method,
          transactionId: transactionId.trim() || undefined,
          paymentNotes: notes.trim() || undefined,
        });
        setLastPayment({
          applied,
          change: method === PaymentMethod.Cash ? Math.max(0, cashReceived - applied) : 0,
          remaining: updated.remainingAmount,
        });
        setAmount(initialAmount(updated));
        setReceived(initialAmount(updated));
        setMethod(PaymentMethod.Cash);
        setTransactionId(updated.id);
        setNotes('');
        setError(null);
        resetOperation();
      } catch (reason: unknown) {
        if (reason instanceof StalePaymentOutcomeError) return;
        if (!(reason instanceof PaymentResultUnknownError) && !(reason instanceof PaymentCheckFailedError))
          resetOperation();
        setError(errorText(reason, t));
      }
    },
    [
      amount,
      controlsDisabled,
      method,
      notes,
      onSubmit,
      operationFor,
      order,
      received,
      resetOperation,
      t,
      transactionId,
    ],
  );

  return {
    amount,
    received,
    method,
    transactionId,
    notes,
    error,
    controlsDisabled,
    lastPayment,
    onSubmit: handleSubmit,
    onAmountChange: handleAmountChange,
    onReceivedChange: handleReceivedChange,
    onMethodChange: handleMethodChange,
    onTransactionChange: handleTransactionChange,
    onNotesChange: handleNotesChange,
    onSetMaxAmount: () => handleSetAmount(Math.max(0, order.remainingAmount)),
    onExactCash: () => setReceived(amount),
    onCashSuggestion: handleCashSuggestion,
    clearTransient,
    resetOperation,
  };
}
