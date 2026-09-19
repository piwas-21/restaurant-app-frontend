import { addCalendarDays, daysBetween, isCalendarDay } from '@/utils/calendarDay';
import type { CashierHistoryRange } from './cashierHistoryTypes';

const HISTORY_RANGES: ReadonlySet<string> = new Set<string>(['today', 'yesterday', 'week', 'custom']);
const MONDAY_ANCHOR = '1970-01-05';

function readRange(value: string | null): CashierHistoryRange {
  return value && HISTORY_RANGES.has(value) ? (value as CashierHistoryRange) : 'today';
}

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function readDay(value: string | null): string {
  return value && isCalendarDay(value) ? value : '';
}

function mondayFor(day: string): string | null {
  if (!isCalendarDay(day)) return null;
  const offset = ((daysBetween(MONDAY_ANCHOR, day) % 7) + 7) % 7;
  return addCalendarDays(day, -offset);
}

/**
 * Builds the API's date-only History contract. The server resolves these calendar days in the
 * tenant timezone; no browser Date or UTC instant is created for a range boundary.
 */
function historyDateWindow(range: CashierHistoryRange, tenantDay: string | undefined, fromDay: string, toDay: string) {
  if (range === 'today' && tenantDay) return { tenantDay };
  if (range === 'yesterday' && tenantDay) return { tenantDay: addCalendarDays(tenantDay, -1) ?? tenantDay };
  if (range === 'week' && tenantDay) {
    const monday = mondayFor(tenantDay);
    if (monday) return { tenantStartDay: monday, tenantEndDay: tenantDay };
  }
  if (range === 'custom' && isCalendarDay(fromDay) && isCalendarDay(toDay) && daysBetween(fromDay, toDay) >= 0) {
    return { tenantStartDay: fromDay, tenantEndDay: toDay };
  }
  return {};
}

export { historyDateWindow, mondayFor, readDay, readPage, readRange };
