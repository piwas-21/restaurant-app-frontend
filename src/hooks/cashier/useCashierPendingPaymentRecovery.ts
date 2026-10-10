import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  clearPendingPayment,
  matchesPendingPayment,
  readPendingPaymentState,
  type PendingPaymentOperation,
  withPendingPaymentStatus,
} from '@/lib/cashierPendingPayment';
import type { OrderDto } from '@/types/order';
import type { CashierCollectionPaymentOutcome } from './useCashierCollectionForm.types';
import type { ReconcilePayment } from './useCashierCollectionOutcome';
import { reportCashierRecoveryFailure } from '@/lib/cashierRecoveryDiagnostics';

interface PendingPaymentRecoveryOptions {
  readonly orderId: string | null;
  readonly pendingPayment: PendingPaymentOperation | null;
  readonly recoveryError: string | null;
  readonly mountedRef: MutableRefObject<boolean>;
  readonly reconcilePayment: ReconcilePayment;
  readonly cancelReconciliation: () => void;
  readonly setPendingPayment: Dispatch<SetStateAction<PendingPaymentOperation | null>>;
  readonly setRecoveryError: Dispatch<SetStateAction<string | null>>;
  readonly setRecoveredPayment: Dispatch<SetStateAction<CashierCollectionPaymentOutcome | null>>;
  readonly setOrder: (order: OrderDto) => void;
  readonly setError: (error: string | null) => void;
  readonly setOutcomeOrderId: (orderId: string | null) => void;
  readonly paymentRevisionRef: MutableRefObject<number>;
}

export function useCashierPendingPaymentRecovery({
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
}: PendingPaymentRecoveryOptions): () => Promise<void> {
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
          if (!matchesPendingPayment(saved, result.payment)) {
            setPendingPayment(withPendingPaymentStatus(saved.orderId, saved, 'Unknown', saved.cashReceivedMinor));
            setError('cashier.payment_result_unknown');
            return;
          }
          if (!clearPendingPayment(saved.operationId, saved.orderId)) {
            setPendingPayment(withPendingPaymentStatus(saved.orderId, saved, 'Unavailable', saved.cashReceivedMinor));
            setRecoveryError('cashier.payment_recovery_unreadable');
            setError('cashier.payment_check_failed');
            return;
          }
          setPendingPayment(null);
          setRecoveryError(null);
          setRecoveredPayment(recoveredOutcome(saved, result.order));
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
      } catch (error: unknown) {
        reportCashierRecoveryFailure('check order payment', error);
        if (mountedRef.current && requestId === requestNumberRef.current) {
          setPendingPayment({ ...saved, status: 'Unavailable' });
          setError('cashier.payment_check_failed');
        }
      }
    },
    [
      mountedRef,
      orderId,
      reconcilePayment,
      setError,
      setOrder,
      setOutcomeOrderId,
      setPendingPayment,
      setRecoveryError,
      setRecoveredPayment,
      paymentRevisionRef,
    ],
  );

  useEffect(() => {
    const stored = readPendingPaymentState(orderId);
    const saved = stored.status === 'pending' ? stored.operation : null;
    setPendingPayment(saved);
    setRecoveryError(paymentRecoveryErrorFor(stored.status));
    setRecoveredPayment(null);
    setOutcomeOrderId(null);
    if (!orderId) return () => undefined;
    if (stored.status === 'unavailable') setError('cashier.payment_check_failed');
    if (saved) void resume(saved);
    return () => {
      requestNumberRef.current += 1;
      cancelReconciliation();
    };
  }, [
    cancelReconciliation,
    orderId,
    resume,
    setError,
    setOutcomeOrderId,
    setPendingPayment,
    setRecoveredPayment,
    setRecoveryError,
  ]);

  return useCallback(async () => {
    const current = pendingPayment;
    if (current) {
      if (current.status === 'Checking' || current.status === 'Refused') return;
      await resume(current);
      return;
    }
    const stored = readPendingPaymentState(orderId);
    if (stored.status === 'pending') {
      setRecoveryError(null);
      setPendingPayment(stored.operation);
      await resume(stored.operation);
    } else if (stored.status === 'other-order') {
      setRecoveryError('cashier.payment_recovery_other_order');
    } else if (stored.status === 'none' && recoveryError === 'cashier.payment_recovery_unavailable') {
      setRecoveryError(null);
      setError(null);
    } else {
      setRecoveryError('cashier.payment_recovery_unreadable');
      setError('cashier.payment_check_failed');
    }
  }, [orderId, pendingPayment, recoveryError, resume, setError, setPendingPayment, setRecoveryError]);
}

export function paymentRecoveryErrorFor(status: ReturnType<typeof readPendingPaymentState>['status']): string | null {
  if (status === 'unavailable') return 'cashier.payment_recovery_unreadable';
  if (status === 'other-order') return 'cashier.payment_recovery_other_order';
  return null;
}

function recoveredOutcome(saved: PendingPaymentOperation, order: OrderDto): CashierCollectionPaymentOutcome {
  const tipMinor = saved.tipMinor ?? 0;
  const changeMinor = saved.paymentMethod === 'Cash' ? saved.cashReceivedMinor : undefined;
  return {
    applied: saved.amount,
    tip: tipMinor / 100,
    tenderTotal: saved.amount + tipMinor / 100,
    ...(changeMinor === undefined
      ? {}
      : { change: Math.max(0, changeMinor - Math.round(saved.amount * 100) - tipMinor) / 100 }),
    remaining: order.remainingAmount,
  };
}
