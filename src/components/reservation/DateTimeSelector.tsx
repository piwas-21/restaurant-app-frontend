import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import type { TimeSlotOption } from '@/utils/reservationForm';
import { addCalendarDays, dayOfMonth, weekdayLabel } from '@/utils/calendarDay';

const FALLBACK_TIMES = ['11:00', '12:00', '13:00', '14:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

interface DateTimeSelectorProps {
  selectedDate: string;
  selectedTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  loading?: boolean;
  /**
   * The day the RESTAURANT is on (`YYYY-MM-DD`), or `''` while that is still unknown. Never the
   * device's: a browser cannot know the tenant's zone, and this component used to build its dates
   * from `new Date()` — labelling each button with the device's LOCAL day-of-month while sending
   * its UTC day. At 00:30 in Geneva a guest tapped `19` and booked the 18th (frontend #517).
   */
  today: string;
  /** Every slot for the day; unavailable ones render disabled + struck-through. */
  timeSlotOptions?: TimeSlotOption[];
  /** Per-template CSS module (ADR-006 reservations surface — the CartPage
   *  pattern): classic passes ./DateTimeSelector.module.css, craft its re-skin. */
  styles: Readonly<Record<string, string>>;
}

export default function DateTimeSelector({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  loading = false,
  today,
  timeSlotOptions,
  styles,
}: Readonly<DateTimeSelectorProps>) {
  const { t, i18n } = useTranslation();
  const dateId = useId();
  const timeId = useId();

  // The next 14 days from the RESTAURANT's today, as day strings. `today` is empty until the
  // server has named it — which also covers the server render, where the old `mounted` flag was
  // guarding against a hydration mismatch between the server's day and the browser's.
  const dateOptions = today
    ? Array.from({ length: 14 }, (_, i) => addCalendarDays(today, i)).filter((day): day is string => day !== null)
    : [];

  // Use provided time slots or fallback (though fallback shouldn't be needed with proper logic)
  const timeSlots: TimeSlotOption[] = timeSlotOptions ?? FALLBACK_TIMES.map((time) => ({ time, available: true }));

  return (
    <>
      {/* Date Selection */}
      <div className={styles.formSection}>
        <label className={styles.label}>{t('date', 'Date')}</label>
        <div className={styles.dateSelector}>
          {dateOptions.map((day) => (
            // The label and the value are now the same string read two ways, so they cannot name
            // different days however far apart the device and the restaurant are.
            <button
              key={day}
              type="button"
              className={`${styles.dateButton} ${selectedDate === day ? styles.selected : ''}`}
              onClick={() => onDateChange(day)}
            >
              <div className={styles.dateDay}>{dayOfMonth(day)}</div>
              <div className={styles.dateDayName}>{weekdayLabel(day, i18n.language)}</div>
            </button>
          ))}
        </div>
        <div className={styles.customInputWrapper}>
          <label htmlFor={dateId} className={styles.customLabel}>
            {t('or_pick_date', 'Or pick a date')}:
          </label>
          <input
            id={dateId}
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={styles.customInput}
            // The restaurant's today, not the device's: west of UTC the device's UTC day is
            // TOMORROW there, which forbids booking a day the restaurant is happily taking; east
            // of it, it is yesterday, which offers one the server refuses as past (backend #369).
            min={today}
          />
        </div>
      </div>

      {/* Time Selection */}
      <div className={styles.formSection}>
        <label className={styles.label}>{t('time', 'Time')}</label>
        <div className={styles.timeSelector}>
          {timeSlots.map(({ time, available }) => (
            <button
              key={time}
              type="button"
              className={`${styles.timeButton} ${selectedTime === time ? styles.selected : ''} ${available ? '' : styles.unavailable}`}
              onClick={() => onTimeChange(time)}
              disabled={loading || !available}
            >
              {time}
            </button>
          ))}
        </div>
        <div className={styles.customInputWrapper}>
          {/* The `:` is a JSX literal OUTSIDE t(), so it is a neutral character taking the
              paragraph direction — in `ar` it rendered 86px to the LEFT of the label text. That is
              the same bidi defect as product text, and `dir="auto"` fixes it identically; it is
              live here because the string itself is also untranslated (#385), but the two are
              separate bugs. DESIGN-SYSTEM.md §8.2. */}
          <label htmlFor={timeId} dir="auto" className={styles.customLabel}>
            {t('or_select_time', 'Or select time')}:
          </label>
          <select
            id={timeId}
            value={selectedTime}
            onChange={(e) => onTimeChange(e.target.value)}
            className={styles.customInput}
            disabled={loading || !timeSlotOptions || timeSlotOptions.length === 0}
          >
            <option value="">{t('select_time', 'Select a time...')}</option>
            {timeSlots.map(({ time, available }) => (
              <option key={time} value={time} disabled={!available}>
                {time}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
