import type { TFunction } from 'i18next';
import type { WorkingHoursShiftDto } from '@/types/workingHours';

/**
 * Pure day/time helpers lifted out of `WorkingHoursManager`.
 *
 * Extracted because that component reached its CLAUDE.md §4 ceiling (250 LOC) while documenting why
 * one of its catches stays unbound — and baselining a file to make room for one's own comment is
 * how a length gate stops meaning anything. Neither function touches component state, so they are
 * cheaper to read and to test out here.
 */

const ENGLISH_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** i18n keys indexed the way `Date.getDay()` counts, so Sunday is 0 — not the Monday-first UI order. */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * The localized day name. Falls back to English, then to "Unknown" — the last one matters because
 * `dayOfWeek` arrives from the API and an out-of-range value would otherwise render `undefined`.
 */
export const getDayName = (dayOfWeek: number, t: TFunction): string => {
  const englishName = ENGLISH_DAY_NAMES[dayOfWeek];
  // Translated, unlike the `'Unknown'` literal this was extracted from — new code does not get to
  // inherit a §5 exemption just because the line it replaced had one.
  if (englishName === undefined) return t('unknown_day', 'Unknown day');
  // `|| englishName` preserves the original's `translated || english || 'Unknown'` chain: a locale
  // carrying an EMPTY string for a day key would otherwise render a blank where a day name belongs.
  return t(DAY_KEYS[dayOfWeek], englishName) || englishName;
};

/** "HH:MM" as minutes since midnight, for ordering comparisons only. */
export const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/** The largest number of serving windows the API accepts for one day. Mirrors the server rule. */
export const MAX_SHIFTS_PER_DAY = 4;

/**
 * What is wrong with a day's serving windows, or `null` when nothing is.
 *
 * Returned as a shape rather than a message so the caller owns the translation, and so a test can
 * assert the RULE without asserting English. The order of the checks matches the server's, because
 * an admin who is told a different first problem than the API would report is being sent round a
 * loop.
 */
export type ShiftProblem =
  | { kind: 'empty' }
  | { kind: 'tooMany'; count: number }
  | { kind: 'order'; shift: WorkingHoursShiftDto }
  | { kind: 'overlap'; earlier: WorkingHoursShiftDto; later: WorkingHoursShiftDto };

/**
 * Validates a day's windows the way the server does: sorted by opening time, each one ending after
 * it starts, and no two overlapping. Touching windows (15:00-15:00) are legal — a handover, not an
 * overlap.
 */
export const findShiftProblem = (shifts: WorkingHoursShiftDto[]): ShiftProblem | null => {
  if (shifts.length === 0) return { kind: 'empty' };
  if (shifts.length > MAX_SHIFTS_PER_DAY) return { kind: 'tooMany', count: shifts.length };

  const ordered = [...shifts].sort((a, b) => parseTime(a.openTime) - parseTime(b.openTime));

  for (let i = 0; i < ordered.length; i += 1) {
    const shift = ordered[i];
    if (parseTime(shift.closeTime) <= parseTime(shift.openTime)) {
      return { kind: 'order', shift };
    }
    if (i > 0 && parseTime(shift.openTime) < parseTime(ordered[i - 1].closeTime)) {
      return { kind: 'overlap', earlier: ordered[i - 1], later: shift };
    }
  }

  return null;
};
