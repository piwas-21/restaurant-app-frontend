'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { ReservationDto, ReservationStatus } from '@/types/reservation';
import { reservationService } from '@/services/reservationService';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './ReservationCalendar.module.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent extends Event {
  resource: ReservationDto;
}

interface ReservationCalendarProps {
  reservations: ReservationDto[];
  onSelectReservation?: (reservation: ReservationDto) => void;
}

export default function ReservationCalendar({
  reservations,
  onSelectReservation
}: ReservationCalendarProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  // Convert reservations to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return reservations.map(reservation => {
      const reservationDate = new Date(reservation.reservationDate);
      const [startHour, startMinute] = reservation.startTime.split(':').map(Number);
      const [endHour, endMinute] = reservation.endTime.split(':').map(Number);

      const start = new Date(reservationDate);
      start.setHours(startHour, startMinute, 0, 0);

      const end = new Date(reservationDate);
      end.setHours(endHour, endMinute, 0, 0);

      return {
        title: `${reservation.customerName} - Table ${reservation.tableNumber}`,
        start,
        end,
        resource: reservation,
      };
    });
  }, [reservations]);

  // Custom event style based on status
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const reservation = event.resource;
    let backgroundColor = '#3174ad';

    switch (reservation.status) {
      case ReservationStatus.Confirmed:
        backgroundColor = '#10b981';
        break;
      case ReservationStatus.Pending:
        backgroundColor = '#f59e0b';
        break;
      case ReservationStatus.Cancelled:
        backgroundColor = '#ef4444';
        break;
      case ReservationStatus.Completed:
        backgroundColor = '#6b7280';
        break;
      case ReservationStatus.NoShow:
        backgroundColor = '#dc2626';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 5px',
      },
    };
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    if (onSelectReservation) {
      onSelectReservation(event.resource);
    }
  }, [onSelectReservation]);

  // Custom toolbar
  const CustomToolbar = ({ label, onNavigate, onView }: any) => (
    <div className={styles.toolbar}>
      <div className={styles.navButtons}>
        <button onClick={() => onNavigate('PREV')} className={styles.navButton}>
          ‹
        </button>
        <button onClick={() => onNavigate('TODAY')} className={styles.todayButton}>
          {t('today', 'Today')}
        </button>
        <button onClick={() => onNavigate('NEXT')} className={styles.navButton}>
          ›
        </button>
      </div>
      <h2 className={styles.label}>{label}</h2>
      <div className={styles.viewButtons}>
        <button
          onClick={() => onView('month')}
          className={view === 'month' ? styles.activeView : ''}
        >
          {t('month', 'Month')}
        </button>
        <button
          onClick={() => onView('week')}
          className={view === 'week' ? styles.activeView : ''}
        >
          {t('week', 'Week')}
        </button>
        <button
          onClick={() => onView('day')}
          className={view === 'day' ? styles.activeView : ''}
        >
          {t('day', 'Day')}
        </button>
        <button
          onClick={() => onView('agenda')}
          className={view === 'agenda' ? styles.activeView : ''}
        >
          {t('agenda', 'Agenda')}
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.confirmed}`}></span>
          <span>{t('confirmed', 'Confirmed')}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.pending}`}></span>
          <span>{t('pending', 'Pending')}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.cancelled}`}></span>
          <span>{t('cancelled', 'Cancelled')}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.completed}`}></span>
          <span>{t('completed', 'Completed')}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.noShow}`}></span>
          <span>{t('no_show', 'No Show')}</span>
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 700 }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectEvent}
        components={{
          toolbar: CustomToolbar,
        }}
        views={['month', 'week', 'day', 'agenda']}
        step={30}
        showMultiDayTimes
        defaultView="month"
      />
    </div>
  );
}
