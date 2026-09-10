'use client';

import { useMemo, useState } from 'react';

export const CASHIER_ORDERS_PAGE_SIZE = 50;

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
  const [searchQuery, setSearchQueryState] = useState('');
  const [statusFilter, setStatusFilterState] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilterState] = useState('all');
  const [orderTypeFilter, setOrderTypeFilterState] = useState('all');
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
    setSearchQuery: resetPage(setSearchQueryState),
    setStatusFilter: resetPage(setStatusFilterState),
    setPaymentStatusFilter: resetPage(setPaymentStatusFilterState),
    setOrderTypeFilter: resetPage(setOrderTypeFilterState),
    setPage,
  };
}
