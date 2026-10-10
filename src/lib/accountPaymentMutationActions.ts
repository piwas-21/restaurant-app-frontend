import { collectAccountPayment, releaseAccountPayment, reserveAccountPayment } from '@/services/accountPaymentsService';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import type { AccountPaymentResult } from './accountPaymentResult';
import { canRetryAccountPaymentCollection } from './accountPaymentRecovery';
import { createAccountCashCollectionIntent, accountCashCollectionMatchesIntent } from './accountCashCollectionIntent';
import { readAccountCashEvidence } from './accountCashEvidence';
import { hasConsistentFrozenAmount, matchesRequestedItemScope } from './accountPaymentRecoveryScope';

type PaymentDescriptor = Extract<PendingAccountPayment, { kind: 'payment' }>;

interface CollectionIntent {
  readonly saved: PaymentDescriptor;
  readonly collectedMinor: number | undefined;
  readonly recoveringUnknownCollection: boolean;
}

function scopeMatchesRequest(pending: PaymentDescriptor, operation: AccountPaymentOperation): boolean {
  return (
    hasConsistentFrozenAmount(operation) &&
    (pending.request.mode !== 'Items' || matchesRequestedItemScope(pending, operation))
  );
}

function matchesCollectionCurrency(
  pending: PaymentDescriptor,
  operation: AccountPaymentOperation,
  visitCurrency: string,
): boolean {
  return operation.currency === visitCurrency && (pending.currency === undefined || pending.currency === visitCurrency);
}

function prepareCashRecoveryIntent(
  pending: PaymentDescriptor,
  operation: AccountPaymentOperation,
  receivedMinor: number | undefined,
): CollectionIntent | null {
  const cashIntent = pending.cashIntent;
  if (!cashIntent || !accountCashCollectionMatchesIntent(cashIntent, operation)) return null;
  if (receivedMinor !== undefined && receivedMinor !== cashIntent.receivedMinor) return null;
  return { saved: pending, collectedMinor: cashIntent.receivedMinor, recoveringUnknownCollection: true };
}

function prepareNewCashIntent(
  pending: PaymentDescriptor,
  operation: AccountPaymentOperation,
  receivedMinor: number | undefined,
  visitCurrency: string,
): CollectionIntent | null {
  if (pending.cashIntent || receivedMinor === undefined) return null;
  const cashIntent = createAccountCashCollectionIntent(operation, receivedMinor);
  if (cashIntent?.settlement.currency !== visitCurrency) return null;
  return {
    saved: { ...pending, currency: operation.currency, cashIntent },
    collectedMinor: cashIntent.receivedMinor,
    recoveringUnknownCollection: false,
  };
}

function prepareCollectionIntent(
  pending: PaymentDescriptor,
  operation: AccountPaymentOperation,
  receivedMinor: number | undefined,
  visitCurrency: string | null,
): CollectionIntent | null {
  if (!visitCurrency || !matchesCollectionCurrency(pending, operation, visitCurrency)) return null;
  const recoveringUnknownCollection = pending.stage === 'collecting';
  if (pending.request.paymentMethod !== 'Cash') {
    if (receivedMinor !== undefined || pending.cashIntent !== undefined) return null;
    return { saved: pending, collectedMinor: undefined, recoveringUnknownCollection };
  }
  if (!scopeMatchesRequest(pending, operation)) return null;
  if (recoveringUnknownCollection) return prepareCashRecoveryIntent(pending, operation, receivedMinor);
  return prepareNewCashIntent(pending, operation, receivedMinor, visitCurrency);
}

type RunPayment = (
  saved: PendingAccountPayment,
  action: () => Promise<AccountPaymentResult>,
  write: boolean,
  allowFeatureOffRecovery?: boolean,
) => Promise<AccountPaymentResult | undefined>;

export function accountPaymentMutationActions(
  pending: PendingAccountPayment | null,
  operation: AccountPaymentOperation | null,
  serviceSessionId: string,
  visitCurrency: string | null,
  run: RunPayment,
  actorId: string | undefined,
  collectionEnabled: boolean,
  recoveryEnabled: boolean,
  busy: boolean,
  storageUnavailable: boolean,
) {
  const reserve = async () => {
    if (
      pending?.kind !== 'payment' ||
      pending.stage !== 'review' ||
      operation?.state !== 'Quoted' ||
      !scopeMatchesRequest(pending, operation) ||
      !visitCurrency ||
      operation.currency !== visitCurrency ||
      (pending.currency !== undefined && pending.currency !== visitCurrency) ||
      (operation.paymentMethod === 'Cash' && readAccountCashEvidence(operation).status !== 'valid')
    )
      return;
    const request = { expectedVersion: operation.version, expectedAccountRevision: operation.expectedAccountRevision };
    await run(
      { ...pending, stage: 'reserving', expectedVersion: operation.version },
      () => reserveAccountPayment(serviceSessionId, operation.operationId, request),
      true,
    );
  };
  const collect = async (receivedMinor?: number) => {
    if (pending?.kind !== 'payment' || operation?.state !== 'Reserved' || pending.stage === 'releasing') return;
    const intent = prepareCollectionIntent(pending, operation, receivedMinor, visitCurrency);
    if (!intent) return;
    const { saved, collectedMinor, recoveringUnknownCollection } = intent;
    if (
      recoveringUnknownCollection &&
      !canRetryAccountPaymentCollection(
        actorId,
        serviceSessionId,
        pending,
        operation,
        visitCurrency,
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
      { ...saved, stage: 'collecting', expectedVersion },
      () =>
        collectAccountPayment(serviceSessionId, operation.operationId, {
          expectedVersion,
          ...(collectedMinor === undefined ? {} : { receivedMinor: collectedMinor }),
        }),
      true,
      recoveringUnknownCollection && !collectionEnabled,
    );
  };
  const release = async (noMoneyConfirmed = false) => {
    const legacyCashCollection =
      pending?.kind === 'payment' &&
      pending.stage === 'collecting' &&
      pending.request.paymentMethod === 'Cash' &&
      pending.cashIntent === undefined;
    if (
      pending?.kind !== 'payment' ||
      !operation ||
      !['Quoted', 'Reserved'].includes(operation.state) ||
      (pending.stage === 'collecting' &&
        (!legacyCashCollection || !recoveryEnabled || operation.state !== 'Reserved' || !noMoneyConfirmed)) ||
      !visitCurrency ||
      operation.currency !== visitCurrency ||
      (pending.currency !== undefined && pending.currency !== visitCurrency)
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
