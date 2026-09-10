'use client';

import { useMemo, useState } from 'react';

export const CASHIER_ORDERS_PAGE_SIZE = 50;

// Shared so a hook parameter default never needs a fresh object literal (S7737).
export const DEFAULT_QUEUE_QUERY: CashierOrdersQuery = {
  page: 1,
  pageSize: CASHIER_ORDERS_PAGE_SIZE,
};

export interface CashierOrdersQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  orderType?: string;
}

export interface UseCashierFiltersReturn {
  searchQuery: string;
  statusFilter: string;
  paymentStatusFilter: string;
  orderTypeFilter: string;
  query: CashierOrdersQuery;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setPaymentStatusFilter: (status: string) => void;
  setOrderTypeFilter: (type: string) => void;
  setPage: (page: number) => void;
}

/**
 * Owns the cashier queue's server-side filters and page. Changing a filter
 * returns to page one; the API receives every active filter rather than the
 * client filtering only whichever page happened to be loaded.
 */
export function useCashierFilters(): UseCashierFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const query = useMemo(
    () => ({
      page,
      pageSize: CASHIER_ORDERS_PAGE_SIZE,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(paymentStatusFilter !== 'all' ? { paymentStatus: paymentStatusFilter } : {}),
      ...(orderTypeFilter !== 'all' ? { orderType: orderTypeFilter } : {}),
    }),
    [orderTypeFilter, page, paymentStatusFilter, searchQuery, statusFilter],
  );

  return {
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    orderTypeFilter,
    query,
    setSearchQuery: resetPage(setSearchQuery),
    setStatusFilter: resetPage(setStatusFilter),
    setPaymentStatusFilter: resetPage(setPaymentStatusFilter),
    setOrderTypeFilter: resetPage(setOrderTypeFilter),
    setPage,
  };
}
