import type { AccountPaymentMode, AccountPaymentState, AccountPaymentUnitSelection } from '@/types/accountPayments';
import type {
  GuestAccountPaymentAttemptDescriptor,
  GuestAccountPaymentQuoteDescriptor,
} from '@/types/guestAccountPayments';

export const PAYMENT_STORE_VERSION = 1;
export const MAX_PAYMENT_ATTEMPTS = 16;
export const MAX_STORED_UNITS = 500;
export const RECEIPT_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/;
const TERMINAL_RECEIPT_STATES = new Set<AccountPaymentState>(['Captured', 'Released', 'Failed']);

export interface StoredPaymentAttemptList {
  readonly version: typeof PAYMENT_STORE_VERSION;
  readonly attempts: readonly GuestAccountPaymentAttemptDescriptor[];
}

export function isStoredPaymentAttemptList(value: unknown): value is StoredPaymentAttemptList {
  if (!isRecord(value)) return false;
  const store = value as Partial<StoredPaymentAttemptList>;
  return (
    store.version === PAYMENT_STORE_VERSION &&
    Array.isArray(store.attempts) &&
    store.attempts.length <= MAX_PAYMENT_ATTEMPTS &&
    store.attempts.every(isAttempt)
  );
}

export function isGuestPaymentAttempt(value: unknown): value is GuestAccountPaymentAttemptDescriptor {
  return isAttempt(value);
}

export function pruneExpiredPaymentReceipts(
  attempts: readonly GuestAccountPaymentAttemptDescriptor[],
  now: number,
): GuestAccountPaymentAttemptDescriptor[] {
  return attempts.filter((attempt) => {
    if (
      !attempt.receiptExpiresAt ||
      !attempt.receiptTerminalState ||
      !TERMINAL_RECEIPT_STATES.has(attempt.receiptTerminalState)
    )
      return true;
    const expiry = Date.parse(attempt.receiptExpiresAt);
    return !Number.isFinite(expiry) || expiry > now;
  });
}

export function isTerminalPaymentReceipt(state: AccountPaymentState | null | undefined): boolean {
  return state !== null && state !== undefined && TERMINAL_RECEIPT_STATES.has(state);
}

function isAttempt(value: unknown): value is GuestAccountPaymentAttemptDescriptor {
  if (!isRecord(value)) return false;
  const attempt = value as Partial<GuestAccountPaymentAttemptDescriptor>;
  return (
    hasOnlyKeys(attempt, [
      'serviceSessionId',
      'operationId',
      'participantFingerprint',
      'quote',
      'contribution',
      'quotedVersion',
      'reservedExpectedVersion',
      'receiptCredential',
      'startRequestedAt',
      'attemptId',
      'receiptExpiresAt',
      'receiptTerminalState',
      'createdAt',
    ]) &&
    typeof attempt.serviceSessionId === 'string' &&
    GUID.test(attempt.serviceSessionId) &&
    typeof attempt.operationId === 'string' &&
    GUID.test(attempt.operationId) &&
    (attempt.participantFingerprint === undefined ||
      attempt.participantFingerprint === null ||
      (typeof attempt.participantFingerprint === 'string' && FINGERPRINT.test(attempt.participantFingerprint))) &&
    isQuote(attempt.quote) &&
    Number.isSafeInteger(attempt.quote.expectedAccountRevision) &&
    attempt.quote.expectedAccountRevision > 0 &&
    isContribution(attempt.contribution) &&
    (attempt.quotedVersion === null || positiveInteger(attempt.quotedVersion)) &&
    (attempt.reservedExpectedVersion === null || positiveInteger(attempt.reservedExpectedVersion)) &&
    (attempt.receiptCredential === null ||
      (typeof attempt.receiptCredential === 'string' && RECEIPT_CREDENTIAL_PATTERN.test(attempt.receiptCredential))) &&
    (attempt.startRequestedAt === null ||
      (typeof attempt.startRequestedAt === 'number' &&
        Number.isFinite(attempt.startRequestedAt) &&
        attempt.startRequestedAt > 0)) &&
    (attempt.attemptId === null || (typeof attempt.attemptId === 'string' && GUID.test(attempt.attemptId))) &&
    (attempt.receiptExpiresAt === undefined ||
      attempt.receiptExpiresAt === null ||
      (typeof attempt.receiptExpiresAt === 'string' && Number.isFinite(Date.parse(attempt.receiptExpiresAt)))) &&
    (attempt.receiptTerminalState === undefined ||
      attempt.receiptTerminalState === null ||
      isPaymentState(attempt.receiptTerminalState)) &&
    typeof attempt.createdAt === 'number' &&
    Number.isFinite(attempt.createdAt) &&
    attempt.createdAt > 0
  );
}

function isContribution(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!isRecord(value) || !hasOnlyKeys(value, ['amountMinor', 'currency', 'snapshotFingerprint'])) return false;
  return (
    positiveInteger(value.amountMinor) &&
    typeof value.currency === 'string' &&
    /^[A-Z]{3}$/.test(value.currency) &&
    typeof value.snapshotFingerprint === 'string' &&
    FINGERPRINT.test(value.snapshotFingerprint)
  );
}

function isQuote(value: unknown): value is GuestAccountPaymentQuoteDescriptor {
  if (!isRecord(value)) return false;
  const quote = value as Partial<GuestAccountPaymentQuoteDescriptor>;
  if (
    !hasOnlyKeys(quote, [
      'expectedAccountRevision',
      'mode',
      'paymentMethod',
      'selectedUnits',
      'amountMinor',
      'equalSharePlanId',
      'equalShareOrdinal',
    ]) ||
    quote.paymentMethod !== 'OnlinePayment' ||
    !isPaymentMode(quote.mode)
  )
    return false;
  if (!positiveInteger(quote.expectedAccountRevision)) return false;
  if (quote.mode === 'Items') return isUnitList(quote.selectedUnits);
  if (quote.mode === 'Amount') return positiveInteger(quote.amountMinor);
  return (
    typeof quote.equalSharePlanId === 'string' &&
    GUID.test(quote.equalSharePlanId) &&
    positiveInteger(quote.equalShareOrdinal)
  );
}

function isUnitList(value: unknown): value is readonly AccountPaymentUnitSelection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STORED_UNITS) return false;
  return value.every(
    (unit) =>
      isRecord(unit) &&
      hasOnlyKeys(unit, ['orderId', 'orderItemId', 'ordinal']) &&
      typeof unit.orderId === 'string' &&
      GUID.test(unit.orderId) &&
      typeof unit.orderItemId === 'string' &&
      GUID.test(unit.orderItemId) &&
      positiveInteger(unit.ordinal),
  );
}

function isPaymentMode(value: unknown): value is AccountPaymentMode {
  return value === 'Items' || value === 'Amount' || value === 'Equal';
}

function isPaymentState(value: unknown): value is AccountPaymentState {
  return (
    value === 'Quoted' ||
    value === 'Reserved' ||
    value === 'Starting' ||
    value === 'Processing' ||
    value === 'Captured' ||
    value === 'CancelRequested' ||
    value === 'Released' ||
    value === 'Failed' ||
    value === 'ReconciliationRequired'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
