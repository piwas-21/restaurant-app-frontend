'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reservationService } from '@/services/reservationService';
import type { ReservationDto } from '@/types/reservation';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * State + actions for the /my-reservations page (extracted from the former
 * MyReservations component so the classic and craft templates can share one
 * orchestration — the ReservationsPageLayout/B2 pattern). Owns the list
 * fetch, the expand/collapse state and the cancel flow (confirm modal →
 * cancel call → success modal → refetch).
 */
export function useMyReservations() {
  const { t } = useTranslation();
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reservationService.getReservations();
      setReservations(result.items);
    } catch (err: unknown) {
      setError(errorMessage(err, t('my_reservations_error', 'Failed to load reservations')));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Mount-only initial load (codebase precedent for load-on-open hooks);
    // loadReservations has its own try/catch (sets error state) and reads the
    // render-scoped `t` only for the fallback message, so depending on it
    // would just refetch pointlessly on language change.
    void loadReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelReservation = async (id: string) => {
    setCancellingId(id);
    setCancelError(null);
    try {
      await reservationService.cancelReservation(id);
      setCancelTargetId(null);
      setShowCancelSuccess(true);
      void loadReservations();
    } catch (err: unknown) {
      setCancelError(errorMessage(err, t('my_reservations_cancel_error', 'Failed to cancel reservation')));
    } finally {
      setCancellingId(null);
    }
  };

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const closeCancelSuccess = useCallback(() => {
    setShowCancelSuccess(false);
    setCancelTargetId(null);
  }, []);

  return {
    t,
    reservations,
    loading,
    error,
    expandedId,
    toggleExpanded,
    cancellingId,
    cancelTargetId,
    openCancelModal: setCancelTargetId,
    closeCancelModal: useCallback(() => setCancelTargetId(null), []),
    cancelReservation,
    showCancelSuccess,
    closeCancelSuccess,
    cancelError,
    dismissCancelError: useCallback(() => setCancelError(null), []),
  };
}
