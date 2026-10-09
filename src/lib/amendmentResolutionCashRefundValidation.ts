import { accountCashDueFromPolicy } from '@/lib/accountCashEvidence';
import type {
  AmendmentResolutionCashRefund,
  AmendmentResolutionQuote,
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
} from '@/types/amendmentResolution';

function requireMatch(matches: boolean): void {
  if (!matches) throw new Error('AmendmentResolutionEvidenceMismatch');
}

function due(policy: AmendmentResolutionCashRefund['policyVersion'], currency: string, exactMinor: number): number {
  const amount = accountCashDueFromPolicy(policy, currency, 'Cash', exactMinor);
  requireMatch(amount !== null);
  return amount ?? 0;
}

export function sameCashRefundTerms(
  first: AmendmentResolutionCashRefund | null = null,
  second: AmendmentResolutionCashRefund | null = null,
): boolean {
  if (first === null || second === null) return first === second;
  return (
    first.policyVersion === second.policyVersion &&
    first.originalExactAmountMinor === second.originalExactAmountMinor &&
    first.originalDueAmountMinor === second.originalDueAmountMinor &&
    first.previouslyRefundedExactMinor === second.previouslyRefundedExactMinor &&
    first.previouslyRefundedCashMinor === second.previouslyRefundedCashMinor &&
    first.exactRefundAmountMinor === second.exactRefundAmountMinor &&
    first.refundAdjustmentMinor === second.refundAdjustmentMinor &&
    first.cashRefundAmountMinor === second.cashRefundAmountMinor &&
    first.retainedExactAmountMinor === second.retainedExactAmountMinor &&
    first.retainedCashDueMinor === second.retainedCashDueMinor
  );
}

export function validateQuoteCashRefund(leg: AmendmentResolutionQuote['refundLegs'][number], currency: string): void {
  const refund = leg.cashRefund ?? null;
  if (!refund) return;
  requireMatch(leg.paymentMethod === 'Cash' && leg.custody === 'ManualTill' && leg.requiresTillConfirmation);
  requireMatch(refund.exactRefundAmountMinor === leg.amountMinor);
  requireMatch(refund.originalDueAmountMinor === due(refund.policyVersion, currency, refund.originalExactAmountMinor));
  requireMatch(refund.previouslyRefundedExactMinor <= refund.originalExactAmountMinor);
  requireMatch(refund.previouslyRefundedCashMinor <= refund.originalDueAmountMinor);

  const exactBefore = refund.originalExactAmountMinor - refund.previouslyRefundedExactMinor;
  requireMatch(refund.exactRefundAmountMinor <= exactBefore);
  requireMatch(refund.retainedExactAmountMinor === exactBefore - refund.exactRefundAmountMinor);
  const cashBefore = due(refund.policyVersion, currency, exactBefore);
  requireMatch(refund.originalDueAmountMinor - refund.previouslyRefundedCashMinor === cashBefore);
  requireMatch(refund.retainedCashDueMinor === due(refund.policyVersion, currency, refund.retainedExactAmountMinor));
  requireMatch(refund.cashRefundAmountMinor === cashBefore - refund.retainedCashDueMinor);
  requireMatch(
    BigInt(refund.originalDueAmountMinor) ===
      BigInt(refund.previouslyRefundedCashMinor) +
        BigInt(refund.cashRefundAmountMinor) +
        BigInt(refund.retainedCashDueMinor),
  );
  requireMatch(refund.refundAdjustmentMinor === refund.cashRefundAmountMinor - refund.exactRefundAmountMinor);
}

function ownsCashReturned(value: object): boolean {
  return Object.hasOwn(value, 'cashReturnedMinor');
}

export function validateTillCashIntent(
  quote: AmendmentResolutionQuote,
  confirmations: AmendmentResolutionTillConfirmations,
): void {
  const byPayment = new Map(confirmations.map((value) => [value.paymentId.toLowerCase(), value]));
  for (const leg of quote.refundLegs.filter((value) => value.custody === 'ManualTill')) {
    const confirmation = byPayment.get(leg.paymentId.toLowerCase());
    requireMatch(confirmation !== undefined);
    if (!confirmation) continue;
    const refund = leg.cashRefund ?? null;
    requireMatch(
      refund
        ? ownsCashReturned(confirmation) && confirmation.cashReturnedMinor === refund.cashRefundAmountMinor
        : !ownsCashReturned(confirmation),
    );
  }
}

export function validateResultCashRefund(
  quoteLeg: AmendmentResolutionQuote['refundLegs'][number],
  resultLeg: AmendmentResolutionResult['refundLegs'][number],
): void {
  const refund = quoteLeg.cashRefund ?? null;
  requireMatch(sameCashRefundTerms(refund, resultLeg.cashRefund));
  const returned = resultLeg.cashReturn ?? null;
  if (!refund) {
    requireMatch(returned === null);
    return;
  }
  if (resultLeg.state !== 'Succeeded') {
    requireMatch(returned === null);
    return;
  }
  requireMatch(returned !== null && resultLeg.resolvedAt !== null && resultLeg.tillConfirmation != null);
  if (!returned || !resultLeg.resolvedAt || !resultLeg.tillConfirmation) return;
  requireMatch(returned.exactRefundAmountMinor === refund.exactRefundAmountMinor);
  requireMatch(returned.refundAdjustmentMinor === refund.refundAdjustmentMinor);
  requireMatch(returned.cashReturnedMinor === refund.cashRefundAmountMinor);
  requireMatch(Date.parse(returned.confirmedAt) === Date.parse(resultLeg.resolvedAt));
  requireMatch(Date.parse(returned.confirmedAt) === Date.parse(resultLeg.tillConfirmation.confirmedAt));
}
