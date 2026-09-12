'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import { AddPaymentRequest } from '@/services/cashierService';
import { useCashierPaymentAction } from './useCashierPaymentAction';
import { useCashierQuickActions } from './useCashierQuickActions';

const SUCCESS_MESSAGE_TIMEOUT_MS = 3000;
const ERROR_MESSAGE_TIMEOUT_MS = 5000;

export interface CashierMutations {
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  /** Optional for tests and older queue owners; the reconciliation hook falls back to its typed service. */
  reconcilePayment?: (orderId: string, operationId: string) => Promise<PaymentOperationLookupDto>;
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
  const [showRefundModal, setShowRefundModal] = useState(false);

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

  const paymentAction = useCashierPaymentAction({
    selectedOrder,
    addPayment: mutations.addPayment,
    reconcilePayment: mutations.reconcilePayment,
    showPaymentModal,
    setShowPaymentModal,
    setSelectedOrderId,
    showSuccess,
    showError,
    t,
  });

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
      setIsMutating(true);
      try {
        const value = await runner();
        onSuccess?.(value);
        showSuccess(t(onSuccessKey) || onSuccessKey);
        closeDialog();
        return true;
      } catch (err) {
        showError((err as Error).message || t(onErrorKey) || onErrorKey);
        return false;
      } finally {
        setIsMutating(false);
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

  const handleRefund = useCallback(
    async (paymentId: string, amount: number, reason: string) => {
      if (!selectedOrder) return;
      const succeeded = await runDialogAction(
        () => mutations.refundPayment(selectedOrder.id, paymentId, amount, reason),
        'cashier.refund_completed',
        'cashier.refund_failed',
        () => setShowRefundModal(false),
        (updated) => setSelectedOrderId(updated.id),
      );
      if (!succeeded) throw new Error(t('cashier.refund_failed'));
    },
    [selectedOrder, mutations, runDialogAction, t],
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
    isMutating: isMutating || paymentAction.isMutating,
    isCheckingPayment: paymentAction.isCheckingPayment,
    showSuccess,
    showError,
    showStatusDialog,

    showPaymentModal,
    showRefundModal,
    showCancelDialog,
    showFocusDialog,
    setShowStatusDialog,
    setShowPaymentModal,
    setShowRefundModal,

    setShowCancelDialog,
    setShowFocusDialog,
    handleStatusChange,
    handleAddPayment: paymentAction.handleAddPayment,
    handleRefund,
    handleCancelOrder,
    handleToggleFocus,
    handleQuickConfirm,
    handleQuickCancel,
  };
}
