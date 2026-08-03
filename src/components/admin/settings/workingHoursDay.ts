import type { TFunction } from 'i18next';

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
