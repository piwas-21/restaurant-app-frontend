'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrderListScope } from '@/types/order';

export const CASHIER_ORDERS_PAGE_SIZE = 50;
export const CASHIER_SEARCH_DEBOUNCE_MS = 300;
const MAX_BACKEND_INT = 2_147_483_647;

// Shared so a hook parameter default never needs a fresh object literal (S7737).
export const DEFAULT_QUEUE_QUERY: CashierOrdersQuery = {
  scope: 'Operational',
  page: 1,
  pageSize: CASHIER_ORDERS_PAGE_SIZE,
};

export interface CashierOrdersQuery {
  scope?: OrderListScope;
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  orderType?: string;
  tableNumber?: number;
  /** Kept for the API contract; operational reads do not use date bounds. */
  tenantDay?: string;
  startDate?: Date;
  endDate?: Date;
  modifiedSince?: Date;
}

export interface UseCashierFiltersReturn {
  searchQuery: string;
  statusFilter: string;
  paymentStatusFilter: string;
  orderTypeFilter: string;
  tableNumberFilter: string;
  query: CashierOrdersQuery;
  setSearchQuery: (query: string) => void;
  /** Commit the current search text immediately, without waiting for the debounce window. */
  submitSearch: () => void;
  setStatusFilter: (status: string) => void;
  setPaymentStatusFilter: (status: string) => void;
  setOrderTypeFilter: (type: string) => void;
  setTableNumberFilter: (tableNumber: string) => void;
  setPage: (page: number) => void;
}

function parseTableNumber(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;

  const tableNumber = Number(normalized);
  return Number.isSafeInteger(tableNumber) && tableNumber <= MAX_BACKEND_INT ? tableNumber : undefined;
}

/**
 * Owns the cashier queue's server-side filters and page. Search text is kept as a draft while the
 * request value is debounced, so typing does not issue one request per key. Enter/form submit uses
 * the same commit path immediately. All queue reads use the backend-owned Operational scope.
 */
export function useCashierFilters(): UseCashierFiltersReturn {
  const [searchQueryDraft, setSearchQueryDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const searchDraftRef = useRef('');
  const [statusFilterValue, setStatusFilterValue] = useState('all');
  const [paymentStatusFilterValue, setPaymentStatusFilterValue] = useState('all');
  const [orderTypeFilterValue, setOrderTypeFilterValue] = useState('all');
  const [tableNumberFilterValue, setTableNumberFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitSearch = useCallback((value: string) => {
    setSubmittedSearch(value.trim());
    setPage(1);
  }, []);

  const setSearchQuery = useCallback(
    (value: string) => {
      searchDraftRef.current = value;
      setSearchQueryDraft(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        searchTimerRef.current = null;
        commitSearch(value);
      }, CASHIER_SEARCH_DEBOUNCE_MS);
    },
    [commitSearch],
  );

  const submitSearch = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
    commitSearch(searchDraftRef.current);
  }, [commitSearch]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const setStatusFilter = useCallback((status: string) => {
    setStatusFilterValue(status);
    setPage(1);
  }, []);
  const setPaymentStatusFilter = useCallback((status: string) => {
    setPaymentStatusFilterValue(status);
    setPage(1);
  }, []);
  const setOrderTypeFilter = useCallback((type: string) => {
    setOrderTypeFilterValue(type);
    setPage(1);
  }, []);
  const setTableNumberFilter = useCallback((tableNumber: string) => {
    setTableNumberFilterValue(tableNumber);
    setPage(1);
  }, []);

  const query = useMemo<CashierOrdersQuery>(() => {
    const tableNumber = parseTableNumber(tableNumberFilterValue);
    return {
      scope: 'Operational',
      page,
      pageSize: CASHIER_ORDERS_PAGE_SIZE,
      ...(submittedSearch ? { search: submittedSearch } : {}),
      ...(statusFilterValue !== 'all' ? { status: statusFilterValue } : {}),
      ...(paymentStatusFilterValue !== 'all' ? { paymentStatus: paymentStatusFilterValue } : {}),
      ...(orderTypeFilterValue !== 'all' ? { orderType: orderTypeFilterValue } : {}),
      ...(tableNumber !== undefined ? { tableNumber } : {}),
    };
  }, [
    orderTypeFilterValue,
    page,
    paymentStatusFilterValue,
    statusFilterValue,
    submittedSearch,
    tableNumberFilterValue,
  ]);

  return {
    searchQuery: searchQueryDraft,
    statusFilter: statusFilterValue,
    paymentStatusFilter: paymentStatusFilterValue,
    orderTypeFilter: orderTypeFilterValue,
    tableNumberFilter: tableNumberFilterValue,
    query,
    setSearchQuery,
    submitSearch,
    setStatusFilter,
    setPaymentStatusFilter,
    setOrderTypeFilter,
    setTableNumberFilter,
    setPage,
  };
}
