import type { TableDto } from '@/types/reservation';
import type { TableServiceSessionDto } from '@/types/order';
import { tableNumberKey } from '@/lib/cashierTableSession';

export type CashierTableStatus = 'available' | 'occupied' | 'closed' | 'legacy' | 'reserved' | 'conflict';

export interface CashierTableEntry {
  readonly table: TableDto;
  readonly session: TableServiceSessionDto | null;
  readonly status: CashierTableStatus;
}

const ACTIVE_TABLE_ORDER_STATUSES = new Set(['Pending', 'Confirmed', 'Preparing', 'Ready', 'PendingApproval']);

/**
 * The legacy table projection counts all active orders, including explicit-session members.
 * Compare that count with active rounds in the explicit bill; a surplus is a conservative signal
 * that an unassigned round must be resolved before this visit can be collected or closed.
 */
export function hasLegacyTableOrders(
  table: Pick<TableDto, 'isOccupied' | 'activeOrderCount'>,
  session: Pick<TableServiceSessionDto, 'bill' | 'hasUnassignedActiveOrders' | 'legacyActiveOrderCount'>,
): boolean {
  if (!table.isOccupied) return false;
  if (typeof session.hasUnassignedActiveOrders === 'boolean') return session.hasUnassignedActiveOrders;
  if ((session.legacyActiveOrderCount ?? 0) > 0) return true;
  if (typeof table.activeOrderCount !== 'number') return true;
  const activeSessionRounds = session.bill.orders.filter((order) =>
    ACTIVE_TABLE_ORDER_STATUSES.has(order.status),
  ).length;
  return table.activeOrderCount > activeSessionRounds;
}

function tableStatus(
  table: Pick<TableDto, 'isActive' | 'isOccupied' | 'isReserved' | 'activeOrderCount'>,
  session: TableServiceSessionDto | null,
): CashierTableStatus {
  if (!table.isActive) return 'closed';
  if (session && hasLegacyTableOrders(table, session)) return 'conflict';
  if (session) return 'occupied';
  if (table.isOccupied) return 'legacy';
  if (table.isReserved) return 'reserved';
  return 'available';
}

/** Match visits by stable table identity; legacy number-only visits use the compatibility key. */
export function mergeCashierTableEntries(
  tables: readonly TableDto[],
  sessions: readonly TableServiceSessionDto[],
): CashierTableEntry[] {
  const byId = new Map<string, TableServiceSessionDto>();
  const byNumber = new Map<string, TableServiceSessionDto>();
  sessions.forEach((session) => {
    if (session.tableId) byId.set(session.tableId.toLowerCase(), session);
    else if (session.tableNumber != null) byNumber.set(tableNumberKey(session.tableNumber), session);
  });
  const matched = new Set<string>();
  const entries: CashierTableEntry[] = tables.map((table) => {
    const session = byId.get(table.id.toLowerCase()) ?? byNumber.get(tableNumberKey(table.tableNumber)) ?? null;
    if (session) matched.add(session.serviceSessionId);
    return { table, session, status: tableStatus(table, session) };
  });

  // Keep orphaned or historical sessions visible rather than hiding their bills.
  sessions.forEach((session) => {
    if (matched.has(session.serviceSessionId)) return;
    entries.push({
      table: {
        id: `session-${session.serviceSessionId}`,
        tableNumber: session.tableLabel?.trim() || (session.tableNumber != null ? String(session.tableNumber) : ''),
        maxGuests: 0,
        isActive: true,
        isOutdoor: false,
        positionX: 0,
        positionY: 0,
      },
      session,
      status: 'occupied',
    });
  });

  return entries.sort((left, right) => {
    const handoffOrder =
      Number(Boolean(right.session?.hasPendingPaymentHandoff)) -
      Number(Boolean(left.session?.hasPendingPaymentHandoff));
    return handoffOrder || left.table.tableNumber.localeCompare(right.table.tableNumber, undefined, { numeric: true });
  });
}
