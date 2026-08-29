import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WorkingHoursShiftDto } from '@/types/workingHours';
import { MAX_SHIFTS_PER_DAY } from './workingHoursDay';
import styles from './WorkingHoursDayShifts.module.css';

interface WorkingHoursDayShiftsProps {
  /** The day's serving windows, in the order the admin is editing them. */
  shifts: WorkingHoursShiftDto[];
  /** The localized day name — every control is labelled with it, since the table has seven rows. */
  dayName: string;
  disabled: boolean;
  onChange: (shifts: WorkingHoursShiftDto[]) => void;
}

/**
 * The opening-hours cell for one day: N windows, each removable, with a button to add another.
 *
 * A model that can hold a lunch and a dinner is worth nothing if the only editor can enter one
 * pair, so this is the half of G11 the restaurant actually touches. Adding and removing are both
 * here on purpose — a fixed second pair would just move the limit from one window to two.
 */
export default function WorkingHoursDayShifts({ shifts, dayName, disabled, onChange }: WorkingHoursDayShiftsProps) {
  const { t } = useTranslation();

  const setTime = (index: number, field: 'openTime' | 'closeTime', value: string) => {
    onChange(shifts.map((shift, i) => (i === index ? { ...shift, [field]: `${value}:00` } : shift)));
  };

  const addShift = () => {
    // Seeded from the last window's closing time, not from 00:00: the second window of a split
    // shift always starts after the first ends, so an empty-ish default would be refused by the
    // overlap rule the moment it was saved.
    const last = shifts[shifts.length - 1];
    onChange([...shifts, { openTime: last?.closeTime ?? '18:00:00', closeTime: '23:00:00' }]);
  };

  const removeShift = (index: number) => {
    onChange(shifts.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.shifts}>
      {shifts.map((shift, index) => (
        // The index IS the identity here: a window carries no id, and two windows of one day can
        // legitimately hold the same times while the admin is mid-edit, so nothing else is unique.
        <div key={index} className={styles.shiftRow}>
          <input
            type="time"
            value={shift.openTime.substring(0, 5)}
            onChange={(e) => setTime(index, 'openTime', e.target.value)}
            disabled={disabled}
            className={styles.timeInput}
            aria-label={t('open_time_for_window', 'Open time, window {{number}}, {{day}}', {
              number: index + 1,
              day: dayName,
            })}
          />
          <span aria-hidden="true" className={styles.separator}>
            –
          </span>
          <input
            type="time"
            value={shift.closeTime.substring(0, 5)}
            onChange={(e) => setTime(index, 'closeTime', e.target.value)}
            disabled={disabled}
            className={styles.timeInput}
            aria-label={t('close_time_for_window', 'Close time, window {{number}}, {{day}}', {
              number: index + 1,
              day: dayName,
            })}
          />
          {shifts.length > 1 && (
            <button
              type="button"
              onClick={() => removeShift(index)}
              disabled={disabled}
              className={styles.removeButton}
              aria-label={t('remove_opening_window', 'Remove window {{number}}, {{day}}', {
                number: index + 1,
                day: dayName,
              })}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}

      {shifts.length < MAX_SHIFTS_PER_DAY && (
        <button
          type="button"
          onClick={addShift}
          disabled={disabled}
          className={styles.addButton}
          aria-label={t('add_opening_window_for_day', 'Add an opening window on {{day}}', {
            day: dayName,
          })}
        >
          <Plus size={14} />
          <span>{t('add_opening_window', 'Add window')}</span>
        </button>
      )}
    </div>
  );
}
