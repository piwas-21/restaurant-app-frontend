import { collectAccountPayment, releaseAccountPayment, reserveAccountPayment } from '@/services/accountPaymentsService';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import type { AccountPaymentResult } from './accountPaymentResult';
import { canRetryAccountPaymentCollection } from './accountPaymentRecovery';

type RunPayment = (
  saved: PendingAccountPayment,
  action: () => Promise<AccountPaymentResult>,
  write: boolean,
  allowFeatureOffRecovery?: boolean,
) => Promise<void>;

export function accountPaymentMutationActions(
  pending: PendingAccountPayment | null,
  operation: AccountPaymentOperation | null,
  serviceSessionId: string,
  run: RunPayment,
  actorId: string | undefined,
  collectionEnabled: boolean,
  recoveryEnabled: boolean,
  busy: boolean,
  storageUnavailable: boolean,
) {
  const reserve = async () => {
    if (pending?.kind !== 'payment' || operation?.state !== 'Quoted') return;
    const request = { expectedVersion: operation.version, expectedAccountRevision: operation.expectedAccountRevision };
    await run(
      { ...pending, stage: 'reserving', expectedVersion: operation.version },
      () => reserveAccountPayment(serviceSessionId, operation.operationId, request),
      true,
    );
  };
  const collect = async () => {
    if (pending?.kind !== 'payment' || operation?.state !== 'Reserved' || pending.stage === 'releasing') return;
    const recoveringUnknownCollection = pending.stage === 'collecting';
    if (
      recoveringUnknownCollection &&
      !canRetryAccountPaymentCollection(
        actorId,
        serviceSessionId,
        pending,
        operation,
        recoveryEnabled,
        busy,
        storageUnavailable,
      )
    )
      return;
    if (!recoveringUnknownCollection && !collectionEnabled) return;
    const expectedVersion = pending.stage === 'collecting' ? pending.expectedVersion : operation.version;
    if (!expectedVersion) return;
    await run(
      { ...pending, stage: 'collecting', expectedVersion },
      () => collectAccountPayment(serviceSessionId, operation.operationId, { expectedVersion }),
      true,
      recoveringUnknownCollection && !collectionEnabled,
    );
  };
  const release = async () => {
    if (
      pending?.kind !== 'payment' ||
      !operation ||
      !['Quoted', 'Reserved'].includes(operation.state) ||
      pending.stage === 'collecting'
    )
      return;
    const expectedVersion = pending.stage === 'releasing' ? pending.expectedVersion : operation.version;
    if (!expectedVersion) return;
    await run(
      { ...pending, stage: 'releasing', expectedVersion },
      () => releaseAccountPayment(serviceSessionId, operation.operationId, { expectedVersion }),
      true,
      true,
    );
  };

  return { reserve, collect, release };
}
