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

/** Merge the physical table rows with their durable visits; label-only visits stay visible. */
export function mergeCashierTableEntries(
  tables: readonly TableDto[],
  sessions: readonly TableServiceSessionDto[],
): CashierTableEntry[] {
  // A label-only visit (nullable table number) cannot match a numbered table row; keep it separate
  // so it never merges into a "null" key while staying visible as its own bill.
  const byTable = new Map<string, TableServiceSessionDto>();
  const labelOnly: TableServiceSessionDto[] = [];
  sessions.forEach((session) => {
    if (session.tableNumber === null || session.tableNumber === undefined) {
      labelOnly.push(session);
      return;
    }
    byTable.set(tableNumberKey(session.tableNumber), session);
  });
  const known = new Set<string>();
  const entries: CashierTableEntry[] = tables.map((table) => {
    const key = tableNumberKey(table.tableNumber);
    known.add(key);
    const session = byTable.get(key) ?? null;
    return { table, session, status: tableStatus(table, session) };
  });

  // A session without a table row remains visible in the list instead of becoming an invisible bill.
  sessions.forEach((session) => {
    if (session.tableNumber === null || session.tableNumber === undefined) return;
    const key = tableNumberKey(session.tableNumber);
    if (known.has(key)) return;
    entries.push({
      table: {
        id: `session-${session.serviceSessionId}`,
        tableNumber: String(session.tableNumber),
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

  // Label-only visits render under their configured label (or an explicit unnamed fallback).
  labelOnly.forEach((session) => {
    entries.push({
      table: {
        id: `session-${session.serviceSessionId}`,
        tableNumber: session.tableLabel?.trim() || '',
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

  return entries.sort((left, right) =>
    left.table.tableNumber.localeCompare(right.table.tableNumber, undefined, { numeric: true }),
  );
}
