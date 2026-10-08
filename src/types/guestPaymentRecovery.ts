import type { GuestAccountPaymentAttemptDescriptor, GuestPaymentReceipt } from './guestAccountPayments';
import type { TableGuestVisitIdentity } from './tableGuestVisit';

export interface GuestPaymentAttemptSummary {
  readonly serviceSessionId: string;
  readonly operationId: string;
  readonly mode: GuestAccountPaymentAttemptDescriptor['quote']['mode'];
  readonly quotedVersion: number | null;
  readonly reservedExpectedVersion: number | null;
  readonly hasReceiptCredential: boolean;
  readonly unfinishedQuote: boolean;
  readonly startRequested: boolean;
  readonly attemptId: string | null;
  readonly createdAt: number;
}

export interface GuestPaymentReceiptSummary {
  readonly attemptId: string;
  readonly operationId: string;
  readonly receipt: GuestPaymentReceipt;
}

export interface GuestPaymentRecoveryOptions {
  readonly activeIdentity: TableGuestVisitIdentity | null;
  readonly recoveryIdentity: TableGuestVisitIdentity | null;
  readonly returnAttemptId: string | null;
  readonly runExclusive: <T>(operation: () => Promise<T>, blocked: T) => Promise<T>;
}
