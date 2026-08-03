import type { TFunction } from 'i18next';
import { getDayName, parseTime } from '../workingHoursDay';

/** Stands in for i18next: returns the key's "translation" from a table, else the supplied fallback. */
const translatorFor = (table: Record<string, string>): TFunction =>
  ((key: string, fallback?: string) => table[key] ?? fallback ?? key) as unknown as TFunction;

const english = translatorFor({});

describe('getDayName', () => {
  it('counts from Sunday, the way the API does', () => {
    expect(getDayName(0, english)).toBe('Sunday');
    expect(getDayName(1, english)).toBe('Monday');
    expect(getDayName(6, english)).toBe('Saturday');
  });

  it('prefers the localized name', () => {
    expect(getDayName(1, translatorFor({ monday: 'Lundi' }))).toBe('Lundi');
  });

  /**
   * The extraction from `WorkingHoursManager` had to preserve a three-step fallback chain that the
   * original wrote as `translated || english || 'Unknown'`. Both remaining steps are load-bearing.
   */
  it('falls back to English when a locale carries a blank for the day', () => {
    expect(getDayName(3, translatorFor({ wednesday: '' }))).toBe('Wednesday');
  });

  it('says "Unknown" rather than rendering undefined for an out-of-range day', () => {
    // `dayOfWeek` comes from the API, so this is a real input, not a hypothetical.
    expect(getDayName(7, english)).toBe('Unknown day');
    expect(getDayName(-1, english)).toBe('Unknown day');
    expect(getDayName(7, translatorFor({ unknown_day: 'Jour inconnu' }))).toBe('Jour inconnu');
  });
});

describe('parseTime', () => {
  it('converts HH:MM to minutes since midnight', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('23:59')).toBe(1439);
  });

  it('orders times correctly across the hour boundary', () => {
    // The only thing the caller does with these: `close <= open` rejects the row.
    expect(parseTime('10:00')).toBeGreaterThan(parseTime('09:59'));
  });
});
