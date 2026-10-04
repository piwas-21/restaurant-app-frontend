import type { AccountPaymentOperation } from '@/types/accountPayments';
import {
  isPositiveAccountPaymentInteger as positiveInteger,
  normalizeAccountPaymentUuid as canonicalIdentity,
  type PendingAccountPayment,
} from './pendingAccountPayment';
import { hasConsistentFrozenAmount, matchesRequestedItemScope } from './accountPaymentRecoveryScope';

export function canReleaseAccountPaymentRecovery(
  actorId: string | undefined,
  serviceSessionId: string,
  pending: PendingAccountPayment | null,
  operation: AccountPaymentOperation | null,
  recoveryEnabled: boolean,
  busy: boolean,
  storageUnavailable: boolean,
): boolean {
  if (
    !recoveryEnabled ||
    busy ||
    storageUnavailable ||
    !actorId ||
    pending?.kind !== 'payment' ||
    !operation ||
    pending.actorId.toLowerCase() !== actorId.toLowerCase() ||
    pending.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase() ||
    operation.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase() ||
    pending.request.operationId.toLowerCase() !== operation.operationId.toLowerCase()
  )
    return false;

  return operation.state === 'Quoted' || operation.state === 'Reserved';
}

function sameCanonicalIdentity(first: string | null | undefined, second: string | null | undefined): boolean {
  const canonicalFirst = canonicalIdentity(first);
  const canonicalSecond = canonicalIdentity(second);
  return canonicalFirst !== null && canonicalSecond !== null && canonicalFirst === canonicalSecond;
}

/** Allows only an exact retry of this actor's already-started physical collection. */
export function canRetryAccountPaymentCollection(
  actorId: string | undefined,
  serviceSessionId: string,
  pending: PendingAccountPayment | null,
  operation: AccountPaymentOperation | null,
  recoveryEnabled: boolean,
  busy: boolean,
  storageUnavailable: boolean,
): boolean {
  if (
    !recoveryEnabled ||
    busy ||
    storageUnavailable ||
    !actorId ||
    pending?.kind !== 'payment' ||
    pending.stage !== 'collecting' ||
    operation?.state !== 'Reserved' ||
    !positiveInteger(pending.expectedVersion ?? 0) ||
    pending.expectedVersion !== operation.version ||
    !sameCanonicalIdentity(pending.actorId, actorId) ||
    !sameCanonicalIdentity(pending.serviceSessionId, serviceSessionId) ||
    !sameCanonicalIdentity(operation.serviceSessionId, serviceSessionId) ||
    !sameCanonicalIdentity(pending.request.operationId, operation.operationId) ||
    !positiveInteger(pending.request.expectedAccountRevision) ||
    pending.request.expectedAccountRevision !== operation.expectedAccountRevision ||
    !positiveInteger(operation.version) ||
    !positiveInteger(operation.amountMinor) ||
    pending.request.paymentMethod !== operation.paymentMethod ||
    pending.request.mode !== operation.mode ||
    !hasConsistentFrozenAmount(operation)
  )
    return false;

  if (pending.request.mode === 'Amount') {
    return (
      pending.request.selectedUnits === undefined &&
      pending.request.amountMinor === operation.amountMinor &&
      pending.request.equalSharePlanId === undefined &&
      pending.request.equalShareOrdinal === undefined &&
      operation.equalSharePlanId === null &&
      operation.equalShareOrdinal === null
    );
  }
  if (pending.request.mode === 'Items') {
    return (
      operation.equalSharePlanId === null &&
      operation.equalShareOrdinal === null &&
      matchesRequestedItemScope(pending, operation)
    );
  }
  return (
    pending.request.selectedUnits === undefined &&
    pending.request.amountMinor === undefined &&
    positiveInteger(pending.request.equalShareOrdinal ?? 0) &&
    sameCanonicalIdentity(pending.request.equalSharePlanId, operation.equalSharePlanId) &&
    pending.request.equalShareOrdinal === operation.equalShareOrdinal
  );
}
