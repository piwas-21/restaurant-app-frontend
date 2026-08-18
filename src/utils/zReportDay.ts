/**
 * Which calendar day a Z-report is FOR.
 *
 * The day a till closes on is the RESTAURANT'S calendar day, and the browser cannot compute it:
 * a device knows its own timezone, never the tenant's (`Localization:TimeZone` — backend #372).
 * So the client stops naming "today" altogether. It omits the `date` parameter, lets the server
 * answer on the tenant's clock, and reads the day back off that answer (frontend #511).
 *
 * `ZReportDto.reportDate` is a calendar DAY pinned at 00:00 UTC on the wire
 * (`GetZReportQuery.cs` — "the calendar day the report is FOR, not the instant it starts at"),
 * never an instant. It must therefore be read as UTC: rendering it through the device's zone
 * prints the PREVIOUS day everywhere west of UTC, which is the same defect one layer down.
 */

// Anchored on the leading date part rather than on `new Date(...)` getters, because that is
// correct for every shape the server can emit — `2026-08-19T00:00:00Z` (what it emits today, a
// `DateTime` with `Kind = Utc`), a bare `2026-08-19`, and an unmarked `2026-08-19T00:00:00`,
// which `new Date()` would read as LOCAL midnight and hand back as the previous UTC day
// anywhere east of UTC.
const LEADING_CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/;

/**
 * The `YYYY-MM-DD` day a wire `reportDate` names, or `null` when it is not a date we recognise.
 * `null` means "the server did not tell us which day this is" — never "today".
 */
export function calendarDayFromReport(reportDate: string | null | undefined): string | null {
  if (typeof reportDate !== 'string') return null;

  const match = LEADING_CALENDAR_DAY.exec(reportDate);
  if (!match) return null;

  // The shape can match while the date does not exist (`2026-02-31`, `2026-13-01`). Round-trip it
  // through UTC and require the same three numbers back, so a nonsense day is reported as unknown
  // instead of being displayed and then sent back as the next request's `date`.
  const [, year, month, day] = match;
  const utc = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) return null;
  if (
    utc.getUTCFullYear() !== Number(year) ||
    utc.getUTCMonth() + 1 !== Number(month) ||
    utc.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}
