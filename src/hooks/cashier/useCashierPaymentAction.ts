import { useCallback, useEffect, useRef, useState } from 'react';
import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import { isPaymentOutcomeUnknown, usePaymentReconciliation } from './usePaymentReconciliation';

interface CashierPaymentActionOptions {
  readonly selectedOrder: OrderDto | null;
  readonly addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  readonly reconcilePayment?: (orderId: string, operationId: string) => Promise<PaymentOperationLookupDto>;
  readonly showPaymentModal: boolean;
  readonly setShowPaymentModal: (show: boolean) => void;
  readonly setSelectedOrderId: (orderId: string) => void;
  readonly showSuccess: (message: string) => void;
  readonly showError: (message: string) => void;
  readonly t: (key: string) => string;
}

/** Owns the payment write, one-shot reconciliation, and lifecycle guards for the cashier modal. */
export function useCashierPaymentAction({
  selectedOrder,
  addPayment,
  reconcilePayment: lookupPaymentOperation,
  showPaymentModal,
  setShowPaymentModal,
  setSelectedOrderId,
  showSuccess,
  showError,
  t,
}: CashierPaymentActionOptions) {
  const [isMutating, setIsMutating] = useState(false);
  const mountedRef = useRef(true);
  const paymentAttemptRef = useRef(0);
  const wasPaymentOpenRef = useRef(false);
  const inFlightRef = useRef(false);
  const { isCheckingPayment, reconcilePayment, cancelReconciliation } =
    usePaymentReconciliation(lookupPaymentOperation);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      paymentAttemptRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (wasPaymentOpenRef.current && !showPaymentModal) {
      paymentAttemptRef.current += 1;
      cancelReconciliation();
      inFlightRef.current = false;
      setIsMutating(false);
    }
    wasPaymentOpenRef.current = showPaymentModal;
  }, [showPaymentModal, cancelReconciliation]);

  const completePayment = useCallback(
    (updated: OrderDto) => {
      setSelectedOrderId(updated.id);
      showSuccess(t('cashier.payment_added') || 'cashier.payment_added');
      setShowPaymentModal(false);
    },
    [setSelectedOrderId, showSuccess, setShowPaymentModal, t],
  );

  const reconcileUnknownPayment = useCallback(
    async (orderId: string, operationId: string, isCurrent: () => boolean) => {
      const result = await reconcilePayment(orderId, operationId);
      if (!isCurrent() || result.status === 'Stale') return;
      if (result.status === 'Committed') {
        completePayment(result.order);
        return;
      }

      if (result.status === 'Unknown' && result.order) setSelectedOrderId(result.order.id);
      let messageKey = 'cashier.payment_check_failed';
      if (result.status === 'Unknown') messageKey = 'cashier.payment_result_unknown';
      const message = t(messageKey);
      showError(message);
      throw new Error(message);
    },
    [reconcilePayment, completePayment, setSelectedOrderId, t, showError],
  );

  const handleAddPayment = useCallback(
    async (paymentData: AddPaymentRequest) => {
      if (!selectedOrder || !showPaymentModal || !mountedRef.current || inFlightRef.current) return;
      const orderId = selectedOrder.id;
      const attempt = ++paymentAttemptRef.current;
      const isCurrent = () => mountedRef.current && attempt === paymentAttemptRef.current;
      inFlightRef.current = true;
      setIsMutating(true);
      try {
        const updated = await addPayment(orderId, paymentData);
        if (!isCurrent()) return;
        completePayment(updated);
      } catch (error) {
        if (!isCurrent()) return;
        if (!isPaymentOutcomeUnknown(error)) throw error;
        await reconcileUnknownPayment(orderId, paymentData.operationId, isCurrent);
      } finally {
        if (isCurrent()) {
          inFlightRef.current = false;
          setIsMutating(false);
        }
      }
    },
    [selectedOrder, showPaymentModal, addPayment, completePayment, reconcileUnknownPayment],
  );
  return { isMutating, isCheckingPayment, handleAddPayment };
}
