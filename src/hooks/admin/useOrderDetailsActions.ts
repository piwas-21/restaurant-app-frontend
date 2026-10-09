'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { permitsChannelLocalAction } from '@/lib/externalOrder';
import { OrderDto } from '@/types/order';
import { cancelOrder, refundPayment, updateOrderStatus } from '@/services/orderService';
import { useApiError } from '@/hooks/useApiError';
import { useOrderDocumentActions } from '@/hooks/admin/useOrderDocumentActions';
import { buildOrderRefundDraft } from '@/lib/orderRefundDraft';

/**
 * State + action handlers for the OrderDetailsModal (confirm / cancel / refund / print /
 * export, plus the success-modal flow). Extracted from OrderDetailsModal (Sprint 6 god-file
 * decomposition); behaviour is unchanged — the modal renders from what this hook returns.
 *
 * Errors follow shape 1 of the E9 recipe in `useApiError` (#383). Locally: client-side refusals
 * use `show()`, not `capture()` — nothing was thrown; and the exposed setter narrows to
 * `clearError()`, since all three consumers only ever passed `''`.
 */
export function useOrderDetailsActions(
  order: OrderDto,
  onClose: () => void,
  onOrderUpdated?: (updatedOrder: OrderDto) => void,
) {
  const { t } = useTranslation();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundTipAmount, setRefundTipAmount] = useState('0.00');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const apiError = useApiError();
  const documents = useOrderDocumentActions(order);
  const [showConfirmDelayModal, setShowConfirmDelayModal] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);

  const canCancelOrder = () => {
    return (
      permitsChannelLocalAction(order, 'CancelOrder') &&
      order.status !== 'Completed' &&
      order.status !== 'Delivered' &&
      order.status !== 'Cancelled'
    );
  };

  const canConfirmOrder = () => {
    return !order.externalOrder && order.status === 'Pending';
  };

  const handleConfirmOrder = async (withDelay: boolean = false) => {
    try {
      setIsConfirming(true);
      apiError.clear();

      const prepMinutes = withDelay ? delayMinutes : 15; // Default 15 mins if no delay specified

      const updatedOrder = await updateOrderStatus(order.id, {
        newStatus: withDelay ? 'PendingApproval' : 'Confirmed',
        estimatedPreparationMinutes: prepMinutes,
        notes: withDelay ? `Confirmed with ${prepMinutes} min delay` : 'Order confirmed',
      });

      if (onOrderUpdated) {
        onOrderUpdated(updatedOrder);
      }

      setShowConfirmDelayModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      apiError.capture(err, { fallback: t('failed_to_confirm_order', 'Failed to confirm order. Please try again.') });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onClose();
  };

  const handleCancelSuccessClose = () => {
    setShowCancelSuccessModal(false);
    onClose();
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      apiError.show(t('provide_cancellation_reason', 'Please provide a cancellation reason'));
      return;
    }

    try {
      setIsCancelling(true);
      apiError.clear();
      const updatedOrder = await cancelOrder(order.id, { cancellationReason: cancelReason });
      if (onOrderUpdated) {
        onOrderUpdated(updatedOrder);
      }
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
    } catch (err) {
      apiError.capture(err, { fallback: t('failed_to_cancel_order', 'Failed to cancel order. Please try again.') });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefundPayment = async () => {
    const draft = buildOrderRefundDraft({
      order,
      paymentId: selectedPayment,
      amount: refundAmount,
      tipAmount: refundTipAmount,
      reason: refundReason,
    });
    if (!draft.ok) {
      const message = draft.max
        ? t(draft.errorKey, { max: draft.max })
        : draft.fallback
          ? t(draft.errorKey, draft.fallback)
          : t(draft.errorKey);
      apiError.show(message);
      return;
    }

    try {
      setIsRefunding(true);
      apiError.clear();
      await refundPayment(order.id, draft.paymentId, draft.command);
      setShowRefundModal(false);
      alert(t('payment_refunded_successfully', 'Payment refunded successfully'));
      onClose();
    } catch (err) {
      apiError.capture(err, { fallback: t('failed_to_process_refund', 'Failed to process refund. Please try again.') });
    } finally {
      setIsRefunding(false);
    }
  };

  return {
    // cancel
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    isCancelling,
    handleCancelOrder,
    canCancelOrder,
    // confirm + delay
    showConfirmDelayModal,
    setShowConfirmDelayModal,
    delayMinutes,
    setDelayMinutes,
    isConfirming,
    handleConfirmOrder,
    canConfirmOrder,
    // refund
    showRefundModal,
    setShowRefundModal,
    selectedPayment,
    setSelectedPayment,
    refundAmount,
    setRefundAmount,
    refundTipAmount,
    setRefundTipAmount,
    refundReason,
    setRefundReason,
    isRefunding,
    handleRefundPayment,
    // success
    showSuccessModal,
    handleSuccessClose,
    showCancelSuccessModal,
    handleCancelSuccessClose,
    // export / print — see useOrderDocumentActions
    ...documents,
    // `error` stays a plain string so the dialogs keep rendering `{error && …}`.
    error: apiError.message ?? '',
    clearError: apiError.clear,
  };
}
