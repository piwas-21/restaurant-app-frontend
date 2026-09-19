import type { FormEvent } from 'react';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import type { PendingPaymentOperation } from '@/lib/cashierPendingPayment';

export interface CashierCollectionPaymentOutcome {
  readonly applied: number;
  readonly change: number;
  readonly remaining: number;
}

export interface UseCashierCollectionFormOptions {
  readonly order: OrderDto;
  readonly isPending: boolean;
  readonly pendingPayment: PendingPaymentOperation | null | undefined;
  readonly recoveredPayment: CashierCollectionPaymentOutcome | null | undefined;
  readonly onSubmit: (payment: AddPaymentRequest) => Promise<OrderDto>;
  readonly t: (key: string) => string;
}

export interface CashierCollectionFormController {
  readonly amount: string;
  readonly received: string;
  readonly method: string;
  readonly transactionId: string;
  readonly notes: string;
  readonly error: string | null;
  readonly controlsDisabled: boolean;
  readonly lastPayment: CashierCollectionPaymentOutcome | null;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  readonly onAmountChange: (value: string) => void;
  readonly onReceivedChange: (value: string) => void;
  readonly onMethodChange: (value: string) => void;
  readonly onTransactionChange: (value: string) => void;
  readonly onNotesChange: (value: string) => void;
  readonly onSetMaxAmount: () => void;
  readonly onExactCash: () => void;
  readonly onCashSuggestion: (value: number) => void;
  readonly clearTransient: () => void;
  readonly resetOperation: () => void;
}
