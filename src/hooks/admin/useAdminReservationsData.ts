'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { reservationService } from '@/services/reservationService';
import { ReservationDto, ReservationStatus, TableDto } from '@/types/reservation';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;
const DEFAULT_PAGE_SIZE = 20;

export interface UseAdminReservationsDataOptions {
  /** Wait until auth resolves; the parent page handles redirects. */
  isReady: boolean;
}

/**
 * Owns the reservations list, the small `tables` lookup used by the
 * filter dropdown, the all-time stats counts (computed from a separate
 * unfiltered fetch), filter state + pagination, and the search-only
 * client-side filter. Snackbar feedback for fetch errors lives here.
 */
export function useAdminReservationsData({ isReady }: UseAdminReservationsDataOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [tables, setTables] = useState<TableDto[]>([]);
  const [allReservationsCount, setAllReservationsCount] = useState({ total: 0, pending: 0, confirmed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReservationStatus | 'All'>('All');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('All');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = DEFAULT_PAGE_SIZE;

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      // All-time stats (no filters).
      const allRes = await reservationService.getReservations({});
      const items = allRes.items;
      setAllReservationsCount({
        total: items.length,
        pending: items.filter((r) => r.status === ReservationStatus.Pending).length,
        confirmed: items.filter((r) => r.status === ReservationStatus.Confirmed).length,
      });

      const params: Record<string, unknown> = { page: currentPage, pageSize };
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedDate) params.date = selectedDate;
      if (selectedTableId !== 'All') params.tableId = selectedTableId;

      const filteredRes = await reservationService.getReservations(params);
      setReservations(filteredRes.items);
      setTotalPages(filteredRes.totalPages || 1);
      setTotalCount(filteredRes.totalCount || 0);

      const tablesRes = await reservationService.getTables();
      setTables(tablesRes);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('failed_to_load_reservations', 'Failed to load reservations'));
      enqueueSnackbar(t('failed_to_load_reservations', 'Failed to load reservations'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, selectedStatus, selectedDate, selectedTableId, t, enqueueSnackbar]);

  useEffect(() => {
    if (!isReady) return;
    void fetchData();
    // Re-fetch when server-relevant filters or page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, selectedStatus, selectedDate, selectedTableId, currentPage]);

  // Client-side search filter (cheap; running over a single page of results).
  const filteredReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return reservations;
    return reservations.filter(
      (r) =>
        r.customerName.toLowerCase().includes(query) ||
        r.customerEmail.toLowerCase().includes(query) ||
        (r.customerPhone && r.customerPhone.toLowerCase().includes(query)) ||
        r.tableNumber.toLowerCase().includes(query),
    );
  }, [reservations, searchQuery]);

  const handleStatusChange = (status: ReservationStatus | 'All') => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1);
  };
  const handleTableChange = (tableId: string) => {
    setSelectedTableId(tableId);
    setCurrentPage(1);
  };
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    reservations,
    filteredReservations,
    tables,
    allReservationsCount,
    isLoading,
    error,
    fetchData,
    pagination: { currentPage, totalPages, totalCount, pageSize, handlePageChange },
    filters: { searchQuery, selectedStatus, selectedDate, selectedTableId },
    setSearchQuery,
    handleStatusChange,
    handleDateChange,
    handleTableChange,
  };
}
