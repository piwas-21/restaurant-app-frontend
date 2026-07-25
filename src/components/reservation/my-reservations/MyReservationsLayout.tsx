'use client';

import Link from 'next/link';
import MyReservationCard from './MyReservationCard';
import CancelReservationModal from '@/components/reservation/CancelReservationModal';
import CancelSuccessModal from '@/components/reservation/CancelSuccessModal';
import { useMyReservations } from '@/hooks/reservations/useMyReservations';

type CssModule = Readonly<Record<string, string>>;

interface MyReservationsLayoutProps {
  /**
   * Per-area CSS modules from the host template (the CartPageLayout pattern):
   * `page` styles this layout's own chrome + states, `card` is forwarded to
   * every MyReservationCard. Classic passes its single MyReservations module
   * for both; craft splits them to stay under the per-module LOC limit.
   * Craft-only DOM (the masking-tape label) is gated on the module defining
   * its key, so classic's DOM is unchanged by construction.
   */
  styles: {
    page: CssModule;
    card: CssModule;
  };
}

/**
 * The /my-reservations page orchestration shared by the classic and craft
 * templates — one `useMyReservations` wiring, one DOM; the templates differ
 * only in the CSS modules they pass (ADR-006 my-reservations surface;
 * relocated from the former MyReservations component).
 */
export default function MyReservationsLayout({ styles }: Readonly<MyReservationsLayoutProps>) {
  const {
    t,
    reservations,
    loading,
    error,
    expandedId,
    toggleExpanded,
    cancellingId,
    cancelTargetId,
    openCancelModal,
    closeCancelModal,
    cancelReservation,
    showCancelSuccess,
    closeCancelSuccess,
    cancelError,
    dismissCancelError,
  } = useMyReservations();

  const s = styles.page;

  let body: React.ReactNode;
  if (loading) {
    body = <p className={s.loadingText}>{t('my_reservations_loading', 'Loading...')}</p>;
  } else if (error) {
    body = <p className={s.error}>{error}</p>;
  } else if (reservations.length === 0) {
    body = (
      <div className={s.emptyState}>
        {/* Hand-drawn empty table (design Prompt 7c): a round tabletop with
            two empty chairs, stroked in the current text colour. */}
        <svg className={s.emptyIllustration} viewBox="0 0 96 72" aria-hidden="true" focusable="false">
          <ellipse cx="48" cy="34" rx="26" ry="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M30 42 L28 62 M66 42 L68 62" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path
            d="M12 28 q-4 10 1 20 M12 30 h8 M13 48 h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path
            d="M84 28 q4 10 -1 20 M76 30 h8 M75 48 h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        </svg>
        <p className={s.emptyText}>{t('my_reservations_empty_title', 'No bookings yet')}</p>
        <Link href="/reservations" className={s.emptyCta}>
          {t('my_reservations_empty_cta', 'Book a table')}
        </Link>
      </div>
    );
  } else {
    body = (
      <div className={s.reservationsList}>
        {reservations.map((reservation) => (
          <MyReservationCard
            key={reservation.id}
            reservation={reservation}
            expanded={expandedId === reservation.id}
            onToggleExpanded={toggleExpanded}
            onRequestCancel={openCancelModal}
            cancelling={cancellingId === reservation.id}
            styles={styles.card}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={s.container}>
      <section className={s.section}>
        {/* Craft-only masking-tape flavour label — rendered only when the
            active template's module defines the key (classic doesn't). */}
        {s.tapeLabel && <span className={s.tapeLabel}>{t('craft_my_reservations_tape', 'Your reservations')}</span>}
        <h2 className={s.sectionTitle}>{t('reservations_title', 'My Reservations')}</h2>
        {body}
      </section>

      <CancelReservationModal
        isOpen={cancelTargetId !== null}
        onConfirm={() => {
          if (cancelTargetId) void cancelReservation(cancelTargetId);
        }}
        onCancel={closeCancelModal}
        isLoading={cancellingId !== null}
      />

      <CancelSuccessModal isOpen={showCancelSuccess} onClose={closeCancelSuccess} />

      {cancelError && (
        <div className={s.errorAlert}>
          <p>{cancelError}</p>
          <button type="button" onClick={dismissCancelError} aria-label={t('close', 'Close')}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
