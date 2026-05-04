'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getOrders } from '@/services/orderService';
import { OrderDto, OrderStatus } from '@/types/order';
import { useOrderFilterPreferences } from '@/hooks/useOrderFilterPreferences';
import { buildServerFilters, applyClientFilterAndSort } from './adminOrdersFilters';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;
const DEFAULT_PAGE_SIZE = 20;

export interface AdminOrdersFilters {
  searchQuery: string;
  selectedStatus: OrderStatus | 'All';
  selectedPaymentStatus: string;
  selectedOrderType: string;
  showFocusOnly: boolean;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

export interface UseAdminOrdersDataOptions {
  /** Wait until the auth context resolves; the parent page handles redirects. */
  isReady: boolean;
}

/**
 * Owns the orders list, filter/sort state (with localStorage persistence
 * via `useOrderFilterPreferences`), pagination math, and the fetch loop.
 * Snackbar feedback for fetch errors lives here too so the parent page
 * stays a thin orchestrator.
 */
export function useAdminOrdersData({ isReady }: UseAdminOrdersDataOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { preferences, isLoaded, savePreferences, clearPreferences } = useOrderFilterPreferences();

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>(preferences.selectedStatus);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>(preferences.selectedPaymentStatus);
  const [selectedOrderType, setSelectedOrderType] = useState<string>(preferences.selectedOrderType);
  const [showFocusOnly, setShowFocusOnly] = useState(preferences.showFocusOnly);
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>(preferences.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(preferences.sortOrder);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const result = await getOrders(
        buildServerFilters({
          selectedStatus,
          selectedPaymentStatus,
          selectedOrderType,
          dateRangeStart,
          dateRangeEnd,
        }),
      );
      setOrders(applyClientFilterAndSort(result.items, { searchQuery, showFocusOnly, sortBy, sortOrder }));
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(t('failed_to_load_orders', 'Failed to load orders'));
      enqueueSnackbar(t('failed_to_load_orders', 'Failed to load orders'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedStatus,
    selectedPaymentStatus,
    selectedOrderType,
    showFocusOnly,
    dateRangeStart,
    dateRangeEnd,
    searchQuery,
    sortBy,
    sortOrder,
    t,
    enqueueSnackbar,
  ]);

  // Hydrate filters from saved prefs once the prefs hook reports ready.
  useEffect(() => {
    if (!isLoaded) return;
    setSelectedStatus(preferences.selectedStatus);
    setSelectedPaymentStatus(preferences.selectedPaymentStatus);
    setSelectedOrderType(preferences.selectedOrderType);
    setShowFocusOnly(preferences.showFocusOnly);
    setSortBy(preferences.sortBy);
    setSortOrder(preferences.sortOrder);
    // Snapshot of preferences at hydrate-time only — listening on `preferences` would
    // re-overwrite local edits the user makes via the setters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Persist preferences whenever the persisted-relevant filters change.
  useEffect(() => {
    if (!isLoaded) return;
    savePreferences({
      selectedStatus,
      selectedPaymentStatus,
      selectedOrderType,
      showFocusOnly,
      sortBy,
      sortOrder,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, selectedPaymentStatus, selectedOrderType, showFocusOnly, sortBy, sortOrder]);

  // Re-fetch when filters change (auth-gated by `isReady`).
  useEffect(() => {
    if (!isReady) return;
    void fetchOrders();
    // The body filters that don't trigger a server fetch (search, sort) are
    // applied client-side inside fetchOrders; we still re-fetch only on the
    // filters that change the server query, matching pre-extraction behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedStatus, selectedPaymentStatus, selectedOrderType, showFocusOnly, dateRangeStart, dateRangeEnd]);

  const totalPages = Math.ceil(orders.length / pageSize);
  const paginatedOrders = useMemo(
    () => orders.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [orders, currentPage, pageSize],
  );

  const hasActiveFilters = Boolean(
    selectedStatus !== 'All' ||
    selectedPaymentStatus !== 'All' ||
    selectedOrderType !== 'All' ||
    showFocusOnly ||
    searchQuery.trim() ||
    dateRangeStart ||
    sortBy !== 'date' ||
    sortOrder !== 'desc',
  );

  const handleDateRangeChange = (startDate: string | null, endDate: string | null) => {
    setDateRangeStart(startDate);
    setDateRangeEnd(endDate);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setCurrentPage(1);
    clearPreferences();
    enqueueSnackbar(t('filters_cleared', 'All filters cleared'), {
      variant: 'info',
      anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
    });
  };

  const handleSortChange = (newSortBy: 'date' | 'amount', newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  return {
    orders,
    paginatedOrders,
    isLoading,
    error,
    setOrders,
    fetchOrders,
    currentPage,
    setCurrentPage,
    totalPages,
    hasActiveFilters,
    handleDateRangeChange,
    handleClearFilters,
    handleSortChange,
    filters: {
      searchQuery,
      selectedStatus,
      selectedPaymentStatus,
      selectedOrderType,
      showFocusOnly,
      dateRangeStart,
      dateRangeEnd,
      sortBy,
      sortOrder,
    },
    setSearchQuery,
    setSelectedStatus,
    setSelectedPaymentStatus,
    setSelectedOrderType,
    setShowFocusOnly,
  };
}
