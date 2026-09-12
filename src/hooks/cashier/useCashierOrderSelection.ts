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

/**
 * Resolves a deep-linked order independently of the current page. The queue may be filtered or
 * paginated, but a copied `/cashier/orders?order=...` link must still identify its ticket.
 */
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

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!selectedOrderId || queueOrder) {
      setFetchedOrder(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let alive = true;
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
  }, [queueOrder, selectedOrderId]);

  return { order: queueOrder ?? fetchedOrder, isLoading, error };
}
