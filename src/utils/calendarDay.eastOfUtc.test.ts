/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "Europe/Zurich"}
 */
import { addCalendarDays, todayOnDevice, weekdayLabel } from './calendarDay';

/**
 * The east-of-UTC half. One zone cannot pin both directions: west of UTC catches a UTC-anchored day
 * rendered on the local clock, and only east of it catches a LOCAL day pushed back through
 * `toISOString()` — which is exactly what the reservation form did to the day it sent (#517).
 */
describe('the device is deliberately EAST of UTC', () => {
  it('pushes a local midnight back into the previous UTC day', () => {
    expect(new Date('2026-08-19T00:00:00').toISOString().split('T')[0]).toBe('2026-08-18');
  });
});

describe('read east of UTC', () => {
  it('todayOnDevice does not roll back a day the way toISOString does', () => {
    // 00:30 on the 19th in Zurich is 22:30 on the 18th in UTC — the exact window a till closed in
    // (#511) and a guest books a table in (#517).
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-18T22:30:00Z'));

    try {
      expect(todayOnDevice()).toBe('2026-08-19');
      expect(new Date().toISOString().split('T')[0]).toBe('2026-08-18');
    } finally {
      jest.useRealTimers();
    }
  });

  it('addCalendarDays returns the day it was asked for, not the one before', () => {
    expect(addCalendarDays('2026-08-19', 0)).toBe('2026-08-19');
    expect(addCalendarDays('2026-08-19', 1)).toBe('2026-08-20');
    // Zurich's own DST transitions, for the same reason the western suite pins its zone's.
    expect(addCalendarDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addCalendarDays('2026-10-24', 1)).toBe('2026-10-25');
  });

  it('weekdayLabel names the weekday of the day itself', () => {
    expect(weekdayLabel('2026-08-19', 'en')).toBe('Wed');
  });
});
