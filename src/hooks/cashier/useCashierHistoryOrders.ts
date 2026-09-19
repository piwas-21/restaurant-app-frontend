'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCashierOrders } from '@/services/cashierService';
import type { CashierQueueState } from '@/types/cashier';
import type { OrderDto, PagedResult } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import type { CashierHistoryQuery } from './cashierHistoryTypes';

export interface CashierHistoryQueue {
  readonly orders: OrderDto[];
  readonly pagination: PagedResult<OrderDto>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly queueState: CashierQueueState;
  readonly refreshOrders: () => Promise<boolean>;
}

interface HistoryQueueOptions {
  readonly enabled: boolean;
  readonly blockedState: 'loading' | 'unavailable';
}

const emptyPage = (query: CashierHistoryQuery): PagedResult<OrderDto> => ({
  items: [],
  totalCount: 0,
  page: query.page,
  pageSize: query.pageSize,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

/** Read-only History fetcher. It retains a usable snapshot and labels transport failures stale. */
export function useCashierHistoryOrders(
  query: CashierHistoryQuery,
  { enabled, blockedState }: HistoryQueueOptions,
): CashierHistoryQueue {
  const queryRef = useRef(query);
  queryRef.current = query;
  const [result, setResult] = useState<PagedResult<OrderDto>>(() => emptyPage(query));
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<CashierQueueState>(enabled ? 'loading' : blockedState);
  const hasSnapshot = useRef(false);
  const requestRef = useRef(0);

  const refreshOrders = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!enabled) {
      setIsLoading(blockedState === 'loading');
      setQueueState(blockedState);
      return false;
    }
    setIsLoading(true);
    try {
      const response = await getCashierOrders(queryRef.current);
      if (requestId !== requestRef.current) return false;
      setResult(response);
      setError(null);
      setQueueState('ready');
      setIsLoading(false);
      hasSnapshot.current = true;
      return true;
    } catch (reason: unknown) {
      if (requestId !== requestRef.current) return false;
      setError(getErrorMessage(reason) ?? 'cashier.workspace.history_unavailable');
      setQueueState(hasSnapshot.current ? 'stale' : 'unavailable');
      setIsLoading(false);
      return false;
    }
  }, [blockedState, enabled]);

  const fetchKey = JSON.stringify(query);
  useEffect(() => {
    if (!enabled) {
      requestRef.current += 1;
      hasSnapshot.current = false;
      setResult(emptyPage(queryRef.current));
      setError(null);
      setQueueState(blockedState);
      setIsLoading(blockedState === 'loading');
      return;
    }
    setIsLoading(true);
    void refreshOrders();
  }, [blockedState, enabled, fetchKey, refreshOrders]);

  return {
    orders: result.items,
    pagination: result,
    isLoading,
    error,
    queueState,
    refreshOrders,
  };
}
