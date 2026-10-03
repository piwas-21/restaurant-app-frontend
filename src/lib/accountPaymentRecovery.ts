import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';

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
