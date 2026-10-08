import type { AmendmentResolutionQuote, AmendmentResolutionResult } from '@/types/amendmentResolution';
import type { AmendmentResolutionLoyaltyQuote } from '@/schemas/amendmentResolutionLoyalty.schema';

type LoyaltyEarningFacts = Pick<
  AmendmentResolutionLoyaltyQuote,
  | 'candidatePoints'
  | 'earningDisposition'
  | 'earningRetired'
  | 'awardPending'
  | 'appliedAwardPoints'
  | 'suppressedPoints'
  | 'earnedClawbackPoints'
  | 'redemptionRestorationPoints'
>;

function requireMatch(matches: boolean): void {
  if (!matches) throw new Error('AmendmentResolutionEvidenceMismatch');
}

export function validateResolutionLoyaltyQuote(quote: AmendmentResolutionQuote): void {
  const loyalty = quote.loyalty;
  if (!loyalty) return;
  validateEarningFacts(loyalty);
  if (loyalty.candidatePoints === null) return;
  requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints <= loyalty.candidatePoints);
  if (loyalty.awardPending) requireMatch(loyalty.appliedAwardPoints === 0);
  else requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints === loyalty.candidatePoints);
}

/** Never discard a pending refund when its points obligation or posting evidence has changed. */
export function validateResolutionLoyaltyResult(
  result: AmendmentResolutionResult,
  quote: AmendmentResolutionQuote,
): void {
  const reviewed = quote.loyalty ?? null;
  const loyalty = result.loyalty ?? null;
  requireMatch(Boolean(reviewed) === Boolean(loyalty));
  if (!reviewed || !loyalty) return;
  validateEarningFacts(reviewed);
  validateEarningFacts(loyalty);
  requireSameEarningFacts(loyalty, reviewed);
  validateResultAwardFacts(loyalty, reviewed);
  validateResultPosting(result, loyalty);
}

function validateResultAwardFacts(
  loyalty: NonNullable<AmendmentResolutionResult['loyalty']>,
  reviewed: AmendmentResolutionLoyaltyQuote,
): void {
  if (loyalty.candidatePoints === null) return;
  requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints <= loyalty.candidatePoints);
  if (loyalty.awardPending) {
    requireMatch(reviewed.awardPending && loyalty.appliedAwardPoints === 0);
    return;
  }
  requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints === loyalty.candidatePoints);
  if (!reviewed.awardPending) {
    requireMatch(
      loyalty.appliedAwardPoints === reviewed.appliedAwardPoints &&
        loyalty.suppressedPoints === reviewed.suppressedPoints,
    );
  }
}

function validateResultPosting(
  result: AmendmentResolutionResult,
  loyalty: NonNullable<AmendmentResolutionResult['loyalty']>,
): void {
  requireMatch(
    loyalty.postedClawbackPoints <= loyalty.earnedClawbackPoints &&
      loyalty.postedRestorationPoints <= loyalty.redemptionRestorationPoints,
  );
  if (result.state === 'Resolved') {
    requireMatch(loyalty.state === 'Resolved' || loyalty.state === 'None');
    if (loyalty.state === 'None') {
      requireMatch(loyalty.earnedClawbackPoints === 0 && loyalty.redemptionRestorationPoints === 0);
    }
    requireMatch(
      loyalty.postedClawbackPoints === loyalty.earnedClawbackPoints &&
        loyalty.postedRestorationPoints === loyalty.redemptionRestorationPoints,
    );
  } else requireMatch(loyalty.postedClawbackPoints === 0 && loyalty.postedRestorationPoints === 0);
}

function validateEarningFacts(loyalty: LoyaltyEarningFacts): void {
  if (loyalty.candidatePoints === null) {
    requireMatch(
      loyalty.earningDisposition !== undefined && loyalty.earningRetired !== undefined && !loyalty.awardPending,
    );
    requireMatch(
      loyalty.appliedAwardPoints === 0 && loyalty.suppressedPoints === 0 && loyalty.earnedClawbackPoints === 0,
    );
    requireMatch(loyalty.earningDisposition !== 'Evaluated');
    if (loyalty.earningDisposition === 'Unevaluated') requireMatch(loyalty.earningRetired === true);
    else requireMatch(!loyalty.earningRetired);
    return;
  }
  requireMatch(loyalty.earningDisposition === undefined || loyalty.earningDisposition === 'Evaluated');
  requireMatch(!loyalty.earningRetired);
}

function normalizedDisposition(loyalty: LoyaltyEarningFacts): string | undefined {
  return loyalty.earningDisposition ?? (loyalty.candidatePoints === null ? undefined : 'Evaluated');
}

function normalizedRetired(loyalty: LoyaltyEarningFacts): boolean {
  return loyalty.earningRetired ?? false;
}

function requireSameEarningFacts(result: LoyaltyEarningFacts, reviewed: LoyaltyEarningFacts): void {
  requireMatch(
    result.candidatePoints === reviewed.candidatePoints &&
      result.earnedClawbackPoints === reviewed.earnedClawbackPoints &&
      result.redemptionRestorationPoints === reviewed.redemptionRestorationPoints &&
      normalizedDisposition(result) === normalizedDisposition(reviewed) &&
      normalizedRetired(result) === normalizedRetired(reviewed),
  );
}
