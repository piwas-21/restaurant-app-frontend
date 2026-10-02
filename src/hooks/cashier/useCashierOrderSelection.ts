'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderById } from '@/services/cashierService';
import type { OrderDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { channelOrderReviewFingerprint } from '@/utils/channelOrderReviewFingerprint';

export interface CashierOrderSelection {
  readonly order: OrderDto | null;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly error: string | null;
  readonly isSnapshotFresh: boolean;
  readonly refresh: () => void;
}

interface LoadedSelection {
  readonly id: string;
  readonly fingerprint: string;
  readonly refreshGeneration: number;
  readonly order: OrderDto;
}

type RequestState =
  | { readonly key: string; readonly state: 'loading' | 'loaded' }
  | { readonly key: string; readonly state: 'failed'; readonly error: string };

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
    channelOrderReviewFingerprint(order),
  ].join('|');
}

/** Resolves a deep-linked order and refreshes it when queue money/status identity changes. */
export function useCashierOrderSelection(
  orders: readonly OrderDto[],
  selectedOrderId: string | null,
): CashierOrderSelection {
  const [loaded, setLoaded] = useState<LoadedSelection | null>(null);
  const [requestState, setRequestState] = useState<RequestState | null>(null);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const requestRef = useRef(0);
  const selectedId = selectedOrderId?.toLowerCase() ?? '';
  const queueOrder = selectedOrderId
    ? (orders.find((candidate) => candidate.id.toLowerCase() === selectedOrderId.toLowerCase()) ?? null)
    : null;
  const fingerprint = queueFingerprint(queueOrder);
  const requestKey = selectedId ? `${selectedId}|${fingerprint}|${refreshGeneration}` : '';
  const currentRequest = requestState?.key === requestKey ? requestState : null;
  const hasLoadedSelection = loaded?.id === selectedId;
  const order = hasLoadedSelection ? latestAvailableOrder(loaded.order, queueOrder) : queueOrder;
  const error = currentRequest?.state === 'failed' ? currentRequest.error : null;
  const isLoading = Boolean(selectedId) && !hasLoadedSelection && currentRequest?.state !== 'failed';
  const isRefreshing = Boolean(hasLoadedSelection) && (currentRequest?.state ?? 'loading') === 'loading';
  const isSnapshotFresh = Boolean(hasLoadedSelection) && currentRequest?.state === 'loaded';
  const refresh = useCallback(() => setRefreshGeneration((generation) => generation + 1), []);

  useEffect(() => {
    let alive = true;
    const requestId = ++requestRef.current;
    if (!selectedOrderId) {
      setLoaded(null);
      setRequestState(null);
      return () => {
        alive = false;
      };
    }

    const normalizedId = selectedOrderId.toLowerCase();
    setRequestState({ key: requestKey, state: 'loading' });
    void getOrderById(selectedOrderId)
      .then((result) => {
        if (!alive || requestId !== requestRef.current) return;
        setLoaded({ id: normalizedId, fingerprint, refreshGeneration, order: result });
        setRequestState({ key: requestKey, state: 'loaded' });
      })
      .catch((reason: unknown) => {
        if (!alive || requestId !== requestRef.current) return;
        setRequestState({
          key: requestKey,
          state: 'failed',
          error: getErrorMessage(reason) ?? 'cashier.workspace.order_unavailable',
        });
      });

    return () => {
      alive = false;
    };
  }, [fingerprint, refreshGeneration, requestKey, selectedOrderId]);

  return {
    order: error && !hasLoadedSelection ? null : order,
    isLoading,
    isRefreshing,
    error,
    isSnapshotFresh,
    refresh,
  };
}

function latestAvailableOrder(loadedOrder: OrderDto, queueOrder: OrderDto | null): OrderDto {
  if (queueOrder && queueOrder.version > loadedOrder.version) return queueOrder;
  return loadedOrder;
}
