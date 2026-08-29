'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { workingHoursService } from '@/services/workingHoursService';
import { WorkingHoursDto, UpdateWorkingHoursDto, WorkingHoursShiftDto, dayNameToNumber } from '@/types/workingHours';
import { getErrorMessage } from '@/utils/apiClient';
import { enqueueSnackbar } from 'notistack';
import { getDayName, findShiftProblem } from './workingHoursDay';
import { shiftsOf } from '@/lib/workingHoursDisplay';
import WorkingHoursDayShifts from './WorkingHoursDayShifts';
import styles from './WorkingHoursManager.module.css';

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday

// Normalized type: dayOfWeek as a number, and `shifts` always present. A backend that predates
// serving windows answers without the array, and `shiftsOf` turns that day into its single legacy
// window — so the editor works against one shape no matter which API it is talking to.
type NormalizedWorkingHours = Omit<WorkingHoursDto, 'dayOfWeek' | 'shifts'> & {
  dayOfWeek: number;
  shifts: WorkingHoursShiftDto[];
};

export default function WorkingHoursManager() {
  const { t } = useTranslation();
  const [workingHours, setWorkingHours] = useState<NormalizedWorkingHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    // Both callees have internal try/catch; fire-and-forget. See OrderTypeManager.
    void loadWorkingHours();
    void checkIsOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWorkingHours = async () => {
    try {
      setLoading(true);
      const hours = await workingHoursService.getAll();

      // Convert dayOfWeek from string to number and sort by day of week (Monday first)
      const normalized: NormalizedWorkingHours[] = hours.map((wh) => ({
        ...wh,
        dayOfWeek: dayNameToNumber(wh.dayOfWeek),
        shifts: shiftsOf(wh),
      }));

      const sorted = normalized.sort((a, b) => {
        const aIndex = DAYS_ORDER.indexOf(a.dayOfWeek);
        const bIndex = DAYS_ORDER.indexOf(b.dayOfWeek);
        return aIndex - bIndex;
      });

      setWorkingHours(sorted);
    } catch (e) {
      enqueueSnackbar(getErrorMessage(e) ?? t('failed_to_load_working_hours', 'Failed to load working hours'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIsOpen = async () => {
    try {
      const open = await workingHoursService.isOpenNow();
      setIsOpen(open);
    } catch {
      // No toast, on purpose: this only decides whether the "Open now" banner renders, and on
      // mount `loadWorkingHours` fails alongside it and reports the same outage — a second toast
      // would bury the one that matters.
      //
      // But silence is not the same as doing nothing. After a SAVE this runs again, on its own,
      // with `loadWorkingHours` having just succeeded; leaving `isOpen` alone there would keep the
      // banner asserting the PRE-save answer over a table showing the hours the admin just changed,
      // with nothing reported anywhere. `null` hides the banner instead: no answer beats a stale one.
      setIsOpen(null);
    }
  };

  const handleShiftsChange = (id: string, shifts: WorkingHoursShiftDto[]) => {
    setWorkingHours((prev) => prev.map((wh) => (wh.id === id ? { ...wh, shifts } : wh)));
  };

  const handleToggleClosed = (id: string) => {
    setWorkingHours((prev) => prev.map((wh) => (wh.id === id ? { ...wh, isClosed: !wh.isClosed } : wh)));
  };

  const handleNotesChange = (id: string, notes: string) => {
    setWorkingHours((prev) => prev.map((wh) => (wh.id === id ? { ...wh, notes } : wh)));
  };

  const validateTimes = (): boolean => {
    for (const wh of workingHours) {
      if (wh.isClosed) continue;

      const problem = findShiftProblem(wh.shifts);
      if (problem === null) continue;

      const day = getDayName(wh.dayOfWeek, t);
      const message =
        problem.kind === 'overlap'
          ? t('opening_windows_overlap', 'Opening windows overlap on {{day}}', { day })
          : problem.kind === 'empty'
            ? t('at_least_one_opening_window', '{{day}} is open, so it needs at least one window', { day })
            : t('close_time_must_be_after_open', 'Close time must be after open time for {{day}}', { day });

      enqueueSnackbar(message, { variant: 'error' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateTimes()) return;

    try {
      setSaving(true);

      // Update all days
      const updatePromises = workingHours.map((wh) => {
        // `shifts` is authoritative; openTime/closeTime are sent as the API's own mirror of the
        // FIRST window so an older backend, which reads only the pair, still stores a usable day.
        const ordered = [...wh.shifts].sort((a, b) => a.openTime.localeCompare(b.openTime));
        const dto: UpdateWorkingHoursDto = {
          dayOfWeek: wh.dayOfWeek,
          openTime: ordered[0]?.openTime ?? wh.openTime,
          closeTime: ordered[0]?.closeTime ?? wh.closeTime,
          shifts: ordered,
          isActive: wh.isActive,
          isClosed: wh.isClosed,
          notes: wh.notes || null,
        };
        return workingHoursService.update(dto);
      });

      await Promise.all(updatePromises);

      enqueueSnackbar(t('working_hours_updated', 'Working hours updated successfully'), {
        variant: 'success',
      });

      // Reload to get fresh data and check if open status changed
      await loadWorkingHours();
      await checkIsOpen();
    } catch (e) {
      // Per-day validation ("closing time must be after opening time") comes back from the server
      // and is the whole diagnosis — the generic says only that something went wrong.
      enqueueSnackbar(getErrorMessage(e) ?? t('failed_to_update_working_hours', 'Failed to update working hours'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Current Status */}
      {isOpen !== null && (
        <div className={`${styles.statusBanner} ${isOpen ? styles.statusOpen : styles.statusClosed}`}>
          {isOpen ? (
            <>
              <CheckCircle2 size={20} />
              <span>{t('restaurant_currently_open', 'Restaurant is currently OPEN')}</span>
            </>
          ) : (
            <>
              <AlertCircle size={20} />
              <span>{t('restaurant_currently_closed', 'Restaurant is currently CLOSED')}</span>
            </>
          )}
        </div>
      )}

      {/* Working Hours Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('day', 'Day')}</th>
              <th>{t('status', 'Status')}</th>
              <th>{t('opening_windows', 'Opening hours')}</th>
              <th>{t('notes', 'Notes')}</th>
            </tr>
          </thead>
          <tbody>
            {workingHours.map((wh) => (
              <tr key={wh.id} className={wh.isClosed ? styles.closedRow : ''}>
                <td className={styles.dayCell}>
                  <strong suppressHydrationWarning>{getDayName(wh.dayOfWeek, t)}</strong>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggleClosed(wh.id)}
                    className={`${styles.statusChip} ${wh.isClosed ? styles.statusClosed : styles.statusOpen}`}
                  >
                    {wh.isClosed ? t('closed', 'Closed') : t('open', 'Open')}
                  </button>
                </td>
                <td>
                  <WorkingHoursDayShifts
                    shifts={wh.shifts}
                    dayName={getDayName(wh.dayOfWeek, t)}
                    disabled={wh.isClosed}
                    onChange={(shifts) => handleShiftsChange(wh.id, shifts)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={wh.notes || ''}
                    onChange={(e) => handleNotesChange(wh.id, e.target.value)}
                    placeholder={t('optional_notes', 'Optional notes...')}
                    className={styles.notesInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className={styles.actions}>
        <button onClick={handleSave} disabled={saving} className={styles.saveButton}>
          <Save size={18} />
          <span>{saving ? t('saving', 'Saving...') : t('save_changes', 'Save Changes')}</span>
        </button>
      </div>
    </div>
  );
}
