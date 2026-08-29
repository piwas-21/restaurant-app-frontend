import type { WorkingHoursDto, WorkingHoursShiftDto } from '@/types/workingHours';

/**
 * Reading a day's opening hours for DISPLAY.
 *
 * Shared by the classic and craft home pages, which each had their own copy of the same
 * `formatTime` + "open - close" line. That duplication is exactly how a restaurant that serves
 * 11:00-15:00 and 18:00-23:00 ends up advertised correctly on one template and not the other, so
 * the rule lives here once.
 */

/**
 * "14:30:00" → "2:30 PM".
 *
 * This is craft's copy, not classic's. The two had drifted: classic's parsed straight into
 * `parseInt` and rendered `"NaN:undefined AM"` for a malformed value, craft's returned the input
 * unchanged. Merging two copies keeps the MORE defensive one, or the merge quietly ships a
 * regression to whichever page had the guard.
 */
export const formatTime = (time: string): string => {
  if (!time || !time.includes(':')) return time || '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

/**
 * The day's windows, in time order, correct for BOTH shapes.
 *
 * An older backend — or a tenant image deployed before the shift migration — answers without a
 * `shifts` array at all, and the day is then exactly its `openTime`/`closeTime` pair. Falling back
 * rather than rendering nothing is deliberate: an empty opening-hours block is a worse lie than a
 * single window, and this frontend can ship before the API does.
 */
export const shiftsOf = (workingHours: WorkingHoursDto): WorkingHoursShiftDto[] => {
  const shifts = workingHours.shifts ?? [];
  if (shifts.length > 0) {
    return [...shifts].sort((a, b) => a.openTime.localeCompare(b.openTime));
  }

  return [{ openTime: workingHours.openTime, closeTime: workingHours.closeTime }];
};

/**
 * The one line a guest reads for a day: `"11:00 AM - 3:00 PM, 6:00 PM - 11:00 PM"`, or the closed
 * label. Both home pages group CONSECUTIVE DAYS THAT SHARE THIS STRING, so a split shift groups
 * exactly as a single window does — the grouping needed no change, only this string did.
 */
export const formatDayHours = (workingHours: WorkingHoursDto, closedLabel: string): string => {
  if (workingHours.isClosed) return closedLabel;

  return shiftsOf(workingHours)
    .map((shift) => `${formatTime(shift.openTime)} - ${formatTime(shift.closeTime)}`)
    .join(', ');
};
