import { getTableServiceSession } from '@/services/tableServiceSessionService';
import { clearPendingTableOperation } from '@/lib/cashierTablePending';
import type { PendingTableOperation } from '@/lib/cashierTablePending';
import type { TableServiceSessionDto } from '@/types/order';
import {
  beginTableSessionMutation,
  finishTableSessionMutation,
  isCurrentTableSessionMutation,
} from './tableSessionMutation';

type NumberRef = { current: number };
type BooleanRef = { current: boolean };
type CloseOperation = Extract<PendingTableOperation, { kind: 'close' }>;

interface ReconcilePendingTableCloseOptions {
  readonly serviceSessionId: string;
  readonly pendingOperation: CloseOperation;
  readonly mountedRef: BooleanRef;
  readonly requestRef: NumberRef;
  readonly operationRef: NumberRef;
  readonly inFlightRef: BooleanRef;
  readonly setIsLoading: (value: boolean) => void;
  readonly setIsMutating: (value: boolean) => void;
  readonly setPendingOperation: (value: PendingTableOperation | null) => void;
  readonly setSession: (value: TableServiceSessionDto) => void;
  readonly setIsStale: (value: boolean) => void;
  readonly setError: (value: string | null) => void;
}

/**
 * Resolve an unknown close with one guarded re-read. A close moves no money: the visit either is
 * Closed (the close committed) or Open (it never did), so the server's own answer settles the
 * pending operation in both directions instead of dead-ending the workspace behind a lock.
 */
export async function reconcilePendingTableClose({
  serviceSessionId,
  pendingOperation: saved,
  mountedRef,
  requestRef,
  operationRef,
  inFlightRef,
  setIsLoading,
  setIsMutating,
  setPendingOperation,
  setSession,
  setIsStale,
  setError,
}: ReconcilePendingTableCloseOptions): Promise<void> {
  const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
  const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
  setPendingOperation({ ...saved, status: 'Checking' });
  setIsMutating(true);
  setError(null);
  try {
    const result = await getTableServiceSession(serviceSessionId);
    if (!current()) return;
    setSession(result);
    setIsStale(false);
    clearPendingTableOperation(serviceSessionId);
    setPendingOperation(null);
    // Open means the close never committed; surface it so retrying is a deliberate new decision.
    setError(result.status === 'Closed' ? null : 'cashier.tables.close_not_recorded');
  } catch (reason: unknown) {
    if (!current()) return;
    setPendingOperation({ ...saved, status: 'Unknown' });
    setError('cashier.tables.reconciliation_unavailable');
    throw reason;
  } finally {
    finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
  }
}
