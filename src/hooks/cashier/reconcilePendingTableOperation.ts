import type { Dispatch, SetStateAction } from 'react';
import type { PendingTableOperation } from '@/lib/cashierTablePending';
import type { TableServiceSessionDto } from '@/types/order';
import { reconcilePendingTablePayment } from './reconcilePendingTablePayment';
import { reconcilePendingTableClose } from './reconcilePendingTableClose';

type NumberRef = { current: number };
type BooleanRef = { current: boolean };

interface ReconcilePendingTableOperationOptions {
  readonly serviceSessionId: string;
  readonly pendingOperation: PendingTableOperation;
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

/**
 * One entry point for resuming an unknown outcome. Payments reconcile through the operation
 * lookup (money may have moved); a close resolves through one guarded re-read of the visit
 * (its only effect is the status the re-read reports).
 */
export async function reconcilePendingTableOperation({
  pendingOperation,
  ...options
}: ReconcilePendingTableOperationOptions): Promise<void> {
  if (pendingOperation.kind === 'payment') {
    await reconcilePendingTablePayment({ ...options, pendingOperation });
    return;
  }
  await reconcilePendingTableClose({ ...options, pendingOperation });
}
