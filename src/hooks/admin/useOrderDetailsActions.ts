'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { cancelOrder, refundPayment, updateOrderStatus } from '@/services/orderService';
import { exportOrderToCSV } from '@/utils/exportUtils';
import { exportOrderToPDF } from '@/utils/pdfExportUtils';

/**
 * State + action handlers for the OrderDetailsModal (confirm / cancel / refund / print /
 * export, plus the success-modal flow). Extracted from OrderDetailsModal (Sprint 6 god-file
 * decomposition); behaviour is unchanged — the modal renders from what this hook returns.
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
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [error, setError] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConfirmDelayModal, setShowConfirmDelayModal] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);

  const canCancelOrder = () => {
    return order.status !== 'Completed' && order.status !== 'Delivered' && order.status !== 'Cancelled';
  };

  const canConfirmOrder = () => {
    return order.status === 'Pending';
  };

  const handleConfirmOrder = async (withDelay: boolean = false) => {
    try {
      setIsConfirming(true);
      setError('');

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
    } catch {
      setError(t('failed_to_confirm_order', 'Failed to confirm order. Please try again.'));
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
      setError(t('provide_cancellation_reason', 'Please provide a cancellation reason'));
      return;
    }

    try {
      setIsCancelling(true);
      setError('');
      const updatedOrder = await cancelOrder(order.id, { reason: cancelReason });
      if (onOrderUpdated) {
        onOrderUpdated(updatedOrder);
      }
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
    } catch {
      setError(t('failed_to_cancel_order', 'Failed to cancel order. Please try again.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!selectedPayment || !refundAmount || !refundReason.trim()) {
      setError(t('fill_refund_details', 'Please fill in all refund details'));
      return;
    }

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      setError(t('enter_valid_refund_amount', 'Please enter a valid refund amount'));
      return;
    }

    try {
      setIsRefunding(true);
      setError('');
      await refundPayment(order.id, selectedPayment, {
        amount,
        reason: refundReason,
      });
      setShowRefundModal(false);
      alert(t('payment_refunded_successfully', 'Payment refunded successfully'));
      onClose();
    } catch {
      setError(t('failed_to_process_refund', 'Failed to process refund. Please try again.'));
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePrint = () => {
    // Add print-specific class to body
    document.body.classList.add('printing');

    // Small delay to ensure styles are applied before print dialog opens
    setTimeout(() => {
      window.print();

      // Remove class after print dialog closes
      setTimeout(() => {
        document.body.classList.remove('printing');
      }, 100);
    }, 10);
  };

  const handleExport = () => {
    exportOrderToCSV(order, t);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    exportOrderToPDF(order, t);
    setShowExportMenu(false);
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
    refundReason,
    setRefundReason,
    isRefunding,
    handleRefundPayment,
    // success
    showSuccessModal,
    handleSuccessClose,
    showCancelSuccessModal,
    handleCancelSuccessClose,
    // export / print
    showExportMenu,
    setShowExportMenu,
    handlePrint,
    handleExport,
    handleExportPDF,
    // shared
    error,
    setError,
  };
}
