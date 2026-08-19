/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { addCalendarDays, dayOfMonth, isCalendarDay, todayOnDevice, weekdayLabel } from './calendarDay';

describe('the device is deliberately WEST of UTC', () => {
  it('renders a UTC-anchored day as the day BEFORE on its own clock', () => {
    expect(new Date('2026-08-19T00:00:00Z').toLocaleDateString('en-CA')).toBe('2026-08-18');
  });
});

describe('todayOnDevice — the fallback when the restaurant cannot be asked', () => {
  afterEach(() => jest.useRealTimers());

  it('is the device LOCAL day, never its UTC day', () => {
    // The expression it replaces (`toISOString().split('T')[0]`) is the device's UTC day, and west
    // of UTC that is TOMORROW from late afternoon onwards. The clock is pinned at an instant where
    // the two disagree — at an arbitrary run time they agree for most of the day, and this would
    // pass against the very expression it exists to replace.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T02:00:00Z')); // 19:00 on the 18th in Los Angeles

    expect(todayOnDevice()).toBe('2026-08-18');
    expect(new Date().toISOString().split('T')[0]).toBe('2026-08-19');
  });

  it('pads a single-digit month and day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-05T12:00:00Z'));

    expect(todayOnDevice()).toBe('2026-03-05');
    expect(isCalendarDay(todayOnDevice())).toBe(true);
  });
});

describe('weekdayLabel — read in UTC, like the day it belongs to', () => {
  it('names the weekday the day actually falls on', () => {
    // 2026-08-19 is a Wednesday. Formatted on this device's clock the same instant is a Tuesday.
    expect(weekdayLabel('2026-08-19', 'en')).toBe('Wed');
  });

  it("speaks the caller's language", () => {
    expect(weekdayLabel('2026-08-19', 'fr')).toMatch(/mer/i);
  });

  it('says nothing about a day that is not one', () => {
    expect(weekdayLabel('not a day', 'en')).toBe('');
  });

  it('says nothing rather than throwing on a language tag Intl rejects', () => {
    // `i18n.language` is seeded from a user-writable localStorage key, and `Intl` answers a
    // malformed tag with a RangeError — which would take the whole booking form down.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(weekdayLabel('2026-08-19', 'not a locale')).toBe('');
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe('addCalendarDays — arithmetic that cannot drift into a neighbouring day', () => {
  it('crosses a month end, a year end and a leap day', () => {
    expect(addCalendarDays('2026-08-19', 13)).toBe('2026-09-01');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addCalendarDays('2026-08-19', 0)).toBe('2026-08-19');
  });

  it("crosses the device's OWN DST transition without losing or repeating a day", () => {
    // Los Angeles springs forward on 2026-03-08 and falls back on 2026-11-01. `setDate` on a local
    // Date adds 24 hours' worth of local wall clock, so a 23-hour day lands on the same date twice
    // and a 25-hour day skips one — the reason this arithmetic is anchored at midnight UTC.
    expect(addCalendarDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCalendarDays('2026-11-01', 1)).toBe('2026-11-02');

    // …and the whole fortnight the reservation form offers, across the spring transition.
    const fortnight = Array.from({ length: 14 }, (_, i) => addCalendarDays('2026-03-01', i));
    expect(new Set(fortnight).size).toBe(14);
    expect(fortnight[13]).toBe('2026-03-14');
  });

  it('stays a DAY past the year 9999, where ISO changes shape', () => {
    // `toISOString()` produces the extended form `+010000-01-01` there, whose first ten characters
    // are `+010000-01` — which every consumer would then treat as a day.
    expect(addCalendarDays('9999-12-31', 1)).toBe('10000-01-01');
    expect(addCalendarDays('9999-12-30', 1)).toBe('9999-12-31');
  });

  it('refuses a day it cannot trust rather than inventing one', () => {
    expect(addCalendarDays('', 1)).toBeNull();
    expect(addCalendarDays('2026-13-01', 1)).toBeNull();
    expect(addCalendarDays('2026-02-31', 1)).toBeNull();
    expect(addCalendarDays('2026-08-19T00:00:00Z', 1)).toBeNull();
    expect(addCalendarDays('2026-08-19', 1.5)).toBeNull();
  });
});

describe('isCalendarDay / dayOfMonth', () => {
  it('accepts only a day that exists', () => {
    expect(isCalendarDay('2026-08-19')).toBe(true);
    expect(isCalendarDay('2028-02-29')).toBe(true);
    expect(isCalendarDay('2026-02-29')).toBe(false);
    expect(isCalendarDay('2026-8-19')).toBe(false);
    expect(isCalendarDay('19-08-2026')).toBe(false);
  });

  it('reads the day-of-month off the string, not off a clock', () => {
    expect(dayOfMonth('2026-08-19')).toBe('19');
    expect(dayOfMonth('2026-08-01')).toBe('1');
    expect(dayOfMonth('nope')).toBe('');
  });
});
