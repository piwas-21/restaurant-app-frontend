'use client';

import { Dispatch, SetStateAction, useCallback } from 'react';
import { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * The one shape all five cashier mutations share: call the API, merge the order it returns into
 * the list already on screen, and put the server's own sentence into `error` when it refuses.
 *
 * Extracted from `useCashierOrders` (E9 slice 8) because that file crossed the §4 hook limit once
 * `refreshOrders` had to explain its return value. Nothing about the behaviour changed: it takes
 * the two setters rather than closing over state, so it holds no values of its own and cannot go
 * stale between renders — the failure mode an extraction from a hook invites.
 *
 * It RETHROWS. The error is already on screen via `setError`; the throw is what lets a caller that
 * awaited a specific mutation (a dialog, say) know not to report success — the distinction
 * `refreshOrders` had to grow a boolean for, because it resolves on both paths.
 */
export function useCashierOrderMutation(
  setOrders: Dispatch<SetStateAction<OrderDto[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  return useCallback(
    async (orderId: string, mutate: () => Promise<OrderDto>, errorFallback: string): Promise<OrderDto> => {
      try {
        const updatedOrder = await mutate();
        let mergedOrder: OrderDto | undefined;
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            mergedOrder = { ...order, ...updatedOrder };
            return mergedOrder;
          }),
        );
        return mergedOrder || updatedOrder;
      } catch (err) {
        setError(getErrorMessage(err) ?? errorFallback);
        throw err;
      }
    },
    [setOrders, setError],
  );
}

export default useCashierOrderMutation;
