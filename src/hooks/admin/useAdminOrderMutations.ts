'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { updateOrderStatus, toggleFocusOrder, deleteOrder } from '@/services/orderService';
import { OrderDto, OrderStatus, UpdateOrderStatusCommand, ToggleFocusOrderCommand } from '@/types/order';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;

export interface UseAdminOrderMutationsOptions {
  /** Re-fetch the orders list after a single mutation finishes. */
  refetch: () => Promise<void> | void;
  /** Snapshot of currently-selected order IDs (for bulk status updates). */
  selectedOrders: () => OrderDto[];
  /** Clear bulk selection after the bulk update finishes. */
  clearSelection: () => void;
}

/**
 * Mutation handlers for the admin orders page (single + bulk status,
 * focus toggle, delete). Each handler shows a snackbar for success and
 * re-fetches via the `refetch` callback so the page stays an orchestrator.
 */
export function useAdminOrderMutations({ refetch, selectedOrders, clearSelection }: UseAdminOrderMutationsOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [isUpdatingBulkStatus, setIsUpdatingBulkStatus] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState({ current: 0, total: 0 });

  const handleUpdateStatus = async (order: OrderDto, status: OrderStatus, notes: string) => {
    const command: UpdateOrderStatusCommand = { newStatus: status, notes: notes || undefined };
    await updateOrderStatus(order.id, command);
    enqueueSnackbar(t('order_status_updated', 'Order status updated successfully'), {
      variant: 'success',
      anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
    });
    await refetch();
  };

  const handleToggleFocus = async (order: OrderDto, isFocusOrder: boolean, priority?: number, reason?: string) => {
    const command: ToggleFocusOrderCommand = { isFocusOrder, priority, focusReason: reason };
    await toggleFocusOrder(order.id, command);
    enqueueSnackbar(
      isFocusOrder ? t('focus_added', 'Order marked as focus') : t('focus_removed', 'Order removed from focus'),
      { variant: 'success', anchorOrigin: SNACKBAR_BOTTOM_RIGHT },
    );
    await refetch();
  };

  const handleDeleteOrder = async (order: OrderDto) => {
    try {
      await deleteOrder(order.id);
      enqueueSnackbar(t('order_deleted_success', 'Order deleted successfully'), {
        variant: 'success',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
      await refetch();
    } catch {
      enqueueSnackbar(t('order_delete_failed', 'Failed to delete order'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    }
  };

  const handleBulkStatusUpdate = async (status: OrderStatus, notes: string) => {
    setIsUpdatingBulkStatus(true);
    const targets = selectedOrders();
    const total = targets.length;
    let successCount = 0;
    let failCount = 0;

    setBulkUpdateProgress({ current: 0, total });

    for (let i = 0; i < targets.length; i++) {
      try {
        await updateOrderStatus(targets[i].id, { newStatus: status, notes });
        successCount++;
      } catch {
        failCount++;
      }
      setBulkUpdateProgress({ current: i + 1, total });
    }

    setIsUpdatingBulkStatus(false);
    await refetch();
    clearSelection();

    if (failCount === 0) {
      enqueueSnackbar(`Successfully updated ${successCount} order${successCount > 1 ? 's' : ''}`, {
        variant: 'success',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    } else {
      enqueueSnackbar(`Updated ${successCount} orders, ${failCount} failed`, {
        variant: 'warning',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    }
  };

  return {
    isUpdatingBulkStatus,
    bulkUpdateProgress,
    handleUpdateStatus,
    handleToggleFocus,
    handleDeleteOrder,
    handleBulkStatusUpdate,
  };
}
