import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderById, getPaymentOperation, type AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { usePaymentReconciliation } from './usePaymentReconciliation';
import { StalePaymentOutcomeError, submitPaymentOutcome } from './useCashierCollectionOutcome';
import { useCashierPendingPayment } from './useCashierPendingPayment';
import { handlePaymentFailure } from './useCashierCollectionFailure';

export interface CashierCollectionState {
  readonly order: OrderDto | null;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly isCheckingPayment: boolean;
  readonly error: string | null;
  readonly pendingPayment: ReturnType<typeof useCashierPendingPayment>['pendingPayment'];
  readonly recoveredPayment: ReturnType<typeof useCashierPendingPayment>['recoveredPayment'];
  readonly outcomeOrderId: string | null;
  readonly refresh: () => Promise<void>;
  readonly submitPayment: (payment: AddPaymentRequest) => Promise<OrderDto>;
  readonly retryPendingPayment: () => Promise<void>;
  readonly abandonPendingPayment: () => void;
}

/**
 * Owns the selected order read and the one tender write used by the focused collection route.
 * A lost POST is reconciled by operation ID; its immutable payload survives a reload and is never
 * posted a second time automatically.
 */
export function useCashierCollection(orderId: string | null): CashierCollectionState {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeOrderId, setOutcomeOrderId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);
  const inFlightTokenRef = useRef(0);
  const paymentRevisionRef = useRef(0);
  const { isCheckingPayment, reconcilePayment, cancelReconciliation } = usePaymentReconciliation(getPaymentOperation);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      cancelReconciliation();
    };
  }, [cancelReconciliation]);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!orderId || !mountedRef.current) {
      setOrder(null);
      setIsLoading(false);
      setError(orderId ? null : 'cashier.collection.order_required');
      return;
    }
    const requestId = ++requestRef.current;
    const paymentRevision = paymentRevisionRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const nextOrder = await getOrderById(orderId);
      if (!mountedRef.current || requestId !== requestRef.current || paymentRevision !== paymentRevisionRef.current) {
        return;
      }
      setOrder(nextOrder);
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current || paymentRevision !== paymentRevisionRef.current)
        return;
      setOrder(null);
      setError(getErrorMessage(reason) ?? 'cashier.workspace.order_unavailable');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, [orderId]);

  const pending = useCashierPendingPayment({
    orderId,
    mountedRef,
    reconcilePayment,
    cancelReconciliation,
    setOrder,
    setError,
    setOutcomeOrderId,
    paymentRevisionRef,
  });

  useEffect(() => {
    requestRef.current += 1;
    inFlightRef.current = false;
    inFlightTokenRef.current += 1;
    setIsMutating(false);
    setOrder(null);
    setOutcomeOrderId(null);
    setIsLoading(Boolean(orderId));
    if (orderId) void refresh();
    else setError('cashier.collection.order_required');
  }, [orderId, refresh]);

  const unresolvedPending = pending.pendingPayment && pending.pendingPayment.status !== 'Refused';
  useEffect(() => {
    if (!isMutating && !isCheckingPayment && !unresolvedPending) return;
    const preventDismissal = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventDismissal);
    return () => window.removeEventListener('beforeunload', preventDismissal);
  }, [isCheckingPayment, isMutating, unresolvedPending]);

  const submitPayment = useCallback(
    async (payment: AddPaymentRequest): Promise<OrderDto> => {
      if (!order || !orderId || order.id.toLowerCase() !== orderId.toLowerCase()) {
        throw new Error('cashier.collection.order_required');
      }
      if (unresolvedPending) throw new Error('cashier.collection.payment_in_progress');
      if (inFlightRef.current) throw new Error('cashier.collection.payment_in_progress');
      const submittedPayment =
        payment.expectedVersion === undefined && order.version !== undefined
          ? { ...payment, expectedVersion: order.version }
          : payment;

      const requestId = ++requestRef.current;
      paymentRevisionRef.current += 1;
      const inFlightToken = ++inFlightTokenRef.current;
      const isCurrent = () => mountedRef.current && requestId === requestRef.current;
      inFlightRef.current = true;
      pending.markSubmitted(order.id, submittedPayment);
      setIsMutating(true);
      setError(null);
      try {
        const updated = await submitPaymentOutcome(order, submittedPayment, reconcilePayment, isCurrent);
        if (!isCurrent()) throw new StalePaymentOutcomeError();
        pending.markCommitted(submittedPayment.operationId, updated);
        return updated;
      } catch (reason: unknown) {
        await handlePaymentFailure({
          reason,
          order,
          payment: submittedPayment,
          isCurrent,
          pending,
          setError,
          setOrder,
          paymentRevisionRef,
        });
        throw new StalePaymentOutcomeError();
      } finally {
        if (inFlightTokenRef.current === inFlightToken) {
          inFlightRef.current = false;
          if (mountedRef.current) setIsMutating(false);
        }
      }
    },
    [order, orderId, pending, paymentRevisionRef, reconcilePayment, setError, unresolvedPending],
  );

  return {
    order,
    isLoading,
    isMutating,
    isCheckingPayment,
    error,
    pendingPayment: pending.pendingPayment,
    recoveredPayment: pending.recoveredPayment,
    outcomeOrderId,
    refresh,
    submitPayment,
    retryPendingPayment: pending.retryPendingPayment,
    abandonPendingPayment: pending.abandonPendingPayment,
  };
}
