'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { CashierTableEntry } from '@/hooks/cashier/useCashierTables';
import { useCashierTables } from '@/hooks/cashier/useCashierTables';
import { useCashierTableRoute } from '@/hooks/cashier/useCashierTableRoute';
import type { TableServiceSessionDto } from '@/types/order';

export function useCashierTableWorkspaceActions(
  selectedEntry: CashierTableEntry | null,
  tables: ReturnType<typeof useCashierTables>,
  route: ReturnType<typeof useCashierTableRoute>,
  setRecoveredSession: Dispatch<SetStateAction<TableServiceSessionDto | null>>,
) {
  const openSession = useCallback(async () => {
    if (!selectedEntry) return;
    const opened = await tables.openSession(selectedEntry.table.tableNumber);
    setRecoveredSession(null);
    route.navigateToSession(opened.serviceSessionId);
  }, [route, selectedEntry, setRecoveredSession, tables]);

  const resolveLegacyOrders = useCallback(async () => {
    if (!selectedEntry?.table.id) return;
    const repaired = await tables.repairLegacyOrders(selectedEntry.table.id);
    setRecoveredSession(repaired);
    route.navigateToSession(repaired.serviceSessionId);
    await tables.refresh();
  }, [route, selectedEntry, setRecoveredSession, tables]);

  return { openSession, resolveLegacyOrders };
}
