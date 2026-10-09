import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { amountFromMinor, inputFromMinor, orderTenderTotalMinor } from '@/lib/orderPaymentMoney';
import { orderCurrency } from '@/lib/cashierMoney';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { CashierCollectionPaymentOutcome } from './useCashierCollectionForm.types';
import { validatePaymentDraft } from './validateCashierCollectionDraft';
import {
  PaymentCheckFailedError,
  PaymentResultUnknownError,
  StalePaymentOutcomeError,
} from './useCashierCollectionOutcome';

interface UseCashierCollectionSubmitOptions {
  readonly order: OrderDto;
  readonly controlsDisabled: boolean;
  readonly amount: string;
  readonly tip: string;
  readonly tipValid: boolean;
  readonly method: string;
  readonly received: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly onSubmit: (payment: AddPaymentRequest, cashReceivedMinor?: number) => Promise<OrderDto>;
  readonly operationFor: () => string;
  readonly resetOperation: () => void;
  readonly t: (key: string) => string;
  readonly locale: string;
  readonly setAmount: Dispatch<SetStateAction<string>>;
  readonly setTip: Dispatch<SetStateAction<string>>;
  readonly setReceived: Dispatch<SetStateAction<string>>;
  readonly setMethod: Dispatch<SetStateAction<string>>;
  readonly setTransactionId: Dispatch<SetStateAction<string>>;
  readonly setNotes: Dispatch<SetStateAction<string>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly setLastPayment: Dispatch<SetStateAction<CashierCollectionPaymentOutcome | null>>;
}

function errorText(error: unknown, t: (key: string) => string): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('cashier.')) return t(message);
  return message || t('cashier.payment_failed');
}

export function useCashierCollectionSubmit({
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
}: UseCashierCollectionSubmitOptions) {
  return useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (controlsDisabled || !canCollectPayment(order)) return;
      if (!tipValid) {
        setError(t('cashier.table_bill.error.tip'));
        return;
      }
      const currency = orderCurrency(order);
      const draft = validatePaymentDraft(amount, tip, method, received, order, locale);
      if ('errorKey' in draft) {
        setError(t(draft.errorKey));
        return;
      }
      const { amountMinor, tipMinor, cashReceivedMinor } = draft;
      setError(null);
      const applied = amountFromMinor(amountMinor);
      const tipAmount = amountFromMinor(tipMinor);
      const tenderTotal = amountFromMinor(amountMinor + tipMinor);
      try {
        const updated = await onSubmit(
          {
            operationId: operationFor(),
            expectedVersion: order.version,
            amount: applied,
            ...(tipMinor > 0 ? { tipMinor } : {}),
            paymentMethod: method,
            transactionId: transactionId.trim() || undefined,
            paymentNotes: notes.trim() || undefined,
          },
          method === PaymentMethod.Cash ? cashReceivedMinor : undefined,
        );
        setLastPayment({
          applied,
          tip: tipAmount,
          tenderTotal,
          change:
            method === PaymentMethod.Cash
              ? amountFromMinor(Math.max(0, (cashReceivedMinor ?? 0) - amountMinor - tipMinor))
              : 0,
          remaining: updated.remainingAmount,
        });
        setAmount(updated.remainingAmount > 0 ? updated.remainingAmount.toFixed(2) : '');
        setTip('0.00');
        setReceived(
          inputFromMinor(
            orderTenderTotalMinor(
              updated.remainingAmount > 0 ? updated.remainingAmount.toFixed(2) : '',
              '0.00',
              currency,
              locale,
            ) ?? 0,
          ),
        );
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
      locale,
      received,
      resetOperation,
      setAmount,
      setError,
      setLastPayment,
      setMethod,
      setNotes,
      setReceived,
      setTip,
      setTransactionId,
      t,
      tip,
      tipValid,
      transactionId,
    ],
  );
}
