'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getOrders } from '@/services/orderService';
import type { OrderDto } from '@/types/order';
import { applyClientFilterAndSort, buildServerFilters } from './adminOrdersFilters';
import type { ClientFilterInputs, ServerFilterInputs } from './adminOrdersFilters';

interface Props {
  readonly isReady: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly filters: ServerFilterInputs & ClientFilterInputs;
  readonly setPage: (page: number) => void;
}

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;

export function useAdminOrdersQuery({ isReady, page, pageSize, filters, setPage }: Readonly<Props>) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    dateRangeEnd,
    dateRangeStart,
    searchQuery,
    selectedMarketplaceOnly,
    selectedOrderType,
    selectedPaymentStatus,
    selectedStatus,
    showFocusOnly,
    sortBy,
    sortOrder,
  } = filters;
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const fetchOrders = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      setIsLoading(true);
      setError('');
      const result = await getOrders(
        buildServerFilters({
          dateRangeEnd,
          dateRangeStart,
          page,
          pageSize,
          searchQuery,
          selectedMarketplaceOnly,
          selectedOrderType,
          selectedPaymentStatus,
          selectedStatus,
          showFocusOnly,
          sortBy,
          sortOrder,
        }),
      );
      if (requestId !== requestSequence.current) return;
      const lastPage = Math.max(1, result.totalPages);
      if (page > lastPage) {
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setPage(lastPage);
        return;
      }
      setOrders(applyClientFilterAndSort(result.items, { searchQuery, showFocusOnly, sortBy, sortOrder }));
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      console.error('Error fetching orders:', err);
      setError(t('failed_to_load_orders', 'Failed to load orders'));
      enqueueSnackbar(t('failed_to_load_orders', 'Failed to load orders'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [
    enqueueSnackbar,
    dateRangeEnd,
    dateRangeStart,
    searchQuery,
    selectedMarketplaceOnly,
    selectedOrderType,
    selectedPaymentStatus,
    selectedStatus,
    showFocusOnly,
    sortBy,
    sortOrder,
    page,
    pageSize,
    setPage,
    t,
  ]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (isReady) void fetchOrders();
  }, [fetchOrders, isReady]);

  return { orders, totalCount, totalPages, isLoading, error, setOrders, fetchOrders };
}
