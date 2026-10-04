import type {
  AmendmentResolutionCashRefund,
  AmendmentResolutionCashReturn,
  AmendmentResolutionResult,
  AmendmentResolutionTillConfirmations,
  PendingAmendmentResolution,
} from '@/types/amendmentResolution';
import { pendingResolutionFixture, resolutionIds, resolutionResultFixture } from './amendmentResolution';

type TillConfirmation = AmendmentResolutionTillConfirmations[number];

export function cashRefundFixture() {
  return {
    policyVersion: 'chf-cash-5-rappen-v1',
    originalExactAmountMinor: 335,
    originalDueAmountMinor: 335,
    previouslyRefundedExactMinor: 0,
    previouslyRefundedCashMinor: 0,
    exactRefundAmountMinor: 1,
    refundAdjustmentMinor: -1,
    cashRefundAmountMinor: 0,
    retainedExactAmountMinor: 334,
    retainedCashDueMinor: 335,
  } satisfies AmendmentResolutionCashRefund;
}

export function cashReturnPendingFixture(): PendingAmendmentResolution {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  const cashRefund = cashRefundFixture();
  pending.reviewedQuote.creditMinor = 1_000;
  pending.reviewedQuote.refundMinor = 1;
  pending.reviewedQuote.unpaidWaivedMinor = 999;
  pending.reviewedQuote.refundLegs[0] = {
    ...pending.reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    amountMinor: 1,
    requiresTillConfirmation: true,
    scopes: [],
    cashRefund,
  };
  pending.request.quote.manualRefunds = [{ paymentId: resolutionIds.payment, amountMinor: 1 }];
  return pending;
}

export function legacyTillCashPendingFixture(): PendingAmendmentResolution {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  pending.reviewedQuote.refundLegs[0] = {
    ...pending.reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
  };
  return pending;
}

export function zeroCashReturnConfirmationFixture(): TillConfirmation {
  return { paymentId: resolutionIds.payment, tillReference: 'Till-zero', cashReturnedMinor: 0 };
}

export function cashReturnProcessingResultFixture() {
  const cashRefund = cashRefundFixture();
  return {
    ...resolutionResultFixture(),
    state: 'Processing',
    resolvedAt: null,
    creditMinor: 1_000,
    refundMinor: 1,
    unpaidWaivedMinor: 999,
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        custody: 'ManualTill',
        state: 'Pending',
        amountMinor: 1,
        resolvedAt: null,
        tillConfirmation: null,
        cashRefund,
      },
    ],
  } satisfies AmendmentResolutionResult;
}

export function cashReturnConfirmedResultFixture() {
  const result = cashReturnProcessingResultFixture();
  const confirmedAt = '2026-10-03T16:00:30Z';
  return {
    ...result,
    refundLegs: [
      {
        ...result.refundLegs[0],
        state: 'Succeeded',
        resolvedAt: confirmedAt,
        tillConfirmation: { tillReference: 'Till-zero', confirmedAt },
        cashReturn: {
          exactRefundAmountMinor: 1,
          refundAdjustmentMinor: -1,
          cashReturnedMinor: 0,
          confirmedAt,
        } satisfies AmendmentResolutionCashReturn,
      },
    ],
  } satisfies AmendmentResolutionResult;
}
