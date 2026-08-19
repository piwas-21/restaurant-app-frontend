/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "Europe/Zurich"}
 */
import { calendarDayFromReport } from './zReportDay';

// The east-of-UTC half of `zReportDay.test.ts` — the tenant's OWN zone. One zone cannot pin both
// directions: west of UTC catches a reader that formats the day on the local clock, and only east
// of it catches one that pushes a local midnight back through `toISOString()`. Measured: with the
// implementation replaced by `new Date(reportDate).toISOString().split('T')[0]`, every assertion in
// the west suite still passed and this file goes red.
describe('the device is deliberately EAST of UTC', () => {
  it('pushes a local midnight back into the previous UTC day', () => {
    expect(new Date('2026-08-19T00:00:00').toISOString().split('T')[0]).toBe('2026-08-18');
  });
});

describe('calendarDayFromReport — read east of UTC', () => {
  it('reads an unmarked midnight as the day it names', () => {
    // `DateTime` with `Kind = Unspecified` reaches the wire without a `Z`. `new Date()` reads that
    // as LOCAL midnight, and any round-trip through UTC then names the previous day.
    expect(calendarDayFromReport('2026-08-19T00:00:00')).toBe('2026-08-19');
  });

  it('reads a UTC-marked midnight as the same day', () => {
    expect(calendarDayFromReport('2026-08-19T00:00:00Z')).toBe('2026-08-19');
    expect(calendarDayFromReport('2026-08-19')).toBe('2026-08-19');
  });
});
