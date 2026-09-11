'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { AddPaymentRequest } from '@/services/cashierService';
import { useCashierQuickActions } from './useCashierQuickActions';

const SUCCESS_MESSAGE_TIMEOUT_MS = 3000;
const ERROR_MESSAGE_TIMEOUT_MS = 5000;

export interface CashierMutations {
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  refundPayment: (orderId: string, paymentId: string, amount: number, reason: string) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
  /** Resolves `false` when the refresh failed; see `useCashierOrders`. Unused here — the dialogs
   *  report their own outcome from the mutation they just awaited, not from the re-fetch. */
  refreshOrders: () => Promise<boolean>;
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFocusDialog, setShowFocusDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), ERROR_MESSAGE_TIMEOUT_MS);
  }, []);

  // Generic dialog action: run mutation, surface feedback, and close the dialog ONLY on
  // success. A failed mutation leaves the dialog open so the cashier can retry with their
  // input intact (#767) — closing it in `finally` made every failure look like a reset.
  const runDialogAction = useCallback(
    async <T>(
      runner: () => Promise<T>,
      onSuccessKey: string,
      onErrorKey: string,
      closeDialog: () => void,
      onSuccess?: (value: T) => void,
    ): Promise<boolean> => {
      try {
        const value = await runner();
        onSuccess?.(value);
        showSuccess(t(onSuccessKey) || onSuccessKey);
        closeDialog();
        return true;
      } catch (err) {
        showError((err as Error).message || t(onErrorKey) || onErrorKey);
        return false;
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

  // The payment dialog owns its form state and its failure display, so the hook rethrows
  // here: the dialog's catch keeps the dialog open with the entered tender intact, while
  // `isMutating` locks the confirm button against a double submit (#767). Success closes.
  const handleAddPayment = useCallback(
    async (paymentData: AddPaymentRequest) => {
      if (!selectedOrder) return;
      setIsMutating(true);
      try {
        const updated = await mutations.addPayment(selectedOrder.id, paymentData);
        setSelectedOrderId(updated.id);
        showSuccess(t('cashier.payment_added') || 'cashier.payment_added');
        setShowPaymentModal(false);
      } finally {
        setIsMutating(false);
      }
    },
    [selectedOrder, mutations, showSuccess, t],
  );

  const handleRefund = useCallback(
    async (paymentId: string, amount: number, reason: string) => {
      if (!selectedOrder) return;
      await runDialogAction(
        () => mutations.refundPayment(selectedOrder.id, paymentId, amount, reason),
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

  const { handleQuickConfirm, handleQuickCancel } = useCashierQuickActions({
    refreshOrders: mutations.refreshOrders,
    showSuccess,
    showError,
  });

  return {
    selectedOrderId,
    selectedOrder,
    setSelectedOrderId,
    successMessage,
    errorMessage,
    isMutating,
    showSuccess,
    showError,
    showStatusDialog,
    showPaymentModal,
    showRefundDialog,
    showCancelDialog,
    showFocusDialog,
    setShowStatusDialog,
    setShowPaymentModal,
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
