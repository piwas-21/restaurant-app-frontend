/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { calendarDayFromReport } from './zReportDay';

// The zone is the whole point of this suite, so it is asserted rather than assumed: on a
// UTC-clocked host (which every CI runner and container here is) a local-time implementation and
// a UTC one agree, and every assertion below would pass against the defect.
describe('the device is deliberately NOT on UTC', () => {
  it('renders the wire value as the PREVIOUS day in its own zone', () => {
    expect(new Date('2026-08-19T00:00:00Z').toLocaleDateString('en-CA')).toBe('2026-08-18');
  });
});

describe('calendarDayFromReport — which day the figures are for', () => {
  it('reads the wire day as UTC, whatever the device thinks', () => {
    // `reportDate` is a calendar day pinned at 00:00 UTC (`GetZReportQuery.cs`), not an instant.
    expect(calendarDayFromReport('2026-08-19T00:00:00Z')).toBe('2026-08-19');
  });

  it('accepts the other shapes a DateTime can reach the wire in', () => {
    expect(calendarDayFromReport('2026-08-19')).toBe('2026-08-19');
    // Unmarked midnight (`Kind = Unspecified`): `new Date()` would read this as LOCAL midnight
    // and hand back the previous UTC day anywhere east of UTC.
    expect(calendarDayFromReport('2026-08-19T00:00:00')).toBe('2026-08-19');
  });

  it('says "I do not know" rather than guessing', () => {
    // Never "today": an unreadable answer must not be displayed and then sent back as the next
    // request's `date`.
    expect(calendarDayFromReport('')).toBeNull();
    expect(calendarDayFromReport(null)).toBeNull();
    expect(calendarDayFromReport(undefined)).toBeNull();
    expect(calendarDayFromReport('not a date')).toBeNull();
    expect(calendarDayFromReport('19-08-2026')).toBeNull();
  });

  it('rejects a well-shaped day that does not exist', () => {
    // `new Date('2026-02-31T00:00:00Z')` is not NaN — it rolls forward to 3 March — so shape
    // alone would have displayed a day the report cannot be for.
    expect(calendarDayFromReport('2026-02-31T00:00:00Z')).toBeNull();
    expect(calendarDayFromReport('2026-13-01T00:00:00Z')).toBeNull();
  });
});
