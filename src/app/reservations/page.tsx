'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { reservationService } from '@/services/reservationService';
import { TableDto } from '@/types/reservation';
import VisualTableLayout from '@/components/reservation/VisualTableLayout';
import styles from './styles.module.css';
import { enqueueSnackbar } from 'notistack';

export default function ReservationsPage() {
  const { t } = useTranslation();

  // State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [numberOfGuests, setNumberOfGuests] = useState<number>(2);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');

  const [allTables, setAllTables] = useState<TableDto[]>([]);
  const [availableTables, setAvailableTables] = useState<TableDto[]>([]);
  const [bookedTableIds, setBookedTableIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Generate date options (next 14 days)
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  // Time slots
  const timeSlots = [
    '11:00', '12:00', '13:00', '14:00',
    '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
  ];

  // Load all tables on mount
  useEffect(() => {
    loadAllTables();
  }, []);

  // Check availability when date/time/guests change
  useEffect(() => {
    if (selectedDate && selectedTime) {
      checkAvailability();
    }
  }, [selectedDate, selectedTime, numberOfGuests]);

  const loadAllTables = async () => {
    try {
      const tables = await reservationService.getTables(true); // Only active tables
      setAllTables(tables);
      setAvailableTables(tables); // Initially all are available
    } catch (err) {
      console.error('Failed to load tables:', err);
      enqueueSnackbar(t('failed_to_load_tables', 'Failed to load tables'), { variant: 'error' });
    }
  };

  const checkAvailability = async () => {
    if (!selectedDate || !selectedTime) return;

    setLoading(true);
    try {
      const slots = await reservationService.getAvailableTimeSlots(selectedDate, numberOfGuests);

      // Find the time slot that matches
      const slot = slots.timeSlots.find(s => s.startTime.startsWith(selectedTime));

      if (slot) {
        setAvailableTables(slot.availableTables);

        // Calculate booked tables
        const availableIds = new Set(slot.availableTables.map(t => t.id));
        const booked = allTables.filter(t => !availableIds.has(t.id)).map(t => t.id);
        setBookedTableIds(booked);
      } else {
        setAvailableTables([]);
        setBookedTableIds(allTables.map(t => t.id));
      }
    } catch (err) {
      console.error('Failed to check availability:', err);
      setAvailableTables([]);
      setBookedTableIds(allTables.map(t => t.id));
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (table: TableDto) => {
    setSelectedTableId(table.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTableId || !selectedDate || !selectedTime) {
      enqueueSnackbar(t('please_complete_all_fields', 'Please complete all fields'), { variant: 'warning' });
      return;
    }

    if (!customerName || !customerEmail || !customerPhone) {
      enqueueSnackbar(t('please_fill_customer_details', 'Please fill in your details'), { variant: 'warning' });
      return;
    }

    setSubmitting(true);

    try {
      const reservationData = {
        customerName,
        customerEmail,
        customerPhone,
        tableId: selectedTableId,
        reservationDate: new Date(selectedDate).toISOString(),
        startTime: `${selectedTime}:00`,
        endTime: `${parseInt(selectedTime.split(':')[0]) + 2}:00:00`, // 2-hour reservation
        numberOfGuests,
        specialRequests: specialRequests || undefined
      };

      await reservationService.createReservation(reservationData);

      enqueueSnackbar(t('reservation_success_message', 'Your reservation has been created successfully!'), {
        variant: 'success'
      });

      // Reset form
      setSelectedTableId('');
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      setSpecialRequests('');

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      enqueueSnackbar(
        err.message || t('reservation_failed', 'Failed to create reservation'),
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTable = allTables.find(t => t.id === selectedTableId);
  const canSubmit = selectedTableId && selectedDate && selectedTime && customerName && customerEmail && customerPhone;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('make_reservation', 'Make a Reservation')}</h1>

        <div className={styles.layout}>
          {/* Visual Table Layout */}
          <div className={styles.floorPlanSection}>
            <h2 className={styles.sectionTitle}>{t('select_your_table', 'Select your Table')}</h2>
            <VisualTableLayout
              tables={allTables}
              selectedTableId={selectedTableId}
              onSelectTable={handleTableSelect}
              bookedTableIds={bookedTableIds}
            />
          </div>

          {/* Booking Panel */}
          <div className={styles.bookingPanel}>
            <h2 className={styles.panelTitle}>{t('book_your_table', 'Book your table')}</h2>

            <form onSubmit={handleSubmit} className={styles.bookingForm}>
              {/* Number of Guests */}
              <div className={styles.formSection}>
                <label className={styles.label}>{t('guests', 'Guests')}</label>
                <div className={styles.guestSelector}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`${styles.guestButton} ${numberOfGuests === num ? styles.selected : ''}`}
                      onClick={() => setNumberOfGuests(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className={styles.customInputWrapper}>
                  <label className={styles.customLabel}>{t('or_custom', 'Or custom')}:</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={numberOfGuests}
                    onChange={(e) => setNumberOfGuests(parseInt(e.target.value) || 1)}
                    className={styles.customInput}
                    placeholder={t('enter_guests', 'Enter number')}
                  />
                </div>
              </div>

              {/* Date Selection */}
              <div className={styles.formSection}>
                <label className={styles.label}>{t('date', 'Date')}</label>
                <div className={styles.dateSelector}>
                  {dateOptions.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayOfMonth = date.getDate();

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        className={`${styles.dateButton} ${selectedDate === dateStr ? styles.selected : ''}`}
                        onClick={() => setSelectedDate(dateStr)}
                      >
                        <div className={styles.dateDay}>{dayOfMonth}</div>
                        <div className={styles.dateDayName}>{dayOfWeek}</div>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.customInputWrapper}>
                  <label className={styles.customLabel}>{t('or_pick_date', 'Or pick a date')}:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={styles.customInput}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {/* Time Selection */}
              <div className={styles.formSection}>
                <label className={styles.label}>{t('time', 'Time')}</label>
                <div className={styles.timeSelector}>
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      type="button"
                      className={`${styles.timeButton} ${selectedTime === time ? styles.selected : ''}`}
                      onClick={() => setSelectedTime(time)}
                      disabled={loading}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className={styles.customInputWrapper}>
                  <label className={styles.customLabel}>{t('or_enter_time', 'Or enter time')}:</label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className={styles.customInput}
                    min="11:00"
                    max="22:00"
                  />
                </div>
              </div>

              {/* Selected Table Display */}
              {selectedTable && (
                <div className={styles.selectedTableInfo}>
                  <div className={styles.tableLabel}>{t('table', 'Table')}:</div>
                  <div className={styles.tableValue}>{selectedTable.tableNumber}</div>
                </div>
              )}

              {/* Customer Details */}
              <div className={styles.formSection}>
                <label className={styles.label}>{t('your_details', 'Your Details')}</label>

                <input
                  type="text"
                  placeholder={t('your_name', 'Your Name')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={styles.input}
                  required
                />

                <input
                  type="email"
                  placeholder={t('your_email', 'Your Email')}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className={styles.input}
                  required
                />

                <input
                  type="tel"
                  placeholder={t('your_phone', 'Your Phone')}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={styles.input}
                  required
                />

                <textarea
                  placeholder={t('special_requests_placeholder', 'Allergies, dietary requirements, special occasions, etc.')}
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={styles.bookButton}
                disabled={!canSubmit || submitting}
              >
                {submitting ? t('booking', 'Booking...') : t('book_now', 'Book Now')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
