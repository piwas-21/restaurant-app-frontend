import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import type { OrderDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import { canCollectPayment } from '@/lib/settlementEligibility';
import { parseAccountContributionMinor } from '@/lib/accountPaymentMoney';
import { amountFromMinor, inputFromMinor, orderTenderTotalMinor, parseOrderTipMinor } from '@/lib/orderPaymentMoney';
import { orderCurrency } from '@/lib/cashierMoney';
import { paymentModalSchema } from '@/components/cashier/paymentModalSchema';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { CashierCollectionPaymentOutcome } from './useCashierCollectionForm.types';
import {
  PaymentCheckFailedError,
  PaymentResultUnknownError,
  StalePaymentOutcomeError,
} from './useCashierCollectionOutcome';

type PaymentDraftResult =
  | { readonly errorKey: string }
  | { readonly amountMinor: number; readonly tipMinor: number; readonly cashReceivedMinor: number | undefined };

interface UseCashierCollectionSubmitOptions {
  readonly order: OrderDto;
  readonly controlsDisabled: boolean;
  readonly amount: string;
  readonly tip: string;
  readonly method: string;
  readonly received: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly onSubmit: (payment: AddPaymentRequest) => Promise<OrderDto>;
  readonly operationFor: () => string;
  readonly resetOperation: () => void;
  readonly t: (key: string) => string;
  readonly setAmount: Dispatch<SetStateAction<string>>;
  readonly setTip: Dispatch<SetStateAction<string>>;
  readonly setReceived: Dispatch<SetStateAction<string>>;
  readonly setMethod: Dispatch<SetStateAction<string>>;
  readonly setTransactionId: Dispatch<SetStateAction<string>>;
  readonly setNotes: Dispatch<SetStateAction<string>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
  readonly setLastPayment: Dispatch<SetStateAction<CashierCollectionPaymentOutcome | null>>;
}

function validatePaymentDraft(
  amount: string,
  tip: string,
  method: string,
  received: string,
  order: OrderDto,
): PaymentDraftResult {
  const currency = orderCurrency(order);
  const amountMinor = parseAccountContributionMinor(amount, currency);
  const tipMinor = parseOrderTipMinor(tip, currency);
  const cashReceivedMinor =
    method === PaymentMethod.Cash ? parseAccountContributionMinor(received, currency) : undefined;
  if (amountMinor === null || tipMinor === null || (method === PaymentMethod.Cash && cashReceivedMinor === null)) {
    return { errorKey: 'cashier.payment_amount_required' };
  }

  const parsed = paymentModalSchema.safeParse({
    amount,
    amountMinor,
    tipMinor,
    paymentMethod: method,
    cashReceivedMinor,
  });
  if (!parsed.success) {
    const invalidField = parsed.error.issues[0]?.path[0];
    return {
      errorKey:
        invalidField === 'cashReceivedMinor' ? 'cashier.cash_received_too_low' : 'cashier.payment_amount_required',
    };
  }

  const orderBalanceMinor = parseAccountContributionMinor(Math.max(0, order.remainingAmount).toFixed(2), currency);
  if (orderBalanceMinor === null || amountMinor > orderBalanceMinor) {
    return { errorKey: 'cashier.payment_exceeds_balance' };
  }

  return { amountMinor, tipMinor, cashReceivedMinor: cashReceivedMinor ?? undefined };
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
  method,
  received,
  transactionId,
  notes,
  onSubmit,
  operationFor,
  resetOperation,
  t,
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
      const currency = orderCurrency(order);
      const draft = validatePaymentDraft(amount, tip, method, received, order);
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
        const updated = await onSubmit({
          operationId: operationFor(),
          expectedVersion: order.version,
          amount: applied,
          ...(tipMinor > 0 ? { tipMinor } : {}),
          paymentMethod: method,
          transactionId: transactionId.trim() || undefined,
          paymentNotes: notes.trim() || undefined,
        });
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
      transactionId,
    ],
  );
}
