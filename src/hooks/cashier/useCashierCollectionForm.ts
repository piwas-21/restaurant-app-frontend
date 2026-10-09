import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { inputFromMinor, orderTenderTotalMinor } from '@/lib/orderPaymentMoney';
import { orderCurrency } from '@/lib/cashierMoney';
import { usePaymentOperationKey } from './usePaymentOperationKey';
import { useCashierCollectionSubmit } from './useCashierCollectionSubmit';
import type {
  CashierCollectionFormController,
  CashierCollectionPaymentOutcome,
  UseCashierCollectionFormOptions,
} from './useCashierCollectionForm.types';

const initialAmount = (order: OrderDto): string => (order.remainingAmount > 0 ? order.remainingAmount.toFixed(2) : '');
const initialTip = '0.00';

export function useCashierCollectionForm({
  order,
  isPending,
  pendingPayment,
  recoveredPayment,
  onSubmit,
  locale,
  t,
}: UseCashierCollectionFormOptions): CashierCollectionFormController {
  const [amount, setAmount] = useState(() => initialAmount(order));
  const [tip, setTip] = useState(initialTip);
  const [tipValid, setTipValid] = useState(true);
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
    setTip(initialTip);
    setTipValid(true);
    setReceived(inputFromMinor(orderTenderTotalMinor(nextAmount, initialTip, orderCurrency(order), locale) ?? 0));
    setMethod(PaymentMethod.Cash);
    setTransactionId(order.id);
    setNotes('');
    setError(null);
    setLastPayment(null);
    resetOperation();
  }, [locale, order, resetOperation]);

  const clearTransient = useCallback(() => {
    resetOperation();
    setError(null);
    setLastPayment(null);
  }, [resetOperation]);
  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(value);
      if (method === PaymentMethod.Cash)
        setReceived(inputFromMinor(orderTenderTotalMinor(value, tip, orderCurrency(order), locale) ?? 0));
      clearTransient();
    },
    [clearTransient, locale, method, order, tip],
  );
  const handleTipChange = useCallback(
    (value: string) => {
      setTip(value);
      if (method === PaymentMethod.Cash)
        setReceived(inputFromMinor(orderTenderTotalMinor(amount, value, orderCurrency(order), locale) ?? 0));
      clearTransient();
    },
    [amount, clearTransient, locale, method, order],
  );
  const handleTipValidityChange = useCallback(
    (valid: boolean) => {
      setTipValid(valid);
      if (!valid) setError(t('cashier.table_bill.error.tip'));
      else setError(null);
    },
    [t],
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
      if (value === PaymentMethod.Cash) {
        setReceived(inputFromMinor(orderTenderTotalMinor(amount, tip, orderCurrency(order), locale) ?? 0));
      }
      clearTransient();
    },
    [amount, clearTransient, locale, order, tip],
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

  const handleSubmit = useCashierCollectionSubmit({
    order,
    controlsDisabled,
    amount,
    tip,
    tipValid,
    method,
    received,
    transactionId,
    notes,
    onSubmit,
    operationFor,
    resetOperation,
    t,
    locale,
    setAmount,
    setTip,
    setReceived,
    setMethod,
    setTransactionId,
    setNotes,
    setError,
    setLastPayment,
  });

  return {
    amount,
    tip,
    tipValid,
    received,
    method,
    transactionId,
    notes,
    error,
    controlsDisabled,
    lastPayment,
    onSubmit: handleSubmit,
    onAmountChange: handleAmountChange,
    onTipChange: handleTipChange,
    onTipValidityChange: handleTipValidityChange,
    onReceivedChange: handleReceivedChange,
    onMethodChange: handleMethodChange,
    onTransactionChange: handleTransactionChange,
    onNotesChange: handleNotesChange,
    onSetMaxAmount: () => handleSetAmount(Math.max(0, order.remainingAmount)),
    onExactCash: () =>
      setReceived(inputFromMinor(orderTenderTotalMinor(amount, tip, orderCurrency(order), locale) ?? 0)),
    onCashSuggestion: handleCashSuggestion,
    clearTransient,
    resetOperation,
  };
}
