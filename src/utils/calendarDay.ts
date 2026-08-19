/**
 * A calendar DAY as a `YYYY-MM-DD` string, and arithmetic on it that never touches a timezone.
 *
 * The rule this file exists to make cheap (CLAUDE.md §5.15): the day a restaurant is on belongs to
 * the RESTAURANT, and a browser cannot compute it. What a browser can do — once the server has
 * named a day — is add days to it and label it, and both of those go wrong the moment a `Date`
 * object is involved: `new Date()` carries a time, `toISOString()` re-reads it in UTC, and
 * `toLocaleDateString()` re-reads it in the device's zone. Mixing two of those is how the
 * reservation form came to LABEL a button with the device's local day while SENDING its UTC one —
 * a guest at 00:30 in Geneva tapped `19` and booked the 18th (frontend #517).
 *
 * So days are strings here, and the only `Date` in the file is pinned to midnight UTC, which is
 * the one instant that cannot drift into a neighbouring day when it is read back in UTC.
 */

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a string is a `YYYY-MM-DD` day that exists (`2026-02-31` does not). */
export function isCalendarDay(day: string): boolean {
  const match = CALENDAR_DAY.exec(day);
  if (!match) return false;

  const [, year, month, date] = match;
  const utc = new Date(`${day}T00:00:00Z`);

  return (
    !Number.isNaN(utc.getTime()) &&
    utc.getUTCFullYear() === Number(year) &&
    utc.getUTCMonth() + 1 === Number(month) &&
    utc.getUTCDate() === Number(date)
  );
}

/**
 * The day it is on THIS DEVICE — its local day, never its UTC one.
 *
 * The fallback for when the restaurant's own day cannot be reached, and deliberately not
 * `toISOString().split('T')[0]`, which is the device's UTC day and is a different day from its
 * local one for part of every night (that expression is the whole of #511 and #517).
 */
export function todayOnDevice(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const date = `${now.getDate()}`.padStart(2, '0');

  return `${now.getFullYear()}-${month}-${date}`;
}

/** The day `days` days after `day`, or `null` if `day` is not a day. */
export function addCalendarDays(day: string, days: number): string | null {
  if (!isCalendarDay(day) || !Number.isInteger(days)) return null;

  // Anchored at midnight UTC and read back in UTC, so the arithmetic cannot land in a
  // neighbouring day — and, unlike `setDate` on a local Date, it is unaffected by a DST
  // transition on the device's zone, which can make a "day" 23 or 25 hours long.
  const utc = new Date(`${day}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);

  return utc.toISOString().slice(0, 10);
}

/** The day-of-month a day names, as the digits the day itself carries. */
export function dayOfMonth(day: string): string {
  return isCalendarDay(day) ? String(Number(day.slice(8, 10))) : '';
}

/**
 * The weekday a day falls on, in the caller's language.
 *
 * `timeZone: 'UTC'` is load-bearing: the day is anchored at midnight UTC, so a device west of UTC
 * would otherwise render the weekday of the day BEFORE — the same defect the value/label mismatch
 * was, moved into the label alone.
 */
export function weekdayLabel(day: string, locale: string): string {
  if (!isCalendarDay(day)) return '';

  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
}
