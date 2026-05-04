'use client';

import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { reservationService } from '@/services/reservationService';
import { ReservationDto } from '@/types/reservation';
import { exportReservationsToCSV, exportReservationsToPDF } from '@/utils/reservationExportUtils';

const SNACKBAR_BOTTOM_RIGHT = { vertical: 'bottom', horizontal: 'right' } as const;

export interface UseAdminReservationMutationsOptions {
  /** Re-fetch the reservations list after a mutation. */
  refetch: () => Promise<void> | void;
  /** Selected IDs for bulk operations. */
  selectedIds: Set<string>;
  /** Clear bulk selection after a bulk op finishes. */
  clearSelection: () => void;
  /** Source list for export "selected vs all-filtered" disambiguation. */
  filteredReservations: ReservationDto[];
  /** Open a yes/no confirm modal; runs `onConfirm` on Yes. */
  requestConfirm: (message: string, onConfirm: () => void | Promise<void>) => void;
  /** Open the post-action result modal. */
  showResult: (message: string, isSuccess: boolean) => void;
}

/**
 * All single + bulk mutation handlers and the CSV/PDF export confirms.
 * Each handler wraps `requestConfirm` for the destructive ops; success
 * paths surface via `showResult` (modal) for destructive/exports and
 * via the in-page snackbar for non-destructive single confirms.
 */
export function useAdminReservationMutations({
  refetch,
  selectedIds,
  clearSelection,
  filteredReservations,
  requestConfirm,
  showResult,
}: UseAdminReservationMutationsOptions) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const handleConfirm = async (id: string) => {
    try {
      await reservationService.confirmReservation(id);
      enqueueSnackbar(t('reservation_confirmed', 'Reservation confirmed successfully'), {
        variant: 'success',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
      await refetch();
    } catch (err) {
      enqueueSnackbar((err as Error).message || t('failed_to_confirm', 'Failed to confirm reservation'), {
        variant: 'error',
        anchorOrigin: SNACKBAR_BOTTOM_RIGHT,
      });
    }
  };

  const handleCancel = (id: string) => {
    requestConfirm(t('confirm_cancel_reservation', 'Are you sure you want to cancel this reservation?'), async () => {
      try {
        await reservationService.cancelReservation(id);
        showResult(t('reservation_cancelled', 'Reservation cancelled successfully'), true);
        await refetch();
      } catch (err) {
        showResult((err as Error).message || t('failed_to_cancel', 'Failed to cancel reservation'), false);
      }
    });
  };

  const handleDelete = (id: string) => {
    requestConfirm(
      t(
        'confirm_delete_reservation',
        'Are you sure you want to permanently delete this reservation? This action cannot be undone.',
      ),
      async () => {
        try {
          await reservationService.deleteReservation(id);
          showResult(t('reservation_deleted_success', 'Reservation deleted successfully'), true);
          await refetch();
        } catch (err) {
          showResult(
            (err as Error).message || t('failed_to_delete_reservation', 'Failed to delete reservation'),
            false,
          );
        }
      },
    );
  };

  // Bulk helper: iterate selected IDs, run `op`, surface count summary via showResult.
  const runBulk = (
    confirmMessage: string,
    successKey: string,
    op: (id: string) => Promise<void>,
    failurePrefix: string,
  ) => {
    if (selectedIds.size === 0) return;
    requestConfirm(confirmMessage, async () => {
      let successCount = 0;
      for (const id of selectedIds) {
        try {
          await op(id);
          successCount++;
        } catch (err) {
          console.error(`${failurePrefix} ${id}:`, err);
        }
      }
      showResult(t(successKey, `${successKey} ${successCount} of ${selectedIds.size}`), successCount > 0);
      clearSelection();
      await refetch();
    });
  };

  const handleBulkConfirm = () =>
    runBulk(
      t('confirm_bulk_action', `Confirm ${selectedIds.size} reservations?`),
      'bulk_confirm_success',
      (id) => reservationService.confirmReservation(id),
      'Failed to confirm reservation',
    );

  const handleBulkCancel = () =>
    runBulk(
      t('confirm_bulk_cancel', `Cancel ${selectedIds.size} reservations?`),
      'bulk_cancel_success',
      (id) => reservationService.cancelReservation(id),
      'Failed to cancel reservation',
    );

  const handleBulkDelete = () =>
    runBulk(
      t('confirm_bulk_delete', `Permanently delete ${selectedIds.size} reservations?`),
      'bulk_delete_success',
      (id) => reservationService.deleteReservation(id),
      'Failed to delete reservation',
    );

  // Exports: confirm modal → run export → result modal. `dataToExport` is
  // either the selection (if any) or the full filtered list.
  const dataForExport = () =>
    selectedIds.size > 0 ? filteredReservations.filter((r) => selectedIds.has(r.id)) : filteredReservations;

  const runExport = (confirmKey: string, successKey: string, exporter: (data: ReservationDto[]) => void) => {
    const data = dataForExport();
    requestConfirm(t(confirmKey, `Export ${data.length} reservations?`), () => {
      try {
        exporter(data);
        showResult(t(successKey, `Successfully exported ${data.length} reservations`), true);
      } catch (err) {
        showResult(t('export_failed', `Failed to export: ${(err as Error).message}`), false);
      }
    });
  };

  const handleExportCSV = () => runExport('confirm_export_csv', 'exported_successfully', exportReservationsToCSV);
  const handleExportPDF = () => runExport('confirm_export_pdf', 'exported_successfully', exportReservationsToPDF);

  return {
    handleConfirm,
    handleCancel,
    handleDelete,
    handleBulkConfirm,
    handleBulkCancel,
    handleBulkDelete,
    handleExportCSV,
    handleExportPDF,
  };
}
