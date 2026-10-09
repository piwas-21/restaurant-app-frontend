'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TableServiceSessionDto } from '@/types/order';
import { getCashierTables } from '@/services/server/tables';
import {
  getActiveTableServiceSessions,
  getReleasedTableServiceSessions,
  openTableServiceSession,
} from '@/services/tableServiceSessionService';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { getErrorMessage } from '@/utils/apiClient';
import { tableNumberKey } from '@/lib/cashierTableSession';
import { mergeCashierTableEntries, type CashierTableEntry } from '@/lib/cashierTableEntries';
import { STAFF_PAYMENT_HANDOFF_REFRESH_MS } from '@/lib/config';
import { useCashierLegacyTableActions } from './useCashierLegacyTableActions';

export type { CashierTableEntry, CashierTableStatus } from '@/lib/cashierTableEntries';
export { hasLegacyTableOrders } from '@/lib/cashierTableEntries';

export interface CashierTablesState {
  readonly entries: readonly CashierTableEntry[];
  readonly releasedSessions: readonly TableServiceSessionDto[];
  readonly queueState: 'loading' | 'ready' | 'stale' | 'unavailable';
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly openSession: (tableNumber: string) => Promise<TableServiceSessionDto>;
  readonly repairLegacyOrders: (tableId: string) => Promise<TableServiceSessionDto>;
  readonly clearLegacyTableOrders: (tableNumber: string) => Promise<void>;
  readonly repairSuccess: boolean;
}

async function openResolvedTableSession(tableId: string, tableNumber: string): Promise<TableServiceSessionDto> {
  if (tableId) return openTableServiceSession({ tableId });
  const numericTable = Number(tableNumber);
  if (Number.isSafeInteger(numericTable) && numericTable > 0) return openTableServiceSession(numericTable);
  throw new Error('cashier.tables.invalid_table');
}

export function useCashierTables(): CashierTablesState {
  const { tableVisitReadinessV1 = false } = useTenantFeatures();
  const [entries, setEntries] = useState<CashierTableEntry[]>([]);
  const [releasedSessions, setReleasedSessions] = useState<TableServiceSessionDto[]>([]);
  const [queueState, setQueueState] = useState<CashierTablesState['queueState']>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairSuccess, setRepairSuccess] = useState(false);
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

  const refresh = useCallback(
    async (options?: { allowInFlightMutation?: boolean }) => {
      if (inFlightRef.current && !options?.allowInFlightMutation) return;
      const requestId = ++requestRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const [tables, sessions, released] = await Promise.all([
          getCashierTables(),
          getActiveTableServiceSessions(),
          getReleasedTableServiceSessions(),
        ]);
        if (!mountedRef.current || requestId !== requestRef.current) return;
        const merged = mergeCashierTableEntries(tables, sessions, tableVisitReadinessV1);
        setEntries(merged);
        setReleasedSessions(released);
        hasEntriesRef.current = merged.length > 0;
        setQueueState('ready');
      } catch (reason: unknown) {
        if (!mountedRef.current || requestId !== requestRef.current) return;
        setQueueState(hasEntriesRef.current ? 'stale' : 'unavailable');
        setError(getErrorMessage(reason) ?? 'cashier.tables.load_error');
      } finally {
        if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
      }
    },
    [tableVisitReadinessV1],
  );

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), STAFF_PAYMENT_HANDOFF_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const createSession = useCallback(
    async (tableNumber: string) => {
      const exact = tableNumber.trim().toLocaleLowerCase();
      const exactEntry = entries.find((candidate) => candidate.table.tableNumber.trim().toLocaleLowerCase() === exact);
      const key = tableNumberKey(tableNumber);
      const compatibleEntries = entries.filter((candidate) => tableNumberKey(candidate.table.tableNumber) === key);
      const entry = exactEntry ?? (compatibleEntries.length === 1 ? compatibleEntries[0] : undefined);
      if (entry?.status !== 'available') throw new Error('cashier.tables.open_failed');
      if (inFlightRef.current) throw new Error('cashier.tables.operation_pending');
      const mutationId = ++mutationRef.current;
      // A refresh started before this write must not be allowed to overwrite the new session.
      requestRef.current += 1;
      setIsLoading(false);
      inFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      try {
        const tableId = entry.table.id.trim();
        const normalized = tableNumber.trim();
        const session = await openResolvedTableSession(tableId, normalized);
        if (mountedRef.current) {
          setEntries((current) => {
            const next = current.filter((candidate) => candidate.table.id !== entry.table.id);
            const table = current.find((candidate) => candidate.table.id === entry.table.id)?.table ?? {
              id: `session-${session.serviceSessionId}`,
              tableNumber: normalized,
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

  const legacyActions = useCashierLegacyTableActions({
    refresh,
    requestRef,
    mutationRef,
    inFlightRef,
    mountedRef,
    setIsLoading,
    setIsMutating,
    setError,
    setEntries,
    setRepairSuccess,
  });

  return {
    entries,
    releasedSessions,
    queueState,
    isLoading,
    isMutating,
    error,
    refresh,
    openSession: createSession,
    repairLegacyOrders: legacyActions.repairLegacyOrders,
    clearLegacyTableOrders: legacyActions.clearLegacyTableOrders,
    repairSuccess,
  };
}
