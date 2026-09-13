import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import {
  clearPendingPayment,
  persistPendingPayment,
  readPendingPayment,
  type PendingPaymentOperation,
} from '@/lib/cashierPendingPayment';
import type { ReconcilePayment } from './useCashierCollectionOutcome';

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
  readonly recoveredPayment: { readonly applied: number; readonly change: number; readonly remaining: number } | null;
  readonly markSubmitted: (orderId: string, payment: AddPaymentRequest) => void;
  readonly markCommitted: (operationId: string, order: OrderDto) => void;
  readonly markUnknown: (orderId: string, payment: AddPaymentRequest, order: OrderDto | null) => void;
  readonly markUnavailable: (orderId: string, payment: AddPaymentRequest) => void;
  readonly markRefused: (orderId: string, payment: AddPaymentRequest) => void;
  readonly retryPendingPayment: () => Promise<void>;
  readonly abandonPendingPayment: () => void;
}

function withStatus(
  orderId: string,
  payment: AddPaymentRequest,
  status: PendingPaymentOperation['status'],
): PendingPaymentOperation {
  return { ...payment, orderId, status };
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
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentOperation | null>(() =>
    readPendingPayment(orderId),
  );
  const [recoveredPayment, setRecoveredPayment] = useState<{
    readonly applied: number;
    readonly change: number;
    readonly remaining: number;
  } | null>(null);
  const requestNumberRef = useRef(0);

  const resume = useCallback(
    async (saved: PendingPaymentOperation): Promise<void> => {
      if (!mountedRef.current || !orderId) return;
      const requestId = ++requestNumberRef.current;
      setPendingPayment({ ...saved, status: 'Checking' });
      try {
        const result = await reconcilePayment(orderId, saved.operationId);
        if (!mountedRef.current || requestId !== requestNumberRef.current || result.status === 'Stale') return;
        if (result.status === 'Committed') {
          clearPendingPayment(saved.operationId);
          setPendingPayment(null);
          setRecoveredPayment({ applied: saved.amount, change: 0, remaining: result.order.remainingAmount });
          paymentRevisionRef.current += 1;
          setOrder(result.order);
          setOutcomeOrderId(result.order.id);
          setError(null);
          return;
        }
        if (result.status === 'Unknown') {
          setPendingPayment({ ...saved, status: 'Unknown' });
          if (result.order) {
            paymentRevisionRef.current += 1;
            setOrder(result.order);
          }
          setError('cashier.payment_result_unknown');
          return;
        }
        setPendingPayment({ ...saved, status: 'Unavailable' });
        setError('cashier.payment_check_failed');
      } catch (_error) {
        if (mountedRef.current && requestId === requestNumberRef.current) {
          setPendingPayment({ ...saved, status: 'Unavailable' });
          setError('cashier.payment_check_failed');
        }
      }
    },
    [mountedRef, orderId, paymentRevisionRef, reconcilePayment, setError, setOrder, setOutcomeOrderId],
  );

  useEffect(() => {
    setPendingPayment(readPendingPayment(orderId));
    setRecoveredPayment(null);
    setOutcomeOrderId(null);
    if (!orderId) return () => undefined;
    const saved = readPendingPayment(orderId);
    if (saved) void resume(saved);
    return () => {
      requestNumberRef.current += 1;
      cancelReconciliation();
    };
  }, [cancelReconciliation, orderId, resume, setOutcomeOrderId]);

  const markSubmitted = useCallback((nextOrderId: string, payment: AddPaymentRequest) => {
    setRecoveredPayment(null);
    persistPendingPayment(nextOrderId, payment);
    setPendingPayment(withStatus(nextOrderId, payment, 'Checking'));
  }, []);

  const markCommitted = useCallback(
    (operationId: string, updated: OrderDto) => {
      clearPendingPayment(operationId);
      setPendingPayment(null);
      paymentRevisionRef.current += 1;
      setOrder(updated);
      setOutcomeOrderId(updated.id);
    },
    [paymentRevisionRef, setOrder, setOutcomeOrderId],
  );

  const markUnknown = useCallback(
    (nextOrderId: string, payment: AddPaymentRequest, updated: OrderDto | null) => {
      setPendingPayment(withStatus(nextOrderId, payment, 'Unknown'));
      if (updated) {
        paymentRevisionRef.current += 1;
        setOrder(updated);
      }
      setError('cashier.payment_result_unknown');
    },
    [paymentRevisionRef, setError, setOrder],
  );

  const markUnavailable = useCallback(
    (nextOrderId: string, payment: AddPaymentRequest) => {
      setPendingPayment(withStatus(nextOrderId, payment, 'Unavailable'));
      setError('cashier.payment_check_failed');
    },
    [setError],
  );

  const markRefused = useCallback((nextOrderId: string, payment: AddPaymentRequest) => {
    clearPendingPayment(payment.operationId);
    setPendingPayment(withStatus(nextOrderId, payment, 'Refused'));
  }, []);

  const retryPendingPayment = useCallback(async () => {
    if (!pendingPayment || pendingPayment.status === 'Checking' || pendingPayment.status === 'Refused') return;
    await resume(pendingPayment);
  }, [pendingPayment, resume]);

  const abandonPendingPayment = useCallback(() => {
    if (!pendingPayment || pendingPayment.status !== 'Unknown') return;
    requestNumberRef.current += 1;
    cancelReconciliation();
    clearPendingPayment(pendingPayment.operationId);
    setPendingPayment(null);
    setRecoveredPayment(null);
    setError(null);
  }, [cancelReconciliation, pendingPayment, setError]);

  return {
    pendingPayment,
    recoveredPayment,
    markSubmitted,
    markCommitted,
    markUnknown,
    markUnavailable,
    markRefused,
    retryPendingPayment,
    abandonPendingPayment,
  };
}
