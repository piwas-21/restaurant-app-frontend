/** One serving window inside a day: `11:00:00`-`15:00:00`. */
export interface WorkingHoursShiftDto {
  openTime: string; // "HH:mm:ss" format
  closeTime: string; // "HH:mm:ss" format
}

export interface WorkingHoursDto {
  id: string;
  dayOfWeek: string | number; // API returns string ("Sunday"), we need number (0-6)
  /**
   * The FIRST window's opening time, not the day's span. Kept by the API for clients written
   * before `shifts` existed; read `shifts` instead, or a restaurant that shuts between lunch and
   * dinner loses its evening service here.
   */
  openTime: string; // "HH:mm:ss" format
  closeTime: string; // "HH:mm:ss" format
  /** Every window of the day, ordered by `openTime`. Absent from an older backend. */
  shifts?: WorkingHoursShiftDto[];
  isActive: boolean;
  isClosed: boolean;
  notes?: string | null;
}

export interface UpdateWorkingHoursDto {
  dayOfWeek: number;
  /** Legacy mirror. The API reads it only when `shifts` is omitted. */
  openTime: string;
  closeTime: string;
  /**
   * The day's windows. Sending `[]` on a day that is not `isClosed` is refused by the API on
   * purpose — "I did not send the field" and "this restaurant serves nobody" must not be the same
   * payload — so this client always sends at least one window for an open day.
   */
  shifts: WorkingHoursShiftDto[];
  isActive: boolean;
  isClosed: boolean;
  notes?: string | null;
}

// Helper to convert day name to number
export const dayNameToNumber = (day: string | number): number => {
  if (typeof day === 'number') return day;

  const dayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  return dayMap[day] ?? 0;
};
