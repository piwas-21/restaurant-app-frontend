import type { OrderAmendmentCommitRequest } from '@/types/orderAmendment';

const STORAGE_PREFIX = 'rumi.pending-order-amendment.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_MAX_LENGTH = 100;

export interface PendingAmendmentCommit {
  readonly actorId: string;
  readonly sourceOrderId: string;
  readonly request: OrderAmendmentCommitRequest;
  readonly expiresAt: string;
}

export type PendingAmendmentRead =
  | { readonly status: 'none' }
  | { readonly status: 'pending'; readonly value: PendingAmendmentCommit }
  | { readonly status: 'unavailable' };

interface StoredPendingAmendment {
  readonly actorId?: unknown;
  readonly sourceOrderId?: unknown;
  readonly amendmentId?: unknown;
  readonly clientOperationId?: unknown;
  readonly expectedOrderVersion?: unknown;
  readonly expectedAccountRevision?: unknown;
  readonly reviewAcknowledged?: unknown;
  readonly expiresAt?: unknown;
}

function storageKey(actorId: string, sourceOrderId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(actorId)}:${encodeURIComponent(sourceOrderId)}`;
}

function boundedIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= IDENTIFIER_MAX_LENGTH;
}

function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function toPending(value: unknown, actorId: string, sourceOrderId: string): PendingAmendmentCommit | null {
  if (typeof value !== 'object' || value === null) return null;
  const stored = value as StoredPendingAmendment;
  if (
    stored.actorId !== actorId ||
    stored.sourceOrderId !== sourceOrderId ||
    !boundedIdentifier(stored.amendmentId) ||
    !boundedIdentifier(stored.clientOperationId) ||
    !UUID.test(stored.clientOperationId) ||
    !validVersion(stored.expectedOrderVersion) ||
    (stored.expectedAccountRevision !== undefined && !validVersion(stored.expectedAccountRevision)) ||
    stored.reviewAcknowledged !== true ||
    typeof stored.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(stored.expiresAt))
  ) {
    return null;
  }

  return {
    actorId,
    sourceOrderId,
    request: {
      amendmentId: stored.amendmentId,
      clientOperationId: stored.clientOperationId,
      expectedOrderVersion: stored.expectedOrderVersion,
      ...(typeof stored.expectedAccountRevision === 'number'
        ? { expectedAccountRevision: stored.expectedAccountRevision }
        : {}),
      reviewAcknowledged: true,
    },
    expiresAt: stored.expiresAt,
  };
}

/** Read only the safe identifiers, versions, acknowledgement and expiry needed to reconcile a commit. */
export function readPendingAmendmentCommit(actorId: string, sourceOrderId: string): PendingAmendmentRead {
  if (typeof window === 'undefined' || !boundedIdentifier(actorId) || !boundedIdentifier(sourceOrderId)) {
    return { status: 'unavailable' };
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(actorId, sourceOrderId));
    if (!raw) return { status: 'none' };
    const pending = toPending(JSON.parse(raw) as unknown, actorId, sourceOrderId);
    return pending ? { status: 'pending', value: pending } : { status: 'unavailable' };
  } catch (_storageError) {
    // Typed failure reaches the recovery UI; do not log stored actor or operation data.
    return { status: 'unavailable' };
  }
}

/** Persist before the commit POST; a storage failure must prevent sending an unrecoverable write. */
export function persistPendingAmendmentCommit(value: PendingAmendmentCommit): boolean {
  if (
    typeof window === 'undefined' ||
    !boundedIdentifier(value.actorId) ||
    !boundedIdentifier(value.sourceOrderId) ||
    !toPending(
      {
        actorId: value.actorId,
        sourceOrderId: value.sourceOrderId,
        amendmentId: value.request.amendmentId,
        clientOperationId: value.request.clientOperationId,
        expectedOrderVersion: value.request.expectedOrderVersion,
        expectedAccountRevision: value.request.expectedAccountRevision,
        reviewAcknowledged: value.request.reviewAcknowledged,
        expiresAt: value.expiresAt,
      },
      value.actorId,
      value.sourceOrderId,
    )
  ) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      storageKey(value.actorId, value.sourceOrderId),
      JSON.stringify({
        actorId: value.actorId,
        sourceOrderId: value.sourceOrderId,
        amendmentId: value.request.amendmentId,
        clientOperationId: value.request.clientOperationId,
        expectedOrderVersion: value.request.expectedOrderVersion,
        expectedAccountRevision: value.request.expectedAccountRevision,
        reviewAcknowledged: value.request.reviewAcknowledged,
        expiresAt: value.expiresAt,
      }),
    );
    return true;
  } catch (_storageError) {
    // The caller retains the recovery lock and displays the localized storage failure.
    return false;
  }
}

/** Clear only the exact operation that reached a confirmed outcome or an expired unknown state. */
export function clearPendingAmendmentCommit(actorId: string, sourceOrderId: string, operationId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = storageKey(actorId, sourceOrderId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return true;
    const pending = toPending(JSON.parse(raw) as unknown, actorId, sourceOrderId);
    if (!pending || pending.request.clientOperationId !== operationId) return false;
    window.sessionStorage.removeItem(key);
    return true;
  } catch (_storageError) {
    // The caller retains the recovery lock and displays the localized storage failure.
    return false;
  }
}
