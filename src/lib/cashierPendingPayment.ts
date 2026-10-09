import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderPaymentDto } from '@/types/order';

export type PendingPaymentStatus = 'Checking' | 'Unknown' | 'Unavailable' | 'Refused';

export interface PendingPaymentOperation extends AddPaymentRequest {
  readonly orderId: string;
  readonly status: PendingPaymentStatus;
  /** Browser-only evidence; never part of the order-payment API request. */
  readonly cashReceivedMinor?: number;
}

export function withPendingPaymentStatus(
  orderId: string,
  payment: AddPaymentRequest,
  status: PendingPaymentStatus,
  cashReceivedMinor?: number,
): PendingPaymentOperation {
  return { ...payment, orderId, status, cashReceivedMinor };
}

export function matchesPendingPayment(saved: PendingPaymentOperation, committed: OrderPaymentDto): boolean {
  const requestedMinor = Math.round(saved.amount * 100);
  const committedMinor = Math.round(committed.amount * 100);
  return (
    committed.orderId.toLowerCase() === saved.orderId.toLowerCase() &&
    committed.operationId?.toLowerCase() === saved.operationId.toLowerCase() &&
    committed.paymentMethod === saved.paymentMethod &&
    Number.isSafeInteger(requestedMinor) &&
    Number.isSafeInteger(committedMinor) &&
    committedMinor === requestedMinor &&
    (committed.tipMinor ?? 0) === (saved.tipMinor ?? 0)
  );
}

export type PendingPaymentReadResult =
  | { readonly status: 'none' }
  | { readonly status: 'other-order'; readonly operation: PendingPaymentOperation }
  | { readonly status: 'pending'; readonly operation: PendingPaymentOperation }
  | { readonly status: 'unavailable' };

export type PendingPaymentPersistResult = 'saved' | 'blocked' | 'write-failed';

const STORAGE_KEY = 'cashier.pending-payment';

interface StoredPendingPayment {
  readonly orderId?: unknown;
  readonly operationId?: unknown;
  readonly paymentMethod?: unknown;
  readonly amount?: unknown;
  readonly tipMinor?: unknown;
  readonly expectedVersion?: unknown;
  readonly transactionId?: unknown;
  readonly referenceNumber?: unknown;
  readonly cardLastFourDigits?: unknown;
  readonly cardType?: unknown;
  readonly paymentNotes?: unknown;
  readonly cashReceivedMinor?: unknown;
}

interface ValidStoredPendingPayment extends StoredPendingPayment {
  readonly orderId: string;
  readonly operationId: string;
  readonly paymentMethod: string;
  readonly amount: number;
  readonly tipMinor?: number;
  readonly expectedVersion?: number;
  readonly transactionId?: string;
  readonly referenceNumber?: string;
  readonly cardLastFourDigits?: string;
  readonly cardType?: string;
  readonly paymentNotes?: string;
  readonly cashReceivedMinor?: number;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isValidStoredPayment(value: unknown): value is ValidStoredPendingPayment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const payment = value as StoredPendingPayment;
  return (
    typeof payment.orderId === 'string' &&
    payment.orderId.trim().length > 0 &&
    typeof payment.operationId === 'string' &&
    payment.operationId.trim().length > 0 &&
    typeof payment.paymentMethod === 'string' &&
    payment.paymentMethod.trim().length > 0 &&
    typeof payment.amount === 'number' &&
    Number.isFinite(payment.amount) &&
    payment.amount > 0 &&
    (payment.expectedVersion === undefined ||
      (typeof payment.expectedVersion === 'number' && Number.isSafeInteger(payment.expectedVersion))) &&
    (payment.tipMinor === undefined ||
      (typeof payment.tipMinor === 'number' && Number.isSafeInteger(payment.tipMinor) && payment.tipMinor >= 0)) &&
    (payment.cashReceivedMinor === undefined ||
      (payment.paymentMethod === 'Cash' &&
        typeof payment.cashReceivedMinor === 'number' &&
        Number.isSafeInteger(payment.cashReceivedMinor) &&
        payment.cashReceivedMinor >= Math.round(Number(payment.amount) * 100) + (Number(payment.tipMinor) || 0))) &&
    isOptionalString(payment.transactionId) &&
    isOptionalString(payment.referenceNumber) &&
    isOptionalString(payment.cardLastFourDigits) &&
    isOptionalString(payment.cardType) &&
    isOptionalString(payment.paymentNotes)
  );
}

function toPendingPayment(value: ValidStoredPendingPayment): PendingPaymentOperation {
  return {
    orderId: value.orderId,
    operationId: value.operationId,
    paymentMethod: value.paymentMethod,
    amount: value.amount,
    tipMinor: value.tipMinor,
    expectedVersion: value.expectedVersion,
    transactionId: value.transactionId,
    referenceNumber: value.referenceNumber,
    cardLastFourDigits: value.cardLastFourDigits,
    cardType: value.cardType,
    paymentNotes: value.paymentNotes,
    cashReceivedMinor: value.cashReceivedMinor,
    status: 'Checking',
  };
}

/** Read the tab's one pending tender without assuming which order is currently selected. */
export function readAnyPendingPayment(): PendingPaymentReadResult {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return { status: 'none' };
    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredPayment(parsed)) return { status: 'unavailable' };
    return { status: 'pending', operation: toPendingPayment(parsed) };
  } catch (_error) {
    // A damaged or unreadable descriptor can still represent an in-flight tender, so callers must block.
    return { status: 'unavailable' };
  }
}

/** Resolve storage state for an order; an unreadable or other-order journal must block new writes. */
export function readPendingPaymentState(orderId: string | null): PendingPaymentReadResult {
  if (!orderId || typeof window === 'undefined') return { status: 'none' };
  const result = readAnyPendingPayment();
  if (result.status !== 'pending' || result.operation.orderId.toLowerCase() === orderId.toLowerCase()) return result;
  return { status: 'other-order', operation: result.operation };
}

/** Persist the exact payload before the POST so a reload can reconcile, never replay, it. */
export function persistPendingPayment(
  orderId: string,
  payment: AddPaymentRequest,
  cashReceivedMinor?: number,
): PendingPaymentPersistResult {
  if (typeof window === 'undefined') return 'write-failed';
  if (readAnyPendingPayment().status !== 'none') return 'blocked';
  try {
    const serialized = JSON.stringify({
      orderId,
      ...payment,
      ...(cashReceivedMinor === undefined ? {} : { cashReceivedMinor }),
    });
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
    if (window.sessionStorage.getItem(STORAGE_KEY) !== serialized) return 'write-failed';
    const saved = readAnyPendingPayment();
    return saved.status === 'pending' &&
      saved.operation.orderId === orderId &&
      saved.operation.operationId === payment.operationId &&
      saved.operation.cashReceivedMinor === cashReceivedMinor
      ? 'saved'
      : 'write-failed';
  } catch (_error) {
    return 'write-failed';
  }
}

/** Clear only the operation that was just resolved; a newer pending operation is preserved. */
export function clearPendingPayment(operationId: string, orderId?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const result = readAnyPendingPayment();
    if (result.status === 'none') return true;
    if (
      result.status !== 'pending' ||
      result.operation.operationId !== operationId ||
      (orderId !== undefined && result.operation.orderId.toLowerCase() !== orderId.toLowerCase())
    ) {
      return false;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
    return window.sessionStorage.getItem(STORAGE_KEY) === null;
  } catch (_error) {
    // Storage is best effort; the server operation remains the source of truth.
    return false;
  }
}
