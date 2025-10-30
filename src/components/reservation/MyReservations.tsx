'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { reservationService } from '@/services/reservationService';
import { ReservationDto, ReservationStatus } from '@/types/reservation';
import styles from './MyReservations.module.css';

export default function MyReservations() {
  const { t } = useTranslation();
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reservationService.getReservations();
      setReservations(result.items);
    } catch (err: any) {
      setError(err.message || t('my_reservations_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm(t('my_reservations_cancel_confirm'))) {
      return;
    }

    setCancelling(id);
    try {
      await reservationService.cancelReservation(id);
      alert(t('my_reservations_cancelled_success'));
      loadReservations();
    } catch (err: any) {
      alert(err.message || t('my_reservations_cancel_error'));
    } finally {
      setCancelling(null);
    }
  };

  const getStatusBadgeClass = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.Pending:
        return styles.statusPending;
      case ReservationStatus.Confirmed:
        return styles.statusConfirmed;
      case ReservationStatus.Cancelled:
        return styles.statusCancelled;
      case ReservationStatus.Completed:
        return styles.statusCompleted;
      case ReservationStatus.NoShow:
        return styles.statusNoShow;
      default:
        return '';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{t('my_reservations_loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{t('my_reservations_title')}</h1>
      </div>

      {reservations.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('my_reservations_no_reservations')}</p>
          <button
            className={styles.makeReservationButton}
            onClick={() => router.push('/reservations')}
          >
            {t('my_reservations_make_reservation')}
          </button>
        </div>
      ) : (
        <div className={styles.reservationsList}>
          {reservations.map((reservation) => (
            <div key={reservation.id} className={styles.reservationCard}>
              <div className={styles.cardHeader}>
                <div className={styles.tableInfo}>
                  <h3>{t('my_reservations_table', { tableNumber: reservation.tableNumber })}</h3>
                  <span className={styles.guestCount}>
                    {t('my_reservations_guests', { count: reservation.numberOfGuests })}
                  </span>
                </div>
                <span className={`${styles.statusBadge} ${getStatusBadgeClass(reservation.status)}`}>
                  {t(`my_reservations_status_${ReservationStatus[reservation.status].toLowerCase()}`)}
                </span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.detailRow}>
                  <strong>{t('my_reservations_date')}:</strong>
                  <span>{formatDate(reservation.reservationDate)}</span>
                </div>
                <div className={styles.detailRow}>
                  <strong>{t('my_reservations_time')}:</strong>
                  <span>{formatTime(reservation.startTime)} - {formatTime(reservation.endTime)}</span>
                </div>

                {reservation.specialRequests && (
                  <div className={styles.detailRow}>
                    <strong>{t('my_reservations_special_requests')}:</strong>
                    <span>{reservation.specialRequests}</span>
                  </div>
                )}

                {reservation.notes && (
                  <div className={styles.detailRow}>
                    <strong>{t('my_reservations_admin_notes')}:</strong>
                    <span>{reservation.notes}</span>
                  </div>
                )}
              </div>

              {(reservation.status === ReservationStatus.Pending ||
                reservation.status === ReservationStatus.Confirmed) && (
                <div className={styles.cardFooter}>
                  <button
                    className={styles.cancelButton}
                    onClick={() => handleCancelReservation(reservation.id)}
                    disabled={cancelling === reservation.id}
                  >
                    {cancelling === reservation.id
                      ? t('my_reservations_cancelling')
                      : t('my_reservations_cancel_button')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
