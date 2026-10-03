import type { GuestAccountPaymentAttemptDescriptor } from '@/types/guestAccountPayments';
import { notifyGuestPaymentRecoveryChanged } from '@/lib/guestPaymentRecoverySignal';
import { hasGuestEqualSharePlanRecovery } from './guestEqualSharePlanStorage';
import {
  MAX_PAYMENT_ATTEMPTS,
  PAYMENT_STORE_VERSION,
  RECEIPT_CREDENTIAL_PATTERN,
  isGuestPaymentAttempt,
  isTerminalPaymentReceipt,
  isStoredPaymentAttemptList,
  pruneExpiredPaymentReceipts,
  type StoredPaymentAttemptList,
} from './guestAccountPaymentStorageRecords';
export {
  createGuestAccountPaymentDescriptor,
  withCheckoutAttempt,
  withQuotedOperation,
  withReceiptCredential,
  withReceiptExpiry,
  withReservation,
  withStartRequested,
} from './guestAccountPaymentDescriptor';

const STORAGE_KEY = 'rumi_table_guest_payment_attempts_v1';

export type GuestAccountPaymentStoreRead =
  | { readonly kind: 'empty'; readonly attempts: readonly [] }
  | { readonly kind: 'ready'; readonly attempts: readonly GuestAccountPaymentAttemptDescriptor[] }
  | { readonly kind: 'unavailable' };

export function createReceiptCredential(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') return null;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (value) => String.fromCodePoint(value)).join('');
  const encoded = btoa(binary);
  if (encoded.length !== 44 || !encoded.endsWith('=')) return null;
  const token = encoded.slice(0, -1).replaceAll('+', '-').replaceAll('/', '_');
  return token.length === 43 && RECEIPT_CREDENTIAL_PATTERN.test(token) ? token : null;
}

export function readGuestAccountPaymentAttempts(): GuestAccountPaymentStoreRead {
  if (typeof window === 'undefined') return { kind: 'empty', attempts: [] };
  let raw: string | null | undefined;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    // Blocked browser storage is expected in private mode; callers treat it as unresolved and fail closed.
  }
  if (raw === undefined) return { kind: 'unavailable' };
  if (raw === null) return { kind: 'empty', attempts: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // Malformed evidence is unavailable, never evidence that no checkout exists.
  }
  if (!isStoredPaymentAttemptList(parsed)) return { kind: 'unavailable' };
  return parsed.attempts.length === 0 ? { kind: 'empty', attempts: [] } : { kind: 'ready', attempts: parsed.attempts };
}

/** A read error or malformed record is unresolved, never evidence that no checkout exists. */
export function hasGuestAccountPaymentRecovery(): boolean {
  const stored = readGuestAccountPaymentAttempts();
  if (stored.kind === 'unavailable' || hasGuestEqualSharePlanRecovery()) return true;
  if (stored.kind === 'empty') return false;
  const now = Date.now();
  return stored.attempts.some((attempt) => {
    if (!attempt.receiptExpiresAt || !isTerminalPaymentReceipt(attempt.receiptTerminalState)) return true;
    const expiry = Date.parse(attempt.receiptExpiresAt);
    return !Number.isFinite(expiry) || expiry > now;
  });
}

export function saveGuestAccountPaymentAttempt(attempt: GuestAccountPaymentAttemptDescriptor): boolean {
  if (typeof window === 'undefined' || !isGuestPaymentAttempt(attempt)) return false;
  const current = readGuestAccountPaymentAttempts();
  if (current.kind === 'unavailable') return false;
  const attempts = pruneExpiredPaymentReceipts(current.attempts, Date.now()).filter(
    (value) => value.serviceSessionId !== attempt.serviceSessionId || value.operationId !== attempt.operationId,
  );
  if (attempts.length >= MAX_PAYMENT_ATTEMPTS) return false;
  attempts.push(attempt);
  const saved = writeStore(attempts);
  if (saved) notifyGuestPaymentRecoveryChanged();
  return saved;
}

export function removeGuestAccountPaymentAttempt(serviceSessionId: string, operationId: string): boolean {
  const current = readGuestAccountPaymentAttempts();
  if (current.kind === 'unavailable') return false;
  const saved = writeStore(
    current.attempts.filter(
      (value) => value.serviceSessionId !== serviceSessionId || value.operationId !== operationId,
    ),
  );
  if (saved) notifyGuestPaymentRecoveryChanged();
  return saved;
}

function writeStore(attempts: readonly GuestAccountPaymentAttemptDescriptor[]): boolean {
  if (typeof window === 'undefined') return false;
  let saved = false;
  try {
    const value: StoredPaymentAttemptList = { version: PAYMENT_STORE_VERSION, attempts };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    saved = true;
  } catch (_error) {
    // Quota/security failures are surfaced through the boolean result so the UI preserves recovery evidence.
  }
  return saved;
}
