'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import ReservationCalendar from '@/components/admin/reservations/ReservationCalendar';
import { ReservationsHeader } from '@/components/admin/reservations/ReservationsHeader';
import { ReservationsFilters } from '@/components/admin/reservations/ReservationsFilters';
import { ReservationsStats } from '@/components/admin/reservations/ReservationsStats';
import { ReservationsActions } from '@/components/admin/reservations/ReservationsActions';
import { ReservationsList } from '@/components/admin/reservations/ReservationsList';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';
import ReservationsPaginationFooter from '@/components/admin/reservations/ReservationsPaginationFooter';
import { useAdminReservationsData } from '@/hooks/admin/useAdminReservationsData';
import { useAdminReservationMutations } from '@/hooks/admin/useAdminReservationMutations';
import { useReservationsBulkSelection } from '@/hooks/admin/useReservationsBulkSelection';
import { useConfirmAndResultModals } from '@/hooks/admin/useConfirmAndResultModals';
import styles from './styles.module.css';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;
type ViewMode = 'list' | 'calendar';

export default function AdminReservationsManagementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const data = useAdminReservationsData({ isReady: Boolean(user) && !authLoading });
  const bulk = useReservationsBulkSelection();
  const modals = useConfirmAndResultModals();
  const mutations = useAdminReservationMutations({
    refetch: data.fetchData,
    selectedIds: bulk.selectedIds,
    clearSelection: bulk.clearSelection,
    filteredReservations: data.filteredReservations,
    requestConfirm: modals.requestConfirm,
    showResult: modals.showResult,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Auth gate — page handles redirect; the data hook waits on `isReady`.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (user.role !== 'Admin' && user.role !== 'Staff') {
      router.push('/');
      enqueueSnackbar(t('access_denied', 'Access denied. Admin privileges required.'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    }
  }, [user, authLoading, router, enqueueSnackbar, t]);

  if (data.isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={64} className={styles.spinner} />
          <p>{t('loading_reservations', 'Loading reservations...')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <ReservationsHeader
          title={t('admin_reservations_management', 'Reservations Management')}
          subtitle={t('admin_reservations_desc', 'View and manage all table reservations')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={data.fetchData}
          listViewLabel={t('list_view', 'List View')}
          calendarViewLabel={t('calendar_view', 'Calendar View')}
          refreshLabel={t('refresh', 'Refresh')}
        />

        <ReservationsFilters
          searchQuery={data.filters.searchQuery}
          onSearchChange={data.setSearchQuery}
          selectedStatus={data.filters.selectedStatus}
          onStatusChange={data.handleStatusChange}
          selectedDate={data.filters.selectedDate}
          onDateChange={data.handleDateChange}
          selectedTableId={data.filters.selectedTableId}
          onTableChange={data.handleTableChange}
          tables={data.tables}
          searchPlaceholder={t('search_reservations', 'Search by name, email, phone, or table...')}
          allStatusesLabel={t('all_statuses', 'All Statuses')}
          statusLabels={{
            pending: t('status_pending', 'Pending'),
            confirmed: t('status_confirmed', 'Confirmed'),
            cancelled: t('status_cancelled', 'Cancelled'),
            completed: t('status_completed', 'Completed'),
            noShow: t('status_no_show', 'No Show'),
          }}
          allTablesLabel={t('all_tables', 'All Tables')}
          tableLabel={t('table', 'Table')}
        />

        <ReservationsStats
          total={data.allReservationsCount.total}
          pending={data.allReservationsCount.pending}
          confirmed={data.allReservationsCount.confirmed}
          totalLabel={t('total_reservations', 'Total')}
          pendingLabel={t('pending', 'Pending')}
          confirmedLabel={t('confirmed', 'Confirmed')}
        />

        <ReservationsActions
          selectedCount={bulk.selectedIds.size}
          onExportCSV={mutations.handleExportCSV}
          onExportPDF={mutations.handleExportPDF}
          onBulkConfirm={mutations.handleBulkConfirm}
          onBulkCancel={mutations.handleBulkCancel}
          onBulkDelete={mutations.handleBulkDelete}
          onClearSelection={bulk.clearSelection}
          exportCSVLabel={t('export_csv', 'Export CSV')}
          exportPDFLabel={t('export_pdf', 'Export PDF')}
          selectedLabel={t('selected', 'selected')}
          confirmSelectedLabel={t('confirm_selected', 'Confirm')}
          cancelSelectedLabel={t('cancel_selected', 'Cancel')}
          deleteSelectedLabel={t('delete_selected', 'Delete')}
          clearSelectionLabel={t('clear_selection', 'Clear Selection')}
        />

        {data.error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={20} />
            <p>{data.error}</p>
          </div>
        )}

        {viewMode === 'calendar' ? (
          <ReservationCalendar
            reservations={data.filteredReservations}
            onSelectReservation={(reservation) => bulk.toggleSelection(reservation.id)}
            selectedReservationIds={bulk.selectedIds}
          />
        ) : data.filteredReservations.length === 0 ? (
          <div className={styles.emptyState}>
            <Calendar size={64} className={styles.emptyIcon} />
            <h2>{t('no_reservations_found', 'No Reservations Found')}</h2>
            <p>{t('no_reservations_match_filters', 'No reservations match your current filters')}</p>
          </div>
        ) : (
          <ReservationsList
            reservations={data.filteredReservations}
            selectedReservationIds={bulk.selectedIds}
            onToggleSelection={bulk.toggleSelection}
            onConfirm={mutations.handleConfirm}
            onCancel={mutations.handleCancel}
            onDelete={mutations.handleDelete}
            tableLabel={t('table', 'Table')}
            guestsLabel={t('guests', 'guests')}
            specialRequestsLabel={t('special_requests', 'Special Requests')}
            confirmLabel={t('confirm', 'Confirm')}
            cancelLabel={t('cancel', 'Cancel')}
            deleteLabel={t('delete_reservation', 'Delete')}
          />
        )}

        {viewMode === 'list' && data.filteredReservations.length > 0 && (
          <ReservationsPaginationFooter
            currentPage={data.pagination.currentPage}
            totalPages={data.pagination.totalPages}
            totalCount={data.pagination.totalCount}
            pageSize={data.pagination.pageSize}
            isLoading={data.isLoading}
            onPageChange={data.pagination.handlePageChange}
          />
        )}
      </div>

      <ConfirmationModal
        isOpen={modals.confirmModal.isOpen}
        onClose={modals.closeConfirm}
        onConfirm={modals.confirmModal.onConfirm}
        message={modals.confirmModal.message}
      />

      <ResultModal
        isOpen={modals.resultModal.isOpen}
        onClose={modals.closeResult}
        message={modals.resultModal.message}
        isSuccess={modals.resultModal.isSuccess}
      />
    </main>
  );
}
