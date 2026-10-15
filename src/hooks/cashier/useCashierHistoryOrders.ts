'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dismissPriorDayOrderReview, getCashierDailyArchive, getCashierOrders } from '@/services/cashierService';
import type { CashierQueueState } from '@/types/cashier';
import type { OrderDto, PagedResult } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import type { CashierHistoryQuery } from './cashierHistoryTypes';
import { emptyCashierHistoryPage, toCashierDailyArchiveQuery } from './cashierHistoryArchiveQuery';

export interface CashierHistoryQueue {
  readonly orders: OrderDto[];
  readonly pagination: PagedResult<OrderDto>;
  readonly priorDayUnresolvedOrders: PagedResult<OrderDto>;
  readonly dismissPriorDayOrder: (orderId: string) => Promise<void>;
  readonly dismissingOrderId: string | null;
  readonly dismissError: string | null;
  readonly priorDayError: string | null;
  readonly isLoadingPriorDayPage: boolean;
  readonly hasMorePriorDayOrders: boolean;
  readonly loadMorePriorDayOrders: () => Promise<void>;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly queueState: CashierQueueState;
  readonly refreshOrders: () => Promise<boolean>;
}

interface HistoryQueueOptions {
  readonly enabled: boolean;
  readonly blockedState: 'loading' | 'unavailable';
}

/** Read-only History fetcher. It retains a usable snapshot and labels transport failures stale. */
export function useCashierHistoryOrders(
  query: CashierHistoryQuery,
  { enabled, blockedState }: HistoryQueueOptions,
): CashierHistoryQueue {
  const queryRef = useRef(query);
  queryRef.current = query;
  const [result, setResult] = useState<PagedResult<OrderDto>>(() => emptyCashierHistoryPage(query));
  const [priorDayResult, setPriorDayResult] = useState<PagedResult<OrderDto>>(() => emptyCashierHistoryPage(query));
  const [dismissingOrderId, setDismissingOrderId] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [priorDayError, setPriorDayError] = useState<string | null>(null);
  const [isLoadingPriorDayPage, setIsLoadingPriorDayPage] = useState(false);
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
      const currentQuery = queryRef.current;
      const response = currentQuery.archiveBusinessDate
        ? await getCashierDailyArchive(toCashierDailyArchiveQuery(currentQuery))
        : await getCashierOrders(currentQuery);
      if (requestId !== requestRef.current) return false;
      if (currentQuery.archiveBusinessDate) {
        const archive = response as Awaited<ReturnType<typeof getCashierDailyArchive>>;
        setResult(archive.orders);
        setPriorDayResult(archive.priorDayUnresolvedOrders);
        setPriorDayError(null);
      } else {
        setResult(response as PagedResult<OrderDto>);
        setPriorDayResult(emptyCashierHistoryPage(currentQuery));
      }
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

  const loadMorePriorDayOrders = useCallback(async () => {
    const currentQuery = queryRef.current;
    if (!enabled || !currentQuery.archiveBusinessDate || isLoadingPriorDayPage || !priorDayResult.hasNextPage) return;
    const requestedPage = priorDayResult.page + 1;
    const queryKey = JSON.stringify(currentQuery);
    setIsLoadingPriorDayPage(true);
    setPriorDayError(null);
    try {
      const archive = await getCashierDailyArchive(toCashierDailyArchiveQuery(currentQuery, requestedPage));
      if (JSON.stringify(queryRef.current) !== queryKey) return;
      setPriorDayResult((current) => {
        const merged = new Map(current.items.map((order) => [order.id, order]));
        archive.priorDayUnresolvedOrders.items.forEach((order) => merged.set(order.id, order));
        return { ...archive.priorDayUnresolvedOrders, items: Array.from(merged.values()) };
      });
    } catch (reason: unknown) {
      setPriorDayError(getErrorMessage(reason) ?? 'cashier.workspace.history_unavailable');
    } finally {
      setIsLoadingPriorDayPage(false);
    }
  }, [enabled, isLoadingPriorDayPage, priorDayResult.hasNextPage, priorDayResult.page]);

  const dismissPriorDayOrder = useCallback(
    async (orderId: string) => {
      const requestQueryKey = JSON.stringify(queryRef.current);
      setDismissingOrderId(orderId);
      setDismissError(null);
      try {
        await dismissPriorDayOrderReview(orderId);
        setPriorDayResult((current) => {
          const items = current.items.filter((order) => order.id !== orderId);
          return { ...current, items, totalCount: Math.max(0, current.totalCount - 1) };
        });
      } catch (reason: unknown) {
        setDismissError(getErrorMessage(reason) ?? 'cashier.workspace.prior_day_dismiss_failed');
        throw reason;
      } finally {
        setDismissingOrderId(null);
      }

      // Offset paging shifts every later row left after a dismissal. Reload page one so the next
      // "Load more" starts at the server's new page two instead of skipping the former first row.
      const currentQuery = queryRef.current;
      if (!enabled || !currentQuery.archiveBusinessDate || JSON.stringify(currentQuery) !== requestQueryKey) return;
      setIsLoadingPriorDayPage(true);
      setPriorDayError(null);
      try {
        const archive = await getCashierDailyArchive(toCashierDailyArchiveQuery(currentQuery, 1));
        if (JSON.stringify(queryRef.current) === requestQueryKey) {
          setPriorDayResult(archive.priorDayUnresolvedOrders);
        }
      } catch (reason: unknown) {
        setPriorDayError(getErrorMessage(reason) ?? 'cashier.workspace.history_unavailable');
      } finally {
        setIsLoadingPriorDayPage(false);
      }
    },
    [enabled],
  );

  const fetchKey = JSON.stringify(query);
  useEffect(() => {
    if (!enabled) {
      requestRef.current += 1;
      hasSnapshot.current = false;
      setResult(emptyCashierHistoryPage(queryRef.current));
      setPriorDayResult(emptyCashierHistoryPage(queryRef.current));
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
    priorDayUnresolvedOrders: priorDayResult,
    dismissPriorDayOrder,
    dismissingOrderId,
    dismissError,
    priorDayError,
    isLoadingPriorDayPage,
    hasMorePriorDayOrders: priorDayResult.hasNextPage,
    loadMorePriorDayOrders,
    isLoading,
    error,
    queueState,
    refreshOrders,
  };
}
