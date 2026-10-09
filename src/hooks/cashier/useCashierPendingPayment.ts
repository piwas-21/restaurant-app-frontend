import { useCallback, useState, type MutableRefObject } from 'react';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import {
  clearPendingPayment,
  persistPendingPayment,
  readPendingPaymentState,
  type PendingPaymentOperation,
  withPendingPaymentStatus,
} from '@/lib/cashierPendingPayment';
import type { ReconcilePayment } from './useCashierCollectionOutcome';
import { paymentRecoveryErrorFor, useCashierPendingPaymentRecovery } from './useCashierPendingPaymentRecovery';

interface UseCashierPendingPaymentOptions {
  readonly orderId: string | null;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly reconcilePayment: ReconcilePayment;
  readonly cancelReconciliation: () => void;
  readonly setOrder: (order: OrderDto) => void;
  readonly setError: (error: string | null) => void;
  readonly setOutcomeOrderId: (orderId: string | null) => void;
  readonly paymentRevisionRef: MutableRefObject<number>;
}

export interface CashierPendingPaymentController {
  readonly pendingPayment: PendingPaymentOperation | null;
  readonly recoveryError: string | null;
  readonly recoveryOrderId: string | null;
  readonly recoveredPayment: {
    readonly applied: number;
    readonly tip?: number;
    readonly tenderTotal?: number;
    readonly change?: number;
    readonly remaining: number;
  } | null;
  readonly markSubmitted: (orderId: string, payment: AddPaymentRequest, cashReceivedMinor?: number) => boolean;
  readonly markCommitted: (operationId: string, order: OrderDto) => void;
  readonly markUnknown: (
    orderId: string,
    payment: AddPaymentRequest,
    order: OrderDto | null,
    cashReceivedMinor?: number,
  ) => void;
  readonly markUnavailable: (orderId: string, payment: AddPaymentRequest, cashReceivedMinor?: number) => void;
  readonly markRefused: (orderId: string, payment: AddPaymentRequest) => void;
  readonly retryPendingPayment: () => Promise<void>;
}

export function useCashierPendingPayment({
  orderId,
  mountedRef,
  reconcilePayment,
  cancelReconciliation,
  setOrder,
  setError,
  setOutcomeOrderId,
  paymentRevisionRef,
}: UseCashierPendingPaymentOptions): CashierPendingPaymentController {
  const initialState = readPendingPaymentState(orderId);
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentOperation | null>(() =>
    initialState.status === 'pending' ? initialState.operation : null,
  );
  const [recoveryError, setRecoveryError] = useState<string | null>(() => paymentRecoveryErrorFor(initialState.status));
  const [recoveredPayment, setRecoveredPayment] = useState<{
    readonly applied: number;
    readonly tip?: number;
    readonly tenderTotal?: number;
    readonly change?: number;
    readonly remaining: number;
  } | null>(null);
  const retryPendingPayment = useCashierPendingPaymentRecovery({
    orderId,
    pendingPayment,
    recoveryError,
    mountedRef,
    reconcilePayment,
    cancelReconciliation,
    setPendingPayment,
    setRecoveryError,
    setRecoveredPayment,
    setOrder,
    setError,
    setOutcomeOrderId,
    paymentRevisionRef,
  });

  const markSubmitted = useCallback((nextOrderId: string, payment: AddPaymentRequest, cashReceivedMinor?: number) => {
    const result = persistPendingPayment(nextOrderId, payment, cashReceivedMinor);
    if (result !== 'saved') {
      setRecoveryError(
        result === 'blocked' ? 'cashier.payment_recovery_unreadable' : 'cashier.payment_recovery_unavailable',
      );
      return false;
    }
    setRecoveredPayment(null);
    setRecoveryError(null);
    setPendingPayment(withPendingPaymentStatus(nextOrderId, payment, 'Checking', cashReceivedMinor));
    return true;
  }, []);

  const markCommitted = useCallback(
    (operationId: string, updated: OrderDto) => {
      const cleared = clearPendingPayment(operationId, updated.id);
      if (cleared) {
        setPendingPayment(null);
        setRecoveryError(null);
      } else {
        const stored = readPendingPaymentState(updated.id);
        setPendingPayment(
          stored.status === 'pending' && stored.operation.operationId === operationId
            ? withPendingPaymentStatus(updated.id, stored.operation, 'Unavailable', stored.operation.cashReceivedMinor)
            : null,
        );
        setRecoveryError('cashier.payment_recovery_unreadable');
        setError('cashier.payment_check_failed');
      }
      paymentRevisionRef.current += 1;
      setOrder(updated);
      setOutcomeOrderId(updated.id);
    },
    [paymentRevisionRef, setError, setOrder, setOutcomeOrderId],
  );

  const markUnknown = useCallback(
    (nextOrderId: string, payment: AddPaymentRequest, updated: OrderDto | null, cashReceivedMinor?: number) => {
      setPendingPayment(withPendingPaymentStatus(nextOrderId, payment, 'Unknown', cashReceivedMinor));
      if (updated) {
        paymentRevisionRef.current += 1;
        setOrder(updated);
      }
      setError('cashier.payment_result_unknown');
    },
    [paymentRevisionRef, setError, setOrder],
  );

  const markUnavailable = useCallback(
    (nextOrderId: string, payment: AddPaymentRequest, cashReceivedMinor?: number) => {
      setPendingPayment(withPendingPaymentStatus(nextOrderId, payment, 'Unavailable', cashReceivedMinor));
      setError('cashier.payment_check_failed');
    },
    [setError],
  );

  const markRefused = useCallback((nextOrderId: string, payment: AddPaymentRequest) => {
    const cleared = clearPendingPayment(payment.operationId, nextOrderId);
    setPendingPayment(cleared ? withPendingPaymentStatus(nextOrderId, payment, 'Refused') : null);
    if (!cleared) setRecoveryError('cashier.payment_recovery_unreadable');
  }, []);

  return {
    pendingPayment,
    recoveryError,
    recoveryOrderId: initialState.status === 'other-order' ? initialState.operation.orderId : null,
    recoveredPayment,
    markSubmitted,
    markCommitted,
    markUnknown,
    markUnavailable,
    markRefused,
    retryPendingPayment,
  };
}
