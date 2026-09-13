'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TableDto } from '@/types/reservation';
import type { TableServiceSessionDto } from '@/types/order';
import { getCashierTables } from '@/services/server/tables';
import { getActiveTableServiceSessions, openTableServiceSession } from '@/services/tableServiceSessionService';
import { getErrorMessage } from '@/utils/apiClient';
import { tableNumberKey } from '@/lib/cashierTableSession';

export type CashierTableStatus = 'available' | 'occupied' | 'closed' | 'legacy' | 'reserved' | 'conflict';

export interface CashierTableEntry {
  readonly table: TableDto;
  readonly session: TableServiceSessionDto | null;
  readonly status: CashierTableStatus;
}

export interface CashierTablesState {
  readonly entries: readonly CashierTableEntry[];
  readonly queueState: 'loading' | 'ready' | 'stale' | 'unavailable';
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly openSession: (tableNumber: string) => Promise<TableServiceSessionDto>;
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

function mergeEntries(tables: readonly TableDto[], sessions: readonly TableServiceSessionDto[]): CashierTableEntry[] {
  const byTable = new Map(sessions.map((session) => [tableNumberKey(session.tableNumber), session]));
  const known = new Set<string>();
  const entries: CashierTableEntry[] = tables.map((table) => {
    const key = tableNumberKey(table.tableNumber);
    known.add(key);
    const session = byTable.get(key) ?? null;
    return { table, session, status: tableStatus(table, session) };
  });

  // A session without a table row remains visible in the list instead of becoming an invisible bill.
  sessions.forEach((session) => {
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

  return entries.sort((left, right) =>
    left.table.tableNumber.localeCompare(right.table.tableNumber, undefined, { numeric: true }),
  );
}

export function useCashierTables(): CashierTablesState {
  const [entries, setEntries] = useState<CashierTableEntry[]>([]);
  const [queueState, setQueueState] = useState<CashierTablesState['queueState']>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const mutationRef = useRef(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const hasEntriesRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      mutationRef.current += 1;
      inFlightRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [tables, sessions] = await Promise.all([getCashierTables(), getActiveTableServiceSessions()]);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      const merged = mergeEntries(tables, sessions);
      setEntries(merged);
      hasEntriesRef.current = merged.length > 0;
      setQueueState('ready');
    } catch (reason: unknown) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setQueueState(hasEntriesRef.current ? 'stale' : 'unavailable');
      setError(getErrorMessage(reason) ?? 'cashier.tables.load_error');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSession = useCallback(
    async (tableNumber: string) => {
      const key = tableNumberKey(tableNumber);
      const entry = entries.find((candidate) => tableNumberKey(candidate.table.tableNumber) === key);
      if (!entry || entry.status !== 'available') throw new Error('cashier.tables.open_failed');
      const normalized = tableNumber.trim();
      if (!/^\d+$/.test(normalized)) throw new Error('cashier.tables.invalid_table');
      const numericTable = Number(normalized);
      if (!Number.isSafeInteger(numericTable) || numericTable <= 0) throw new Error('cashier.tables.invalid_table');
      if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
      const mutationId = ++mutationRef.current;
      // A refresh started before this write must not be allowed to overwrite the new session.
      requestRef.current += 1;
      setIsLoading(false);
      inFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      try {
        const session = await openTableServiceSession(numericTable);
        if (mountedRef.current) {
          setEntries((current) => {
            const key = tableNumberKey(tableNumber);
            const next = current.filter((entry) => tableNumberKey(entry.table.tableNumber) !== key);
            const table = current.find((entry) => tableNumberKey(entry.table.tableNumber) === key)?.table ?? {
              id: `session-${session.serviceSessionId}`,
              tableNumber: String(numericTable),
              maxGuests: 0,
              isActive: true,
              isOutdoor: false,
              positionX: 0,
              positionY: 0,
            };
            const nextEntry: CashierTableEntry = { table, session, status: 'occupied' };
            return [...next, nextEntry].sort((left, right) =>
              left.table.tableNumber.localeCompare(right.table.tableNumber, undefined, { numeric: true }),
            );
          });
        }
        return session;
      } catch (reason: unknown) {
        if (mountedRef.current) setError(getErrorMessage(reason) ?? 'cashier.tables.open_failed');
        throw reason;
      } finally {
        if (mutationId === mutationRef.current) {
          inFlightRef.current = false;
          if (mountedRef.current) setIsMutating(false);
        }
      }
    },
    [entries],
  );

  return { entries, queueState, isLoading, isMutating, error, refresh, openSession: createSession };
}
