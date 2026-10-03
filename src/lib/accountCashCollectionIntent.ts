import { z } from 'zod';
import type { AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import { accountCashSettlementSchema, canCollectReviewedCash, readAccountCashEvidence } from './accountCashEvidence';

const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonemptyId = z
  .string()
  .uuid()
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');
const identity = { operationId: nonemptyId, serviceSessionId: nonemptyId };
const operationIdentity = z.object({ ...identity, version: positiveInteger });
export const accountCashCollectionIntentSchema = z
  .object({
    ...identity,
    expectedVersion: positiveInteger,
    receivedMinor: positiveInteger,
    settlement: accountCashSettlementSchema,
  })
  .strict();
export type AccountCashCollectionIntent = z.infer<typeof accountCashCollectionIntentSchema>;

function sameTerms(left: AccountCashSettlement, right: AccountCashSettlement): boolean {
  return (
    left.policyVersion === right.policyVersion &&
    left.currency === right.currency &&
    left.paymentMethod === right.paymentMethod &&
    left.exactAmountMinor === right.exactAmountMinor &&
    left.adjustmentMinor === right.adjustmentMinor &&
    left.dueAmountMinor === right.dueAmountMinor
  );
}

/** Persist this reviewed physical tender before POST; recovery cannot replace it with lookup terms. */
export function createAccountCashCollectionIntent(
  operation: AccountPaymentOperation,
  receivedMinor: number,
): AccountCashCollectionIntent | null {
  if (!canCollectReviewedCash(operation, receivedMinor)) return null;
  const evidence = readAccountCashEvidence(operation);
  if (evidence.status !== 'valid') return null;
  const parsed = accountCashCollectionIntentSchema.safeParse({
    operationId: operation.operationId,
    serviceSessionId: operation.serviceSessionId,
    expectedVersion: operation.version,
    receivedMinor,
    settlement: evidence.settlement,
  });
  return parsed.success ? parsed.data : null;
}

/** Money-only binding; the caller still checks actor authority, reviewed scope and visit currency. */
export function accountCashCollectionMatchesIntent(intent: unknown, operation: AccountPaymentOperation): boolean {
  const saved = accountCashCollectionIntentSchema.safeParse(intent);
  const evidence = readAccountCashEvidence(operation);
  if (!saved.success || evidence.status !== 'valid' || !operationIdentity.safeParse(operation).success) return false;
  if (
    saved.data.operationId.toLowerCase() !== operation.operationId.toLowerCase() ||
    saved.data.serviceSessionId.toLowerCase() !== operation.serviceSessionId.toLowerCase() ||
    !sameTerms(saved.data.settlement, evidence.settlement)
  )
    return false;
  if (operation.state === 'Reserved')
    return (
      operation.version === saved.data.expectedVersion && canCollectReviewedCash(operation, saved.data.receivedMinor)
    );
  return (
    operation.state === 'Captured' &&
    BigInt(operation.version) === BigInt(saved.data.expectedVersion) + BigInt(1) &&
    evidence.receipt?.receivedMinor === saved.data.receivedMinor
  );
}
