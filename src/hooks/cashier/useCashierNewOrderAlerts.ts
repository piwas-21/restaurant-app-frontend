'use client';

// New-order alerts for the orders workspace (order confirmation flows, plan S2): the workspace's
// SSE stream already refreshes the queue, so the ONLY job left here is the attention signal —
// the configured notification sound, once per newly arrived Pending order. Deliberately NOT the
// deleted legacy behaviour: no modal auto-open, no focus takeover, no auto-print, no viewport
// flash. The cashier keeps whatever they are doing; the queue itself shows the new row.
import { useEffect, useRef } from 'react';
import type { OrderDto } from '@/types/order';

const MAX_SEEN_ORDER_IDS = 1000;

export interface UseCashierNewOrderAlertsOptions {
  readonly orders: OrderDto[];
  /** True until the initial REST queue settles; that snapshot is the no-alert baseline. */
  readonly isInitialLoading: boolean;
  /** The configured sound + visible toast. */
  readonly notifyNewOrder: (orderNumber: string, customerName: string) => void;
}

/**
 * Diffs the orders array against a seen-id set and plays the notification sound for every
 * newly arrived Pending order. Orders seen while the grace window is open (and every order's
 * STATUS change afterwards) are never re-announced.
 */
function rememberSeen(seen: Set<string>, orderId: string): void {
  seen.add(orderId);
  while (seen.size > MAX_SEEN_ORDER_IDS) {
    const oldest = seen.values().next().value;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
}

export function useCashierNewOrderAlerts({
  orders,
  isInitialLoading,
  notifyNewOrder,
}: UseCashierNewOrderAlertsOptions): void {
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      // Baseline the actual initial REST result, not an arbitrary time window. When loading has
      // settled, the very next unseen id is a genuine SSE/poll arrival and alerts immediately.
      orders.forEach((order) => rememberSeen(seenOrderIdsRef.current, order.id));
      if (!isInitialLoading) initializedRef.current = true;
      return;
    }

    const unseen = orders.filter((order) => !seenOrderIdsRef.current.has(order.id));
    // Mark EVERY new id as seen before selecting alertable work. Otherwise an order first observed
    // as Confirmed and later edited back to Pending would masquerade as a new arrival.
    unseen.forEach((order) => rememberSeen(seenOrderIdsRef.current, order.id));
    unseen
      .filter((order) => order.status === 'Pending')
      .forEach((order) => notifyNewOrder(order.orderNumber || order.id, order.customerName || ''));
    // notifyNewOrder is a useCallback in useNotification; re-announcing on its identity change
    // would double-play a sound for the same order — the seen-set is the actual contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoading, orders]);
}
