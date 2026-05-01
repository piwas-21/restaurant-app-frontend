'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { quickConfirmOrder, quickCancelOrder, AddPaymentRequest } from '@/services/cashierService';

const SUCCESS_MESSAGE_TIMEOUT_MS = 3000;
const ERROR_MESSAGE_TIMEOUT_MS = 5000;

export interface CashierMutations {
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  refundPayment: (orderId: string, paymentId: string, amount?: number) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
  refreshOrders: () => Promise<void>;
}

/**
 * Owns selected-order tracking, the five mutation dialogs, transient
 * success/error toasts, and the quick-confirm/cancel actions. Mutations
 * come from `useCashierOrders`; this hook layers UI feedback + dialog
 * lifecycle on top.
 */
export function useCashierDialogs(orders: OrderDto[], mutations: CashierMutations) {
  const { t } = useTranslation();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), ERROR_MESSAGE_TIMEOUT_MS);
  }, []);

  // Generic dialog action: run mutation, surface feedback, close dialog.
  const runDialogAction = useCallback(
    async <T>(
      runner: () => Promise<T>,
      onSuccessKey: string,
      onErrorKey: string,
      closeDialog: () => void,
      onSuccess?: (value: T) => void,
    ) => {
      try {
        const value = await runner();
        onSuccess?.(value);
        showSuccess(t(onSuccessKey) || onSuccessKey);
      } catch (err) {
        showError((err as Error).message || t(onErrorKey) || onErrorKey);
      } finally {
        closeDialog();
      }
    },
    [showSuccess, showError, t],
  );

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!selectedOrder) return;
      await runDialogAction(
        () => mutations.updateOrderStatus(selectedOrder.id, newStatus),
        'cashier.status_updated',
        'cashier.status_update_failed',
        () => setShowStatusDialog(false),
        (updated) => setSelectedOrderId(updated.id),
      );
    },
    [selectedOrder, mutations, runDialogAction],
  );

  const handleAddPayment = useCallback(
    async (paymentData: AddPaymentRequest) => {
      if (!selectedOrder) return;
      await runDialogAction(
        () => mutations.addPayment(selectedOrder.id, paymentData),
        'cashier.payment_added',
        'cashier.payment_failed',
        () => setShowPaymentDialog(false),
        (updated) => setSelectedOrderId(updated.id),
      );
    },
    [selectedOrder, mutations, runDialogAction],
  );

  const handleRefund = useCallback(
    async (paymentId: string, amount?: number) => {
      if (!selectedOrder) return;
      await runDialogAction(
        () => mutations.refundPayment(selectedOrder.id, paymentId, amount),
        'cashier.refund_completed',
        'cashier.refund_failed',
        () => setShowRefundDialog(false),
        (updated) => setSelectedOrderId(updated.id),
      );
    },
    [selectedOrder, mutations, runDialogAction],
  );

  const handleCancelOrder = useCallback(
    async (reason?: string) => {
      if (!selectedOrder) return;
      await runDialogAction(
        () => mutations.cancelOrder(selectedOrder.id, reason),
        'cashier.order_cancelled',
        'cashier.cancel_failed',
        () => setShowCancelDialog(false),
        () => setSelectedOrderId(null),
      );
    },
    [selectedOrder, mutations, runDialogAction],
  );

  const handleToggleFocus = useCallback(
    async (isFocus: boolean, priority?: number, reason?: string) => {
      if (!selectedOrder) return;
      const successKey = isFocus ? 'cashier.order_marked_focus' : 'cashier.focus_removed';
      await runDialogAction(
        () => mutations.toggleFocusOrder(selectedOrder.id, isFocus, priority, reason),
        successKey,
        'cashier.focus_toggle_failed',
        () => setShowFocusDialog(false),
        (updated) => setSelectedOrderId(updated.id),
      );
    },
    [selectedOrder, mutations, runDialogAction],
  );

  const handleQuickConfirm = useCallback(
    async (orderNumber: string, preparationMinutes: number) => {
      try {
        await quickConfirmOrder(orderNumber, preparationMinutes);
        await mutations.refreshOrders();
        showSuccess(`Order ${orderNumber} confirmed with ${preparationMinutes} min preparation time`);
      } catch (err) {
        showError((err as Error).message || 'Failed to confirm order');
        throw err;
      }
    },
    [mutations, showSuccess, showError],
  );

  const handleQuickCancel = useCallback(
    async (orderNumber: string) => {
      try {
        await quickCancelOrder(orderNumber);
        await mutations.refreshOrders();
        showSuccess(`Order ${orderNumber} has been cancelled`);
      } catch (err) {
        showError((err as Error).message || 'Failed to cancel order');
        throw err;
      }
    },
    [mutations, showSuccess, showError],
  );

  return {
    selectedOrderId,
    selectedOrder,
    setSelectedOrderId,
    successMessage,
    errorMessage,
    showSuccess,
    showError,
    showStatusDialog,
    showPaymentDialog,
    showRefundDialog,
    showCancelDialog,
    showFocusDialog,
    setShowStatusDialog,
    setShowPaymentDialog,
    setShowRefundDialog,
    setShowCancelDialog,
    setShowFocusDialog,
    handleStatusChange,
    handleAddPayment,
    handleRefund,
    handleCancelOrder,
    handleToggleFocus,
    handleQuickConfirm,
    handleQuickCancel,
  };
}
