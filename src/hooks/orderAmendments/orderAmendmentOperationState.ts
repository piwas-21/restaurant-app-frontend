import type { OrderAmendmentOperationLookup } from '@/types/orderAmendment';
import { getErrorMessage } from '@/utils/apiClient';

export function amendmentOperationCommitted(lookup: OrderAmendmentOperationLookup): boolean {
  return lookup.status === 'Committed' || lookup.status === 1;
}

export function amendmentOperationUnknown(lookup: OrderAmendmentOperationLookup): boolean {
  return lookup.status === 'Unknown' || lookup.status === 0;
}

export function sameAmendmentId(left: string | null | undefined, right: string): boolean {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

export function amendmentExpiryPassed(expiresAt: string, now: number | string = Date.now()): boolean {
  const expiry = Date.parse(expiresAt);
  const nowMilliseconds = typeof now === 'number' ? now : Date.parse(now);
  return !Number.isFinite(expiry) || !Number.isFinite(nowMilliseconds) || expiry <= nowMilliseconds;
}

export function canRequoteUnknownAmendment(
  lookup: OrderAmendmentOperationLookup | null,
  expiresAt: string | undefined,
  now: number | string = Date.now(),
): boolean {
  return Boolean(lookup && expiresAt && amendmentOperationUnknown(lookup) && amendmentExpiryPassed(expiresAt, now));
}

export function newAmendmentOperationId(): string {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error('orderAmendments.operation_id_unavailable');
  return id;
}

export function amendmentErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message.startsWith('orderAmendments.')) return reason.message;
  return getErrorMessage(reason) ?? fallback;
}
