import type { Dispatch, SetStateAction } from 'react';
import { lookupTableServiceSessionPaymentOperation } from '@/services/tableServiceSessionService';
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
type PaymentOperation = Extract<PendingTableOperation, { kind: 'payment' }>;

interface ReconcilePendingTablePaymentOptions {
  readonly serviceSessionId: string;
  readonly pendingOperation: PaymentOperation;
  readonly mountedRef: BooleanRef;
  readonly requestRef: NumberRef;
  readonly operationRef: NumberRef;
  readonly inFlightRef: BooleanRef;
  readonly setIsLoading: (value: boolean) => void;
  readonly setIsMutating: (value: boolean) => void;
  readonly setPendingOperation: Dispatch<SetStateAction<PendingTableOperation | null>>;
  readonly setSession: Dispatch<SetStateAction<TableServiceSessionDto | null>>;
  readonly setIsStale: (value: boolean) => void;
  readonly setError: (value: string | null) => void;
}

/** Reconcile by operation key only. It deliberately has no payment replay path. */
export async function reconcilePendingTablePayment({
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
}: ReconcilePendingTablePaymentOptions): Promise<void> {
  const operationId = beginTableSessionMutation(requestRef, inFlightRef, setIsLoading, operationRef);
  const current = () => isCurrentTableSessionMutation(mountedRef, operationRef, operationId);
  setPendingOperation({ ...saved, status: 'Checking' });
  setIsMutating(true);
  setError(null);
  try {
    const result = await lookupTableServiceSessionPaymentOperation(serviceSessionId, saved.operationId);
    if (!current()) return;
    if (result.operationId.toLowerCase() !== saved.operationId.toLowerCase()) {
      setPendingOperation({ ...saved, status: 'Unknown' });
      setError('cashier.tables.reconciliation_unavailable');
      return;
    }
    if (result.session) {
      setSession(result.session);
      setIsStale(false);
    }
    if (result.status === 'Committed') {
      clearPendingTableOperation(serviceSessionId, saved.operationId);
      setPendingOperation(null);
      setError(null);
    } else {
      setPendingOperation({ ...saved, status: 'Unknown' });
      setError('cashier.tables.payment_unknown');
    }
  } catch (reason: unknown) {
    if (!current()) return;
    setPendingOperation({ ...saved, status: 'Unknown' });
    setError('cashier.tables.reconciliation_unavailable');
    throw reason;
  } finally {
    finishTableSessionMutation(mountedRef, operationRef, inFlightRef, setIsMutating, operationId);
  }
}
