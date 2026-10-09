import { z } from 'zod';

// Mirrors OrderAmendmentLoyaltyQuoteDto/ResultDto; balances and obligations stay server-owned.
const points = z.number().int().nonnegative().max(2_147_483_647);
const earningDisposition = z.enum([
  'Unevaluated',
  'Evaluated',
  'NoCustomerOwnerAtAcceptance',
  'LoyaltyModuleDisabledAtAcceptance',
]);
const award = {
  awardPending: z.boolean(),
  candidatePoints: points.nullable(),
  earningDisposition: earningDisposition.optional(),
  earningRetired: z.boolean().optional(),
  appliedAwardPoints: points,
  suppressedPoints: points,
  earnedClawbackPoints: points,
  redemptionRestorationPoints: points,
};

export const resolutionLoyaltyQuoteSchema = z.object({ ...award, removedUnitCount: points }).strict();

export const resolutionLoyaltyResultSchema = z
  .object({
    ...award,
    state: z.enum([
      'None',
      'AwaitingAwardSuppression',
      'PendingSettlement',
      'HeldShortfall',
      'Reserved',
      'ReleasedAfterNoRefund',
      'OwnerUnavailable',
      'Resolved',
    ]),
    postedClawbackPoints: points,
    postedRestorationPoints: points,
    availablePointsBeforeClawback: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    clawbackShortfallPoints: points.nullable(),
  })
  .strict();

export type AmendmentResolutionLoyaltyQuote = z.infer<typeof resolutionLoyaltyQuoteSchema>;
export type AmendmentResolutionLoyaltyResult = z.infer<typeof resolutionLoyaltyResultSchema>;
