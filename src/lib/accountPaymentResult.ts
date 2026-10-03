import type { AccountEqualSharePlan, AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';

export type AccountPaymentResult = AccountPaymentOperation | AccountEqualSharePlan;
type Transition =
  | { terminal: true; operation: AccountPaymentOperation | null }
  | { terminal: false; operation: AccountPaymentOperation; pending: PendingAccountPayment };

export function accountPaymentResultTransition(
  saved: PendingAccountPayment,
  result: AccountPaymentResult,
  serviceSessionId: string,
  mismatchMessage: string,
): Transition {
  if (
    result.operationId.toLowerCase() !== saved.request.operationId.toLowerCase() ||
    result.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase()
  )
    throw new Error(mismatchMessage);
  if ('planId' in result) {
    if (
      saved.kind !== 'plan' ||
      result.shareCount !== saved.request.shareCount ||
      result.accountRevision !== saved.request.expectedAccountRevision ||
      !Number.isSafeInteger(result.totalMinor) ||
      result.totalMinor < result.shareCount
    )
      throw new Error(mismatchMessage);
    return { terminal: true, operation: null };
  }
  if (
    saved.kind !== 'payment' ||
    result.mode !== saved.request.mode ||
    result.paymentMethod !== saved.request.paymentMethod ||
    result.expectedAccountRevision !== saved.request.expectedAccountRevision ||
    (saved.request.mode === 'Equal' &&
      (result.equalSharePlanId !== saved.request.equalSharePlanId ||
        result.equalShareOrdinal !== saved.request.equalShareOrdinal)) ||
    !Number.isSafeInteger(result.version) ||
    result.version < 1 ||
    !Number.isSafeInteger(result.amountMinor) ||
    result.amountMinor <= 0 ||
    (saved.request.mode === 'Amount' && result.amountMinor !== saved.request.amountMinor)
  )
    throw new Error(mismatchMessage);
  if (['Captured', 'Released', 'Failed'].includes(result.state)) return { terminal: true, operation: result };
  // A lookup cannot erase the intent of a collection or release whose response was lost.
  let stage: 'review' | 'reserved' | 'collecting' | 'releasing' = result.state === 'Quoted' ? 'review' : 'reserved';
  if (saved.stage === 'collecting' || saved.stage === 'releasing') stage = saved.stage;
  const expectedVersion = stage === 'collecting' || stage === 'releasing' ? saved.expectedVersion : result.version;
  return { terminal: false, operation: result, pending: { ...saved, stage, expectedVersion } };
}
