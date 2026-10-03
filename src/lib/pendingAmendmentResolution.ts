import { pendingResolutionSchema } from '@/schemas/amendmentResolution.schema';
import {
  compareResolutionIdentities,
  validatePendingResolution,
  validateResolutionResult,
} from '@/lib/amendmentResolutionValidation';
import { pendingTillConfirmationsSucceeded } from '@/lib/amendmentResolutionTillValidation';
import type {
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';

export type PendingResolutionRead =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'pending'; readonly value: PendingAmendmentResolution };

export type PendingResolutionsForOrderRead =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'pending'; readonly values: readonly PendingAmendmentResolution[] };

function key(actorId: string, orderId: string, amendmentId: string): string {
  return `sofra.amendment-resolution.${actorId.toLowerCase()}.${orderId.toLowerCase()}.${amendmentId.toLowerCase()}`;
}

function same(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function compareAmendments(first: PendingAmendmentResolution, second: PendingAmendmentResolution): number {
  return compareResolutionIdentities(first.amendmentId, second.amendmentId);
}

/** Lists only this signed-in actor's matching order journals; any ambiguous record fails closed. */
export function readPendingAmendmentResolutionsForOrder(
  actorId: string,
  orderId: string,
): PendingResolutionsForOrderRead {
  if (
    typeof window === 'undefined' ||
    !pendingResolutionSchema.shape.actorId.safeParse(actorId).success ||
    !pendingResolutionSchema.shape.orderId.safeParse(orderId).success
  )
    return { status: 'unavailable' };

  try {
    const storage = window.sessionStorage;
    const prefix = `sofra.amendment-resolution.${actorId.toLowerCase()}.${orderId.toLowerCase()}.`;
    const values: PendingAmendmentResolution[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const storageKey = storage.key(index);
      if (storageKey === null) return { status: 'unavailable' };
      if (!storageKey.startsWith(prefix)) continue;
      const amendmentId = storageKey.slice(prefix.length);
      if (!pendingResolutionSchema.shape.amendmentId.safeParse(amendmentId).success) {
        return { status: 'unavailable' };
      }
      const raw = storage.getItem(storageKey);
      if (raw === null) return { status: 'unavailable' };
      const parsed = pendingResolutionSchema.safeParse(JSON.parse(raw) as unknown);
      if (
        !parsed.success ||
        !same(parsed.data.actorId, actorId) ||
        !same(parsed.data.orderId, orderId) ||
        !same(parsed.data.amendmentId, amendmentId) ||
        storageKey !== key(actorId, orderId, parsed.data.amendmentId)
      )
        return { status: 'unavailable' };
      values.push(validatePendingResolution(parsed.data));
    }
    if (values.length === 0) return { status: 'none' };
    values.sort(compareAmendments);
    return { status: 'pending', values };
  } catch (_storageError: unknown) {
    // An incomplete inventory cannot prove that this order has no unresolved resolution.
  }
  return { status: 'unavailable' };
}

export function readPendingAmendmentResolution(
  actorId: string,
  orderId: string,
  amendmentId: string,
): PendingResolutionRead {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.sessionStorage.getItem(key(actorId, orderId, amendmentId));
    if (raw === null) return { status: 'none' };
    const parsed = pendingResolutionSchema.safeParse(JSON.parse(raw) as unknown);
    if (
      !parsed.success ||
      !same(parsed.data.actorId, actorId) ||
      !same(parsed.data.orderId, orderId) ||
      !same(parsed.data.amendmentId, amendmentId)
    )
      return { status: 'unavailable' };
    return { status: 'pending', value: validatePendingResolution(parsed.data) };
  } catch (_storageError: unknown) {
    // Invalid or inaccessible storage holds recovery; never discard an unresolved refund request.
  }
  return { status: 'unavailable' };
}

/** Persist the reviewed request before any provider-capable Start; only bind its returned identity later. */
export function persistPendingAmendmentResolution(value: PendingAmendmentResolution): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = validatePendingResolution(pendingResolutionSchema.parse(value));
    const saved = readPendingAmendmentResolution(value.actorId, value.orderId, value.amendmentId);
    if (saved.status === 'unavailable') return false;
    if (saved.status === 'pending') {
      const original = saved.value;
      if (original.operationId !== null && original.operationId !== parsed.operationId) return false;
      if (JSON.stringify({ ...original, operationId: null }) !== JSON.stringify({ ...parsed, operationId: null }))
        return false;
    }
    window.sessionStorage.setItem(key(value.actorId, value.orderId, value.amendmentId), JSON.stringify(parsed));
    return true;
  } catch (_storageError: unknown) {
    // The caller blocks money movement when the original request cannot be durably preserved.
  }
  return false;
}

function sameResolutionExceptTillConfirmations(
  first: PendingAmendmentResolution,
  second: PendingAmendmentResolution,
): boolean {
  const firstBase = { ...first };
  const secondBase = { ...second };
  delete firstBase.pendingTillConfirmations;
  delete secondBase.pendingTillConfirmations;
  return JSON.stringify(firstBase) === JSON.stringify(secondBase);
}

/** Save the exact complete till batch before any physical-refund confirmation POST. */
export function persistPendingTillConfirmations(
  value: PendingAmendmentResolution,
  confirmations: AmendmentResolutionTillConfirmations,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = validatePendingResolution(
      pendingResolutionSchema.parse({ ...value, pendingTillConfirmations: confirmations }),
    );
    if (parsed.operationId === null || !parsed.pendingTillConfirmations) return false;
    const saved = readPendingAmendmentResolution(value.actorId, value.orderId, value.amendmentId);
    if (saved.status !== 'pending' || !sameResolutionExceptTillConfirmations(saved.value, parsed)) return false;
    if (saved.value.pendingTillConfirmations) {
      return JSON.stringify(saved.value.pendingTillConfirmations) === JSON.stringify(parsed.pendingTillConfirmations);
    }
    window.sessionStorage.setItem(key(value.actorId, value.orderId, value.amendmentId), JSON.stringify(parsed));
    return true;
  } catch (_storageError: unknown) {
    // Without the frozen physical-refund instruction, the UI cannot safely retry an uncertain POST.
  }
  return false;
}

/** Remove only the exact phase-two descriptor after server readback proves each saved reference. */
export function clearPendingTillConfirmations(
  value: PendingAmendmentResolution,
  result: AmendmentResolutionResult,
): boolean {
  if (typeof window === 'undefined' || !value.pendingTillConfirmations) return false;
  try {
    const normalized = validatePendingResolution(pendingResolutionSchema.parse(value));
    const verified = validateResolutionResult(result, normalized);
    if (!pendingTillConfirmationsSucceeded(normalized, verified)) return false;
    const saved = readPendingAmendmentResolution(value.actorId, value.orderId, value.amendmentId);
    if (saved.status !== 'pending' || JSON.stringify(saved.value) !== JSON.stringify(normalized)) return false;
    const cleared = { ...normalized };
    delete cleared.pendingTillConfirmations;
    window.sessionStorage.setItem(key(value.actorId, value.orderId, value.amendmentId), JSON.stringify(cleared));
    return true;
  } catch (_storageError: unknown) {
    // Keep the original physical-refund evidence until a complete readback and storage write succeed.
  }
  return false;
}

export function clearPendingAmendmentResolution(value: PendingAmendmentResolution): boolean {
  try {
    const normalized = validatePendingResolution(pendingResolutionSchema.parse(value));
    const saved = readPendingAmendmentResolution(value.actorId, value.orderId, value.amendmentId);
    if (saved.status === 'none') return true;
    if (saved.status !== 'pending' || JSON.stringify(saved.value) !== JSON.stringify(normalized)) return false;
    window.sessionStorage.removeItem(key(value.actorId, value.orderId, value.amendmentId));
    return true;
  } catch (_storageError: unknown) {
    // An unconfirmed removal keeps the recovery lock visible and forbids a replacement request.
  }
  return false;
}
