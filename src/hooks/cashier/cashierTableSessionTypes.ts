import type { AddTableServiceSessionPaymentRequest, TableServiceSessionDto } from '@/types/order';
import type { PendingTableOperation } from '@/lib/cashierTablePending';

export interface CashierTableSessionState {
  readonly session: TableServiceSessionDto | null;
  readonly isLoading: boolean;
  readonly isMutating: boolean;
  readonly isStale: boolean;
  readonly error: string | null;
  readonly pendingOperation: PendingTableOperation | null;
  readonly refresh: () => Promise<void>;
  readonly submitPayment: (payment: AddTableServiceSessionPaymentRequest) => Promise<TableServiceSessionDto>;
  readonly closeSession: () => Promise<TableServiceSessionDto>;
  /** Lookup-only reconciliation; it never replays an uncertain payment POST. */
  readonly reconcilePendingOperation: () => Promise<void>;
}
