import { PaymentMethod, type AddTableServiceSessionPaymentRequest } from '@/types/order';

export type TablePendingOperationStatus = 'Checking' | 'Unknown';
export type TablePendingOperationKind = 'payment' | 'close';

export interface PendingTablePayment extends AddTableServiceSessionPaymentRequest {
  readonly kind: 'payment';
  readonly serviceSessionId: string;
  readonly status: TablePendingOperationStatus;
}

export interface PendingTableClose {
  readonly kind: 'close';
  readonly serviceSessionId: string;
  readonly expectedVersion: number;
  readonly status: TablePendingOperationStatus;
}

export type PendingTableOperation = PendingTablePayment | PendingTableClose;

const STORAGE_KEY = 'cashier.pending-table-operation';
const PAYMENT_METHODS = new Set<string>(Object.values(PaymentMethod));
const OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StoredOperation = {
  readonly kind?: unknown;
  readonly serviceSessionId?: unknown;
  readonly status?: unknown;
  readonly operationId?: unknown;
  readonly expectedVersion?: unknown;
  readonly paymentMethod?: unknown;
  readonly amount?: unknown;
  readonly currency?: unknown;
  readonly transactionId?: unknown;
  readonly referenceNumber?: unknown;
  readonly cardLastFourDigits?: unknown;
  readonly cardType?: unknown;
  readonly paymentNotes?: unknown;
};

function readStored(): StoredOperation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null ? (value as StoredOperation) : null;
  } catch (_error) {
    return null;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sessionMatches(value: StoredOperation, serviceSessionId: string): boolean {
  return (
    typeof value.serviceSessionId === 'string' &&
    value.serviceSessionId.toLowerCase() === serviceSessionId.toLowerCase()
  );
}

function toStoredPayment(value: StoredOperation, serviceSessionId: string): PendingTablePayment | null {
  if (
    value.kind !== 'payment' ||
    !sessionMatches(value, serviceSessionId) ||
    typeof value.operationId !== 'string' ||
    !OPERATION_ID.test(value.operationId.trim()) ||
    typeof value.expectedVersion !== 'number' ||
    !Number.isInteger(value.expectedVersion) ||
    value.expectedVersion < 1 ||
    typeof value.paymentMethod !== 'string' ||
    !PAYMENT_METHODS.has(value.paymentMethod) ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0
  ) {
    return null;
  }

  return {
    kind: 'payment',
    serviceSessionId,
    operationId: value.operationId.trim(),
    expectedVersion: value.expectedVersion,
    paymentMethod: value.paymentMethod as AddTableServiceSessionPaymentRequest['paymentMethod'],
    amount: value.amount,
    currency: optionalString(value.currency),
    transactionId: optionalString(value.transactionId),
    referenceNumber: optionalString(value.referenceNumber),
    cardLastFourDigits: optionalString(value.cardLastFourDigits),
    cardType: optionalString(value.cardType),
    paymentNotes: optionalString(value.paymentNotes),
    status: value.status === 'Checking' ? 'Checking' : 'Unknown',
  };
}

function toStoredClose(value: StoredOperation, serviceSessionId: string): PendingTableClose | null {
  if (
    value.kind !== 'close' ||
    !sessionMatches(value, serviceSessionId) ||
    typeof value.expectedVersion !== 'number' ||
    !Number.isInteger(value.expectedVersion) ||
    value.expectedVersion < 1
  ) {
    return null;
  }
  return {
    kind: 'close',
    serviceSessionId,
    expectedVersion: value.expectedVersion,
    status: value.status === 'Checking' ? 'Checking' : 'Unknown',
  };
}

/** Read a persisted table operation without sending it again. */
export function readPendingTableOperation(serviceSessionId: string | null): PendingTableOperation | null {
  if (!serviceSessionId) return null;
  const value = readStored();
  if (!value) return null;
  return toStoredPayment(value, serviceSessionId) ?? toStoredClose(value, serviceSessionId);
}

/** Persist the exact payment payload before its POST. */
export function persistPendingTablePayment(
  serviceSessionId: string,
  payment: AddTableServiceSessionPaymentRequest,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ kind: 'payment', serviceSessionId, ...payment }));
  } catch (_error) {
    // The server operation id remains the source of truth if storage is unavailable.
  }
}

/** Persist the expected session version before a close POST. */
export function persistPendingTableClose(serviceSessionId: string, expectedVersion: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ kind: 'close', serviceSessionId, expectedVersion }));
  } catch (_error) {
    // Keep the close button usable; an unavailable store cannot change server semantics.
  }
}

/** Clear only the operation that reached a known outcome. */
export function clearPendingTableOperation(serviceSessionId: string, operationId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const value = readStored();
    if (!value || !sessionMatches(value, serviceSessionId)) return;
    if (operationId && value.operationId !== operationId) return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Storage is best effort; callers still retain the authoritative response in state.
  }
}
