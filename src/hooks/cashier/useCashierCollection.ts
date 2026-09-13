import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addPaymentToOrder,
  getOrderById,
  getPaymentOperation,
  type AddPaymentRequest,
} from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import {
  isPaymentOutcomeUnknown,
  type PaymentReconciliationResult,
  usePaymentReconciliation,
} from './usePaymentReconciliation';

export interface CashierCollectionState {
  readonly order: OrderDto | null;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly isCheckingPayment: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly submitPayment: (payment: AddPaymentRequest) => Promise<OrderDto>;
}

type ReconcilePayment = (orderId: string, operationId: string) => Promise<PaymentReconciliationResult>;

async function submitPaymentOutcome(
  order: OrderDto,
  payment: AddPaymentRequest,
  reconcilePayment: ReconcilePayment,
  isCurrent: () => boolean,
  setOrder: (nextOrder: OrderDto) => void,
): Promise<OrderDto> {
  try {
    const updated = await addPaymentToOrder(order.id, payment);
    if (isCurrent()) setOrder(updated);
    return updated;
  } catch (reason: unknown) {
    if (!isPaymentOutcomeUnknown(reason)) throw reason;
    const result = await reconcilePayment(order.id, payment.operationId);
    if (!isCurrent() || result.status === 'Stale') throw new Error('cashier.payment_check_failed');
    if (result.status === 'Committed') {
      setOrder(result.order);
      return result.order;
    }
    if (result.status === 'Unknown' && result.order) setOrder(result.order);
    throw new Error(result.status === 'Unknown' ? 'cashier.payment_result_unknown' : 'cashier.payment_check_failed');
  }
}

/**
 * Owns the selected order read and the one tender write used by the focused collection route.
 * A lost POST response is reconciled by operation ID; the POST is never repeated automatically.
 */
export function useCashierCollection(orderId: string | null): CashierCollectionState {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const inFlightRef = useRef(false);
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
    if (!orderId || !mountedRef.current) {
      setOrder(null);
      setIsLoading(false);
      setError(orderId ? null : 'cashier.collection.order_required');
      return;
    }

    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const nextOrder = await getOrderById(orderId);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setOrder(nextOrder);
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setOrder(null);
      setError(getErrorMessage(reason) ?? 'cashier.workspace.order_unavailable');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestRef.current += 1;
      cancelReconciliation();
    };
  }, [cancelReconciliation, refresh]);

  useEffect(() => {
    if (!isMutating && !isCheckingPayment) return;
    const preventDismissal = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventDismissal);
    return () => window.removeEventListener('beforeunload', preventDismissal);
  }, [isCheckingPayment, isMutating]);

  const submitPayment = useCallback(
    async (payment: AddPaymentRequest): Promise<OrderDto> => {
      if (!order || !orderId || order.id.toLowerCase() !== orderId.toLowerCase()) {
        throw new Error('cashier.collection.order_required');
      }
      if (inFlightRef.current) throw new Error('cashier.collection.payment_in_progress');

      const requestId = ++requestRef.current;
      const isCurrent = () => mountedRef.current && requestId === requestRef.current;
      inFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      try {
        return await submitPaymentOutcome(order, payment, reconcilePayment, isCurrent, (nextOrder) =>
          setOrder(nextOrder),
        );
      } catch (reason: unknown) {
        if (isCurrent()) setError(getErrorMessage(reason));
        throw reason;
      } finally {
        if (isCurrent()) {
          inFlightRef.current = false;
          setIsMutating(false);
        }
      }
    },
    [order, orderId, reconcilePayment],
  );

  return {
    order,
    isLoading,
    isMutating,
    isCheckingPayment,
    error,
    refresh,
    submitPayment,
  };
}
