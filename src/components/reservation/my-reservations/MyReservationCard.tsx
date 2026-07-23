'use client';

import { useTranslation } from 'react-i18next';
import { Calendar, ChevronDown, ChevronUp, Clock, MapPin, Users } from 'lucide-react';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import { type ReservationDto, ReservationStatus } from '@/types/reservation';
import { RESTAURANT_NAME } from '@/lib/config';

type CssModule = Readonly<Record<string, string>>;

interface MyReservationCardProps {
  reservation: ReservationDto;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  onRequestCancel: (id: string) => void;
  cancelling: boolean;
  /** The host template's card CSS module (the CartItemCard pattern). */
  styles: CssModule;
}

/** Soft, non-traffic-light tone mapping (design Prompt 7c): pending=saffron,
 *  confirmed=olive, cancelled=kraft, completed=muted, no-show=soft brick —
 *  expressed through the StatusBadge tone scale; craft additionally restyles
 *  via the per-status classes below. */
const STATUS_TONES: Readonly<Record<ReservationStatus, StatusBadgeTone>> = {
  [ReservationStatus.Pending]: 'warning',
  [ReservationStatus.Confirmed]: 'success',
  [ReservationStatus.Cancelled]: 'neutral',
  [ReservationStatus.Completed]: 'info',
  [ReservationStatus.NoShow]: 'danger',
};

/** Join class names, skipping keys the active template's module doesn't define. */
function cls(...parts: ReadonlyArray<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function formatTime(timeString: string): string {
  const parts = timeString.split(':');
  return `${parts[0]}:${parts[1]}`;
}

/** One reservation docket card: date/time + party ticket lines, a soft
 *  stamped status badge, and expandable details with the cancel action. */
export default function MyReservationCard({
  reservation,
  expanded,
  onToggleExpanded,
  onRequestCancel,
  cancelling,
  styles,
}: Readonly<MyReservationCardProps>) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString(i18n.language, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const statusName = ReservationStatus[reservation.status];
  const canCancel =
    reservation.status === ReservationStatus.Pending || reservation.status === ReservationStatus.Confirmed;

  return (
    <div className={cls(styles.reservationCard, styles[`card${statusName}`])}>
      <div className={styles.reservationHeader}>
        <div className={styles.reservationMainInfo}>
          <div className={styles.dateTimeInfo}>
            <div className={cls(styles.infoItem, styles.dateItem)}>
              <Calendar size={16} className={styles.icon} />
              <span className={styles.infoText}>{formatDate(reservation.reservationDate)}</span>
            </div>
            <div className={cls(styles.infoItem, styles.timeItem)}>
              <Clock size={16} className={styles.icon} />
              <span className={styles.infoText}>
                {formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}
              </span>
            </div>
            <div className={cls(styles.infoItem, styles.guestsItem)}>
              <Users size={16} className={styles.icon} />
              <span className={styles.infoText}>
                {reservation.numberOfGuests} {t('guests', 'guests')}
              </span>
            </div>
          </div>

          <StatusBadge
            tone={STATUS_TONES[reservation.status]}
            className={cls(styles.statusBadge, styles[`status${statusName}`])}
          >
            {t(`my_reservations_status_${statusName}`, statusName)}
          </StatusBadge>
        </div>

        <button
          type="button"
          className={styles.expandButton}
          onClick={() => onToggleExpanded(reservation.id)}
          aria-expanded={expanded}
          aria-label={t('toggle_details', 'Toggle details')}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className={styles.reservationDetails}>
          <div className={styles.detailItem}>
            <MapPin size={16} className={styles.icon} />
            <span className={styles.detailLabel}>{t('restaurant', 'Restaurant')}:</span>
            <span className={styles.detailValue}>{RESTAURANT_NAME}</span>
          </div>

          {reservation.tableNumber && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('table_number', 'Table')}:</span>
              <span className={styles.detailValue}>{reservation.tableNumber}</span>
            </div>
          )}

          {reservation.specialRequests && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('special_requests', 'Special Requests')}:</span>
              <span className={styles.detailValue}>{reservation.specialRequests}</span>
            </div>
          )}

          {reservation.notes && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>{t('my_reservations_admin_notes', 'Admin Notes')}:</span>
              <span className={styles.detailValue}>{reservation.notes}</span>
            </div>
          )}

          {canCancel && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => onRequestCancel(reservation.id)}
                disabled={cancelling}
              >
                {t('cancel_reservation', 'Cancel Reservation')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
