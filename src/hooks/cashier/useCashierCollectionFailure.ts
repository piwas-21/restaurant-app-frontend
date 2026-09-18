import { getOrderById, type AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { ApiError, getErrorMessage } from '@/utils/apiClient';
import {
  PaymentCheckFailedError,
  PaymentResultUnknownError,
  StalePaymentOutcomeError,
} from './useCashierCollectionOutcome';
import type { CashierPendingPaymentController } from './useCashierPendingPayment';

function isOrderVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'OrderVersionConflict';
}

interface PaymentFailureContext {
  readonly reason: unknown;
  readonly order: OrderDto;
  readonly payment: AddPaymentRequest;
  readonly isCurrent: () => boolean;
  readonly pending: CashierPendingPaymentController;
  readonly setError: (error: string | null) => void;
  readonly setOrder: (order: OrderDto) => void;
  readonly paymentRevisionRef: { current: number };
}

async function handleVersionConflict(context: PaymentFailureContext): Promise<never> {
  context.pending.markRefused(context.order.id, context.payment);
  try {
    const latest = await getOrderById(context.order.id);
    if (context.isCurrent()) {
      context.paymentRevisionRef.current += 1;
      context.setOrder(latest);
    }
  } catch (_error) {
    // Keep the server refusal visible when the refresh is unavailable.
  }
  if (context.isCurrent()) context.setError('cashier.collection.order_changed');
  throw new Error('cashier.collection.order_changed');
}

export async function handlePaymentFailure(context: PaymentFailureContext): Promise<never> {
  const { reason, order, payment, isCurrent, pending, setError } = context;
  if (reason instanceof StalePaymentOutcomeError || !isCurrent()) throw new StalePaymentOutcomeError();
  if (reason instanceof PaymentResultUnknownError) {
    pending.markUnknown(order.id, payment, reason.order);
  } else if (reason instanceof PaymentCheckFailedError) {
    pending.markUnavailable(order.id, payment);
  } else if (isOrderVersionConflict(reason)) {
    return handleVersionConflict(context);
  } else {
    pending.markRefused(order.id, payment);
    if (isCurrent()) setError(getErrorMessage(reason));
  }
  throw reason;
}
