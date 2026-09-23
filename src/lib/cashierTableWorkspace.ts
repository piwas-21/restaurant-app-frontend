import { tableNumberKey } from '@/lib/cashierTableSession';
import type { CashierTableEntry } from '@/lib/cashierTableEntries';
import type { CashierQueueState } from '@/types/cashier';

export function findSelectedCashierTableEntry(
  entries: readonly CashierTableEntry[],
  sessionId: string | null,
  tableNumber: string | null,
): CashierTableEntry | null {
  if (sessionId) {
    const normalized = sessionId.toLowerCase();
    return entries.find((entry) => entry.session?.serviceSessionId.toLowerCase() === normalized) ?? null;
  }
  if (!tableNumber) return null;
  const exact = tableNumber.trim().toLocaleLowerCase();
  const exactMatch = entries.find((entry) => entry.table.tableNumber.trim().toLocaleLowerCase() === exact);
  if (exactMatch) return exactMatch;
  const key = tableNumberKey(tableNumber);
  const compatible = entries.filter((entry) => tableNumberKey(entry.table.tableNumber) === key);
  return compatible.length === 1 ? compatible[0] : null;
}

export function cashierTableQueueState(
  base: CashierQueueState,
  sessionId: string | null,
  sessionLoading: boolean,
  sessionStale: boolean,
  hasSession: boolean,
  hasEntries: boolean,
): CashierQueueState {
  if (!sessionId) return base;
  if (sessionLoading) return 'loading';
  if (!sessionStale) return base;
  return hasSession || hasEntries ? 'stale' : 'unavailable';
}
