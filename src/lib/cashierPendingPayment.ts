import type { AddPaymentRequest } from '@/services/cashierService';

export type PendingPaymentStatus = 'Checking' | 'Unknown' | 'Unavailable' | 'Refused';

export interface PendingPaymentOperation extends AddPaymentRequest {
  readonly orderId: string;
  readonly status: PendingPaymentStatus;
}

const STORAGE_KEY = 'cashier.pending-payment';

interface StoredPendingPayment {
  readonly orderId?: unknown;
  readonly operationId?: unknown;
  readonly paymentMethod?: unknown;
  readonly amount?: unknown;
  readonly expectedVersion?: unknown;
  readonly transactionId?: unknown;
  readonly referenceNumber?: unknown;
  readonly cardLastFourDigits?: unknown;
  readonly cardType?: unknown;
  readonly paymentNotes?: unknown;
}

function readStored(): StoredPendingPayment | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredPendingPayment) : null;
  } catch (_error) {
    return null;
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toPendingPayment(value: StoredPendingPayment, orderId: string): PendingPaymentOperation | null {
  if (
    typeof value.orderId !== 'string' ||
    value.orderId.toLowerCase() !== orderId.toLowerCase() ||
    typeof value.operationId !== 'string' ||
    value.operationId.trim().length === 0 ||
    typeof value.paymentMethod !== 'string' ||
    value.paymentMethod.trim().length === 0 ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0
  ) {
    return null;
  }

  const expectedVersion =
    typeof value.expectedVersion === 'number' && Number.isInteger(value.expectedVersion)
      ? value.expectedVersion
      : undefined;
  return {
    orderId: value.orderId,
    operationId: value.operationId,
    paymentMethod: value.paymentMethod,
    amount: value.amount,
    expectedVersion,
    transactionId: asOptionalString(value.transactionId),
    referenceNumber: asOptionalString(value.referenceNumber),
    cardLastFourDigits: asOptionalString(value.cardLastFourDigits),
    cardType: asOptionalString(value.cardType),
    paymentNotes: asOptionalString(value.paymentNotes),
    status: 'Checking',
  };
}

/** Read one immutable tender payload for the selected order after a reload. */
export function readPendingPayment(orderId: string | null): PendingPaymentOperation | null {
  if (!orderId) return null;
  const stored = readStored();
  return stored ? toPendingPayment(stored, orderId) : null;
}

/** Persist the exact payload before the POST so a reload can reconcile, never replay, it. */
export function persistPendingPayment(orderId: string, payment: AddPaymentRequest): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ orderId, ...payment }));
  } catch (_error) {
    // A blocked storage area must not prevent the payment write. beforeunload still warns.
  }
}

/** Clear only the operation that was just resolved; a newer pending operation is preserved. */
export function clearPendingPayment(operationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = readStored();
    if (stored?.operationId === operationId) window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Storage is best effort; the server operation remains the source of truth.
  }
}
