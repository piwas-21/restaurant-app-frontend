import type { AccountEqualSharePlan, AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import { accountCashCollectionMatchesIntent } from './accountCashCollectionIntent';
import { hasConsistentFrozenAmount, matchesRequestedItemScope } from './accountPaymentRecoveryScope';

export type AccountPaymentResult = AccountPaymentOperation | AccountEqualSharePlan;
type Transition =
  | { terminal: true; operation: AccountPaymentOperation | null }
  | { terminal: false; operation: AccountPaymentOperation; pending: PendingAccountPayment };
type PaymentDescriptor = Extract<PendingAccountPayment, { kind: 'payment' }>;

function paymentResultMatchesBinding(
  saved: PendingAccountPayment,
  result: AccountPaymentOperation,
  visitCurrency: string | null,
): boolean {
  if (saved.kind !== 'payment' || !visitCurrency || result.currency !== visitCurrency) return false;
  if (saved.currency !== undefined && result.currency !== saved.currency) return false;
  return true;
}

function paymentResultMatchesRequest(saved: PendingAccountPayment, result: AccountPaymentOperation): boolean {
  if (saved.kind !== 'payment') return false;
  if (
    result.mode !== saved.request.mode ||
    result.paymentMethod !== saved.request.paymentMethod ||
    result.expectedAccountRevision !== saved.request.expectedAccountRevision ||
    (result.tipMinor ?? 0) !== (saved.request.tipMinor ?? 0)
  )
    return false;
  if (saved.request.mode === 'Equal') {
    return (
      result.equalSharePlanId === saved.request.equalSharePlanId &&
      result.equalShareOrdinal === saved.request.equalShareOrdinal
    );
  }
  if (saved.request.mode === 'CustomAmount') {
    return (
      result.customSharePlanId === saved.request.customSharePlanId &&
      result.customShareOrdinal === saved.request.customShareOrdinal
    );
  }
  if (saved.request.mode === 'Amount') return result.amountMinor === saved.request.amountMinor;
  return saved.request.mode !== 'Items' || matchesRequestedItemScope(saved, result);
}

function hasSafePaymentResultAmounts(result: AccountPaymentOperation): boolean {
  return (
    Number.isSafeInteger(result.version) &&
    result.version >= 1 &&
    Number.isSafeInteger(result.amountMinor) &&
    result.amountMinor > 0
  );
}

function matchesOriginalCashScope(saved: PaymentDescriptor, result: AccountPaymentOperation): boolean {
  return (
    hasConsistentFrozenAmount(result) && (saved.request.mode !== 'Items' || matchesRequestedItemScope(saved, result))
  );
}

function matchesCashCaptureIntent(saved: PaymentDescriptor, result: AccountPaymentOperation): boolean {
  if (result.state !== 'Captured' || result.paymentMethod !== 'Cash') return true;
  return saved.cashIntent !== undefined && accountCashCollectionMatchesIntent(saved.cashIntent, result);
}

function matchesPlanResult(
  saved: PendingAccountPayment,
  result: AccountEqualSharePlan,
  visitCurrency: string | null,
): boolean {
  const expectedCustomAmounts = saved.kind === 'plan' ? saved.request.customAmountsMinor : undefined;
  const actualCustomAmounts = result.customAmountsMinor ?? undefined;
  const sameCustomAmounts =
    expectedCustomAmounts === undefined
      ? actualCustomAmounts === undefined || actualCustomAmounts.length === 0
      : actualCustomAmounts?.length === expectedCustomAmounts.length &&
        actualCustomAmounts.every((amount, index) => amount === expectedCustomAmounts[index]);
  return (
    saved.kind === 'plan' &&
    visitCurrency !== null &&
    result.currency === visitCurrency &&
    result.shareCount === saved.request.shareCount &&
    sameCustomAmounts &&
    result.accountRevision === saved.request.expectedAccountRevision &&
    Number.isSafeInteger(result.totalMinor) &&
    result.totalMinor >= result.shareCount
  );
}

export function accountPaymentResultTransition(
  saved: PendingAccountPayment,
  result: AccountPaymentResult,
  serviceSessionId: string,
  mismatchMessage: string,
  visitCurrency: string | null,
): Transition {
  if (
    result.operationId.toLowerCase() !== saved.request.operationId.toLowerCase() ||
    result.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase()
  )
    throw new Error(mismatchMessage);
  if ('planId' in result) {
    if (!matchesPlanResult(saved, result, visitCurrency)) throw new Error(mismatchMessage);
    return { terminal: true, operation: null };
  }
  if (
    !paymentResultMatchesBinding(saved, result, visitCurrency) ||
    !paymentResultMatchesRequest(saved, result) ||
    !hasSafePaymentResultAmounts(result)
  )
    throw new Error(mismatchMessage);
  if (saved.kind !== 'payment') throw new Error(mismatchMessage);
  if (result.paymentMethod === 'Cash' && !matchesOriginalCashScope(saved, result)) throw new Error(mismatchMessage);
  if (!matchesCashCaptureIntent(saved, result)) {
    return {
      terminal: false,
      operation: result,
      pending: saved,
    };
  }
  if (['Captured', 'Released', 'Failed'].includes(result.state)) return { terminal: true, operation: result };
  // A lookup cannot erase the intent of a collection or release whose response was lost.
  let stage: 'review' | 'reserved' | 'collecting' | 'releasing' = result.state === 'Quoted' ? 'review' : 'reserved';
  if (saved.stage === 'collecting' || saved.stage === 'releasing') stage = saved.stage;
  const expectedVersion = stage === 'collecting' || stage === 'releasing' ? saved.expectedVersion : result.version;
  return {
    terminal: false,
    operation: result,
    pending: { ...saved, currency: saved.currency ?? result.currency, stage, expectedVersion },
  };
}
