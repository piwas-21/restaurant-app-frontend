import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import type { GuestEqualSharePlanIntent } from '@/types/guestEqualSharePlan';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import { notifyGuestPaymentRecoveryChanged } from '@/lib/guestPaymentRecoverySignal';

const STORAGE_KEY = 'rumi_table_guest_payment_plans_v1';
const MAX_INTENTS = 16;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/;

export type GuestEqualSharePlanIntentRead =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly intents: readonly GuestEqualSharePlanIntent[] }
  | { readonly kind: 'unavailable' };

interface StoredIntentList {
  readonly version: 1;
  readonly intents: readonly GuestEqualSharePlanIntent[];
}

export async function createGuestEqualSharePlanIntent(
  identity: TableGuestVisitIdentity,
  operationId: string,
  expectedAccountRevision: number,
  shareCount: number,
  supersedesPlanId: string | null,
): Promise<GuestEqualSharePlanIntent | null> {
  const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
  if (!participantFingerprint) return null;
  const intent: GuestEqualSharePlanIntent = {
    serviceSessionId: identity.serviceSessionId,
    participantFingerprint,
    operationId,
    expectedAccountRevision,
    shareCount,
    supersedesPlanId,
    createdAt: Date.now(),
  };
  return isIntent(intent) ? intent : null;
}

export function readGuestEqualSharePlanIntents(): GuestEqualSharePlanIntentRead {
  if (typeof window === 'undefined') return { kind: 'empty' };
  let raw: string | null | undefined;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch (_error) {
    // A storage read failure remains unavailable, never proof that no plan operation exists.
  }
  if (raw === undefined) return { kind: 'unavailable' };
  if (raw === null) return { kind: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // Malformed intent evidence remains unavailable instead of authorizing a new operation.
  }
  if (!isIntentList(parsed)) return { kind: 'unavailable' };
  return parsed.intents.length === 0 ? { kind: 'empty' } : { kind: 'ready', intents: parsed.intents };
}

export async function findGuestEqualSharePlanIntent(
  identity: TableGuestVisitIdentity,
): Promise<
  | { readonly kind: 'none' }
  | { readonly kind: 'intent'; readonly intent: GuestEqualSharePlanIntent }
  | { readonly kind: 'unavailable' }
> {
  const stored = readGuestEqualSharePlanIntents();
  if (stored.kind === 'unavailable') return { kind: 'unavailable' };
  if (stored.kind === 'empty') return { kind: 'none' };
  const fingerprint = await fingerprintGuestParticipant(identity.participantToken);
  if (!fingerprint) return { kind: 'unavailable' };
  const intent = stored.intents.reduce<GuestEqualSharePlanIntent | null>((latest, value) => {
    if (value.serviceSessionId !== identity.serviceSessionId || value.participantFingerprint !== fingerprint) {
      return latest;
    }
    return latest === null || value.createdAt > latest.createdAt ? value : latest;
  }, null);
  return intent ? { kind: 'intent', intent } : { kind: 'none' };
}

export function saveGuestEqualSharePlanIntent(intent: GuestEqualSharePlanIntent): boolean {
  if (typeof window === 'undefined' || !isIntent(intent)) return false;
  const stored = readGuestEqualSharePlanIntents();
  if (stored.kind === 'unavailable') return false;
  const current = stored.kind === 'ready' ? [...stored.intents] : [];
  const existing = current.find(
    (value) => value.serviceSessionId === intent.serviceSessionId && value.operationId === intent.operationId,
  );
  if (existing) return sameIntent(existing, intent);
  if (current.length >= MAX_INTENTS) return false;
  current.push(intent);
  const saved = writeIntents(current);
  if (saved) notifyGuestPaymentRecoveryChanged();
  return saved;
}

export function removeGuestEqualSharePlanIntent(intent: GuestEqualSharePlanIntent): boolean {
  if (typeof window === 'undefined') return false;
  const stored = readGuestEqualSharePlanIntents();
  if (stored.kind === 'unavailable') return false;
  if (stored.kind === 'empty') return true;
  const saved = writeIntents(
    stored.intents.filter(
      (value) => value.serviceSessionId !== intent.serviceSessionId || value.operationId !== intent.operationId,
    ),
  );
  if (saved) notifyGuestPaymentRecoveryChanged();
  return saved;
}

export function hasGuestEqualSharePlanRecovery(): boolean {
  const stored = readGuestEqualSharePlanIntents();
  return stored.kind !== 'empty';
}

function writeIntents(intents: readonly GuestEqualSharePlanIntent[]): boolean {
  let saved = false;
  try {
    const stored: StoredIntentList = { version: 1, intents };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    saved = true;
  } catch (_error) {
    // A storage write failure is returned to the caller before any plan POST can proceed.
  }
  return saved;
}

function isIntentList(value: unknown): value is StoredIntentList {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.intents) || value.intents.length > MAX_INTENTS)
    return false;
  return value.intents.every(isIntent);
}

function isIntent(value: unknown): value is GuestEqualSharePlanIntent {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      'serviceSessionId',
      'participantFingerprint',
      'operationId',
      'expectedAccountRevision',
      'shareCount',
      'supersedesPlanId',
      'createdAt',
    ]) &&
    typeof value.serviceSessionId === 'string' &&
    GUID.test(value.serviceSessionId) &&
    typeof value.participantFingerprint === 'string' &&
    FINGERPRINT.test(value.participantFingerprint) &&
    typeof value.operationId === 'string' &&
    GUID.test(value.operationId) &&
    positiveInteger(value.expectedAccountRevision) &&
    positiveInteger(value.shareCount) &&
    value.shareCount <= 1000 &&
    (value.supersedesPlanId === null ||
      (typeof value.supersedesPlanId === 'string' && GUID.test(value.supersedesPlanId))) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    value.createdAt > 0
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

function sameIntent(first: GuestEqualSharePlanIntent, second: GuestEqualSharePlanIntent): boolean {
  return (
    first.participantFingerprint === second.participantFingerprint &&
    first.expectedAccountRevision === second.expectedAccountRevision &&
    first.shareCount === second.shareCount &&
    first.supersedesPlanId === second.supersedesPlanId
  );
}
