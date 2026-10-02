'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { OrderStatus } from '@/types/order';
import { useOrderFilterPreferences } from '@/hooks/useOrderFilterPreferences';
import type { OrderPaymentStatusFilter } from '@/hooks/useOrderFilterPreferences';
import type { ClientFilterInputs, ServerFilterInputs } from './adminOrdersFilters';
import { useAdminOrdersQuery } from './useAdminOrdersQuery';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;
const DEFAULT_PAGE_SIZE = 20;

export interface AdminOrdersFilters {
  searchQuery: string;
  selectedStatus: OrderStatus | 'All';
  /** Typed, not `string`: this value goes STRAIGHT to the server as a query filter, and one the
   *  enum has no member for makes `Enum.TryParse` fail — which skips the clause and returns every
   *  order. `string` is what let `'Paid'` through. */
  selectedPaymentStatus: OrderPaymentStatusFilter;
  selectedOrderType: string;
  selectedMarketplaceOnly: boolean;
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

/** Orders view filters, preferences and pagination. */
export function useAdminOrdersData({ isReady }: UseAdminOrdersDataOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { preferences, isLoaded, savePreferences, clearPreferences } = useOrderFilterPreferences();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All'>(preferences.selectedStatus);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<OrderPaymentStatusFilter>(
    preferences.selectedPaymentStatus,
  );
  const [selectedOrderType, setSelectedOrderType] = useState<string>(preferences.selectedOrderType);
  const [selectedMarketplaceOnly, setSelectedMarketplaceOnly] = useState(false);
  const [showFocusOnly, setShowFocusOnly] = useState(preferences.showFocusOnly);
  const [dateRangeStart, setDateRangeStart] = useState<string | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>(preferences.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(preferences.sortOrder);

  const [currentPage, setCurrentPage] = useState(1);

  // Hydrate filters from saved prefs once the prefs hook reports ready.
  useEffect(() => {
    if (!isLoaded) return;
    setSelectedStatus(preferences.selectedStatus);
    setSelectedPaymentStatus(preferences.selectedPaymentStatus);
    setSelectedOrderType(preferences.selectedOrderType);
    setShowFocusOnly(preferences.showFocusOnly);
    setSortBy(preferences.sortBy);
    setSortOrder(preferences.sortOrder);
    // Hydrate once so preference updates cannot overwrite the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Persist the filter subset shared across admin order views.
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

  const serverFilters: ServerFilterInputs & ClientFilterInputs = {
    selectedStatus,
    selectedPaymentStatus,
    selectedOrderType,
    selectedMarketplaceOnly,
    showFocusOnly,
    dateRangeStart,
    dateRangeEnd,
    searchQuery,
    sortBy,
    sortOrder,
  };
  const query = useAdminOrdersQuery({
    isReady,
    page: currentPage,
    pageSize: DEFAULT_PAGE_SIZE,
    filters: serverFilters,
    setPage: setCurrentPage,
  });

  const hasActiveFilters = Boolean(
    selectedStatus !== 'All' ||
    selectedPaymentStatus !== 'All' ||
    selectedOrderType !== 'All' ||
    selectedMarketplaceOnly ||
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
    setSelectedMarketplaceOnly(false);
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
    setCurrentPage(1);
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  const updateSearchQuery = (value: string) => {
    setCurrentPage(1);
    setSearchQuery(value);
  };
  const updateSelectedStatus = (value: OrderStatus | 'All') => {
    setCurrentPage(1);
    setSelectedStatus(value);
  };
  const updateSelectedPaymentStatus = (value: OrderPaymentStatusFilter) => {
    setCurrentPage(1);
    setSelectedPaymentStatus(value);
  };
  const updateSelectedOrderType = (value: string) => {
    setCurrentPage(1);
    setSelectedOrderType(value);
  };
  const updateSelectedMarketplaceOnly = (value: boolean) => {
    setCurrentPage(1);
    setSelectedMarketplaceOnly(value);
  };
  const updateShowFocusOnly = (value: boolean) => {
    setCurrentPage(1);
    setShowFocusOnly(value);
  };

  return {
    orders: query.orders,
    totalCount: query.totalCount,
    paginatedOrders: query.orders,
    isLoading: query.isLoading,
    error: query.error,
    setOrders: query.setOrders,
    fetchOrders: query.fetchOrders,
    currentPage,
    setCurrentPage,
    totalPages: query.totalPages,
    hasActiveFilters,
    handleDateRangeChange,
    handleClearFilters,
    handleSortChange,
    filters: {
      searchQuery,
      selectedStatus,
      selectedPaymentStatus,
      selectedOrderType,
      selectedMarketplaceOnly,
      showFocusOnly,
      dateRangeStart,
      dateRangeEnd,
      sortBy,
      sortOrder,
    },
    setSearchQuery: updateSearchQuery,
    setSelectedStatus: updateSelectedStatus,
    setSelectedPaymentStatus: updateSelectedPaymentStatus,
    setSelectedOrderType: updateSelectedOrderType,
    setSelectedMarketplaceOnly: updateSelectedMarketplaceOnly,
    setShowFocusOnly: updateShowFocusOnly,
  };
}
