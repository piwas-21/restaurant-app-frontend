'use client';

import { useCallback } from 'react';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import type { TableServiceSessionDto } from '@/types/order';
import type { TableReadinessOutcome } from '@/types/tableReadiness';

interface Route {
  readonly selectedSessionId: string | null;
  readonly navigateToTable: (tableNumber: string, serviceSessionId?: string) => void;
}

interface Tables {
  readonly queueState: 'loading' | 'ready' | 'stale' | 'unavailable';
  readonly isLoading: boolean;
}

/** Return from a released visit only after its table has a fresh, ready, empty projection. */
export function useCashierReadyTableReturn(
  route: Route,
  selectedSession: TableServiceSessionDto | null,
  selectedEntry: CashierTableEntry | null,
  tables: Tables,
) {
  const { selectedSessionId, navigateToTable } = route;
  const { queueState, isLoading } = tables;
  return useCallback(
    (outcome: TableReadinessOutcome) => {
      if (
        !selectedSessionId ||
        selectedSession?.serviceSessionId.toLowerCase() !== selectedSessionId.toLowerCase() ||
        (!selectedSession.isTableReleased && !selectedSession.releasedAt) ||
        !selectedEntry ||
        selectedEntry.session ||
        selectedEntry.table.id.toLowerCase() !== outcome.tableId.toLowerCase() ||
        selectedEntry.table.readinessState !== 'ReadyForGuests' ||
        !Number.isSafeInteger(selectedEntry.table.readinessVersion) ||
        (selectedEntry.table.readinessVersion ?? 0) < outcome.readinessVersion ||
        queueState !== 'ready' ||
        isLoading
      ) {
        return;
      }
      const samePriorTable = selectedSession.tableId
        ? selectedSession.tableId.toLowerCase() === selectedEntry.table.id.toLowerCase()
        : selectedSession.tableNumber != null &&
          Number(selectedEntry.table.tableNumber) === selectedSession.tableNumber;
      if (samePriorTable) navigateToTable(selectedEntry.table.tableNumber);
    },
    [isLoading, navigateToTable, queueState, selectedEntry, selectedSession, selectedSessionId],
  );
}
