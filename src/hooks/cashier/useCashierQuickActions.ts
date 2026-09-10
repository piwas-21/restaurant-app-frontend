'use client';

import { useCallback } from 'react';
import { quickConfirmOrder, quickCancelOrder } from '@/services/cashierService';

interface QuickActionDeps {
  refreshOrders: () => Promise<boolean>;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

/**
 * The two quick actions the incoming-order modal offers (accept with a preparation time,
 * cancel). They rethrow after surfacing the toast so the modal can keep its own context —
 * extracted from useCashierDialogs to keep that hook within the §4 hook limit.
 */
export function useCashierQuickActions(deps: QuickActionDeps) {
  const { refreshOrders, showSuccess, showError } = deps;

  const runQuickAction = useCallback(
    async (action: () => Promise<void>, success: string, fallback: string) => {
      try {
        await action();
        await refreshOrders();
        showSuccess(success);
      } catch (err) {
        showError((err as Error).message || fallback);
        throw err;
      }
    },
    [refreshOrders, showSuccess, showError],
  );

  const handleQuickConfirm = useCallback(
    (orderNumber: string, preparationMinutes: number) =>
      runQuickAction(
        () => quickConfirmOrder(orderNumber, preparationMinutes),
        `Order ${orderNumber} confirmed with ${preparationMinutes} min preparation time`,
        'Failed to confirm order',
      ),
    [runQuickAction],
  );

  const handleQuickCancel = useCallback(
    (orderNumber: string) =>
      runQuickAction(
        () => quickCancelOrder(orderNumber),
        `Order ${orderNumber} has been cancelled`,
        'Failed to cancel order',
      ),
    [runQuickAction],
  );

  return { handleQuickConfirm, handleQuickCancel };
}
