import { addPaymentToOrder, type AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { isPaymentOutcomeUnknown, type PaymentReconciliationResult } from './usePaymentReconciliation';

export type ReconcilePayment = (orderId: string, operationId: string) => Promise<PaymentReconciliationResult>;

export class StalePaymentOutcomeError extends Error {
  constructor() {
    super('cashier.payment_outcome_stale');
    this.name = 'StalePaymentOutcomeError';
  }
}

export class PaymentResultUnknownError extends Error {
  readonly order: OrderDto | null;

  constructor(order: OrderDto | null) {
    super('cashier.payment_result_unknown');
    this.name = 'PaymentResultUnknownError';
    this.order = order;
  }
}

export class PaymentCheckFailedError extends Error {
  constructor() {
    super('cashier.payment_check_failed');
    this.name = 'PaymentCheckFailedError';
  }
}

export async function submitPaymentOutcome(
  order: OrderDto,
  payment: AddPaymentRequest,
  reconcilePayment: ReconcilePayment,
  isCurrent: () => boolean,
): Promise<OrderDto> {
  try {
    const updated = await addPaymentToOrder(order.id, payment);
    if (!isCurrent()) throw new StalePaymentOutcomeError();
    return updated;
  } catch (reason: unknown) {
    if (reason instanceof StalePaymentOutcomeError) throw reason;
    if (!isCurrent()) throw new StalePaymentOutcomeError();
    if (!isPaymentOutcomeUnknown(reason)) throw reason;

    const result = await reconcilePayment(order.id, payment.operationId);
    if (!isCurrent() || result.status === 'Stale') throw new StalePaymentOutcomeError();
    if (result.status === 'Committed') return result.order;
    if (result.status === 'Unknown') throw new PaymentResultUnknownError(result.order);
    throw new PaymentCheckFailedError();
  }
}
