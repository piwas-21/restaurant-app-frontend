import type { PendingTableGuestRound, TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';

const VISIT_KEY = 'rumi_table_guest_visit_v1';
const BLOCKED_KEY = 'rumi_table_guest_visit_blocked_v1';
const ROUND_KEY = 'rumi_table_guest_round_attempt_v1';
const PROBE_KEY = 'rumi_table_guest_storage_probe_v1';

export type StoredTableGuestState =
  | { readonly kind: 'none' }
  | { readonly kind: 'visit'; readonly identity: TableGuestVisitIdentity }
  | { readonly kind: 'blocked'; readonly reason: 'ended' | 'unavailable' }
  | { readonly kind: 'corrupt' }
  | { readonly kind: 'storageUnavailable' };

export type PendingTableGuestRoundRead =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending'; readonly round: PendingTableGuestRound }
  | { readonly kind: 'unavailable' };

/** Check for recoverable visit state without parsing it or mutating expired/corrupt entries. */
export function hasStoredTableGuestState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      sessionStorage.getItem(VISIT_KEY) !== null ||
      sessionStorage.getItem(BLOCKED_KEY) !== null ||
      sessionStorage.getItem(ROUND_KEY) !== null
    );
  } catch (storageError) {
    reportTableGuestFailure('read visit state presence', storageError);
    return true;
  }
}

export function readStoredTableGuestState(now = Date.now()): StoredTableGuestState {
  if (typeof window === 'undefined') return { kind: 'none' };
  let blockedReason: string | null;
  let raw: string | null;
  try {
    blockedReason = sessionStorage.getItem(BLOCKED_KEY);
    raw = sessionStorage.getItem(VISIT_KEY);
  } catch (storageError) {
    reportTableGuestFailure('read visit state', storageError);
    return { kind: 'storageUnavailable' };
  }

  if (raw === null) {
    return blockedReason === 'ended' || blockedReason === 'unavailable'
      ? { kind: 'blocked', reason: blockedReason }
      : { kind: 'none' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    reportTableGuestFailure('parse visit state', parseError);
    return { kind: 'corrupt' };
  }
  if (!isVisitIdentity(parsed)) return { kind: 'corrupt' };
  const expiry = new Date(parsed.expiresAt).getTime();
  if (!Number.isFinite(expiry)) return { kind: 'corrupt' };
  if (expiry <= now) {
    blockStoredVisit('ended');
    return { kind: 'blocked', reason: 'ended' };
  }
  return { kind: 'visit', identity: parsed };
}

export function writeTableGuestVisit(identity: TableGuestVisitIdentity): boolean {
  if (typeof window === 'undefined' || !isVisitIdentity(identity)) return false;
  try {
    sessionStorage.setItem(PROBE_KEY, '1');
    sessionStorage.removeItem(PROBE_KEY);
    if (sessionStorage.getItem(ROUND_KEY) !== null) return false;
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(identity));
    sessionStorage.removeItem(BLOCKED_KEY);
    return true;
  } catch (writeError) {
    reportTableGuestFailure('replace visit state', writeError);
    try {
      sessionStorage.removeItem(VISIT_KEY);
    } catch (cleanupError) {
      reportTableGuestFailure('remove visit after failed write', cleanupError);
      // Storage is unavailable; the caller keeps the guest out of the visit flow.
    }
    return false;
  }
}

export function blockStoredVisit(reason: 'ended' | 'unavailable'): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(VISIT_KEY);
    sessionStorage.setItem(BLOCKED_KEY, reason);
  } catch (storageError) {
    reportTableGuestFailure('store blocked visit state', storageError);
    // Best effort only. The in-memory provider still blocks DineIn until this tab closes.
  }
}

export function leaveStoredVisitIfNoPendingRound(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(ROUND_KEY) !== null) return false;
    sessionStorage.removeItem(VISIT_KEY);
    sessionStorage.removeItem(BLOCKED_KEY);
    return true;
  } catch (storageError) {
    reportTableGuestFailure('leave visit', storageError);
    // Keep all visit evidence when storage cannot prove there is no unresolved round.
    return false;
  }
}

/** Keep malformed or inaccessible operation state unresolved instead of treating it as absent. */
export function readPendingTableGuestRoundForRecovery(): PendingTableGuestRoundRead {
  if (typeof window === 'undefined') return { kind: 'unavailable' };
  try {
    const raw = sessionStorage.getItem(ROUND_KEY);
    if (raw === null) return { kind: 'none' };
    const parsed: unknown = JSON.parse(raw);
    return isPendingRound(parsed) ? { kind: 'pending', round: parsed } : { kind: 'unavailable' };
  } catch (parseError) {
    reportTableGuestFailure('read pending round', parseError);
    return { kind: 'unavailable' };
  }
}

export function writePendingTableGuestRound(attempt: PendingTableGuestRound): boolean {
  if (typeof window === 'undefined' || !isPendingRound(attempt)) return false;
  try {
    sessionStorage.setItem(ROUND_KEY, JSON.stringify(attempt));
    return true;
  } catch (writeError) {
    reportTableGuestFailure('save pending round', writeError);
    return false;
  }
}

export function clearPendingTableGuestRound(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ROUND_KEY);
  } catch (storageError) {
    reportTableGuestFailure('remove pending round', storageError);
    // A later read will fail closed if the previous attempt cannot be resolved.
  }
}

function isVisitIdentity(value: unknown): value is TableGuestVisitIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const identity = value as Partial<TableGuestVisitIdentity>;
  return (
    typeof identity.serviceSessionId === 'string' &&
    identity.serviceSessionId.length > 0 &&
    typeof identity.participantToken === 'string' &&
    identity.participantToken.length >= 32 &&
    typeof identity.expiresAt === 'string'
  );
}

function isPendingRound(value: unknown): value is PendingTableGuestRound {
  if (typeof value !== 'object' || value === null) return false;
  const attempt = value as Partial<PendingTableGuestRound>;
  return (
    typeof attempt.serviceSessionId === 'string' &&
    typeof attempt.operationId === 'string' &&
    typeof attempt.expectedAccountRevision === 'number' &&
    Number.isSafeInteger(attempt.expectedAccountRevision) &&
    attempt.expectedAccountRevision > 0 &&
    typeof attempt.expectedBasketFingerprint === 'string' &&
    /^[A-F0-9]{64}$/i.test(attempt.expectedBasketFingerprint)
  );
}
