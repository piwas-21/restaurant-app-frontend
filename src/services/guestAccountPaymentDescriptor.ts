import type { AccountPaymentState } from '@/types/accountPayments';
import type {
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentQuoteDescriptor,
} from '@/types/guestAccountPayments';

const TERMINAL_RECEIPT_STATES = new Set<AccountPaymentState>(['Captured', 'Released', 'Failed']);

export function createGuestAccountPaymentDescriptor(
  serviceSessionId: string,
  operationId: string,
  quote: GuestAccountPaymentQuoteDescriptor,
  participantFingerprint: string,
): GuestAccountPaymentAttemptDescriptor {
  return {
    serviceSessionId,
    operationId,
    participantFingerprint,
    quote,
    contribution: null,
    quotedVersion: null,
    reservedExpectedVersion: null,
    receiptCredential: null,
    startRequestedAt: null,
    attemptId: null,
    receiptExpiresAt: null,
    receiptTerminalState: null,
    createdAt: Date.now(),
  };
}

export function withQuotedOperation(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  quotedVersion: number,
  contribution: NonNullable<GuestAccountPaymentAttemptDescriptor['contribution']>,
): GuestAccountPaymentAttemptDescriptor {
  return { ...descriptor, quotedVersion, contribution };
}

export function withReservation(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  reservedExpectedVersion: number,
  receiptCredential: string,
): GuestAccountPaymentAttemptDescriptor {
  return { ...descriptor, reservedExpectedVersion, receiptCredential };
}

export function withCheckoutAttempt(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  attemptId: string,
): GuestAccountPaymentAttemptDescriptor {
  return { ...descriptor, attemptId };
}

export function withReceiptExpiry(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  receiptExpiresAt: string | null | undefined,
  state: AccountPaymentState,
  reconciliationRequired = false,
): GuestAccountPaymentAttemptDescriptor {
  return {
    ...descriptor,
    receiptExpiresAt: receiptExpiresAt ?? null,
    receiptTerminalState: !reconciliationRequired && TERMINAL_RECEIPT_STATES.has(state) ? state : null,
  };
}

export function withStartRequested(
  descriptor: GuestAccountPaymentAttemptDescriptor,
  requestedAt = Date.now(),
): GuestAccountPaymentAttemptDescriptor {
  return { ...descriptor, startRequestedAt: descriptor.startRequestedAt ?? requestedAt };
}
