'use client';

import { useEffect, useRef, useState } from 'react';
import { getOrderById } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';

export interface CashierOrderSelection {
  readonly order: OrderDto | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

type OrderWithVersion = OrderDto & { readonly version?: unknown };

function queueFingerprint(order: OrderDto | null): string {
  if (!order) return '';
  const candidate = order as OrderWithVersion;
  const version =
    typeof candidate.version === 'string' || typeof candidate.version === 'number' ? String(candidate.version) : '';
  const payments = (order.payments ?? [])
    .map((payment) => `${payment.id}:${payment.status}:${payment.amount}:${payment.refundedAmount ?? ''}`)
    .join(',');
  return [
    order.id.toLowerCase(),
    version || order.updatedAt || '',
    order.status,
    order.paymentStatus,
    order.total,
    order.totalPaid,
    order.remainingAmount,
    order.isFullyPaid,
    // Focus flips are invisible to money/status identity; without this the focused detail
    // would keep showing the pre-toggle state after a ticket action (see CashierTicketActions).
    order.isFocusOrder === true,
    payments,
  ].join('|');
}

/** Resolves a deep-linked order and refreshes it when queue money/status identity changes. */
export function useCashierOrderSelection(
  orders: readonly OrderDto[],
  selectedOrderId: string | null,
): CashierOrderSelection {
  const [fetchedOrder, setFetchedOrder] = useState<OrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const queueOrder = selectedOrderId
    ? (orders.find((candidate) => candidate.id.toLowerCase() === selectedOrderId.toLowerCase()) ?? null)
    : null;
  const fingerprint = queueFingerprint(queueOrder);

  useEffect(() => {
    let alive = true;
    const requestId = ++requestRef.current;
    if (!selectedOrderId) {
      setFetchedOrder(null);
      setError(null);
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    setFetchedOrder(null);
    setIsLoading(true);
    setError(null);
    void getOrderById(selectedOrderId)
      .then((result) => {
        if (alive && requestId === requestRef.current) setFetchedOrder(result);
      })
      .catch((reason: unknown) => {
        if (!alive || requestId !== requestRef.current) return;
        setFetchedOrder(null);
        setError(getErrorMessage(reason) ?? 'cashier.workspace.order_unavailable');
      })
      .finally(() => {
        if (alive && requestId === requestRef.current) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [fingerprint, selectedOrderId]);

  return { order: fetchedOrder ?? queueOrder, isLoading, error };
}
