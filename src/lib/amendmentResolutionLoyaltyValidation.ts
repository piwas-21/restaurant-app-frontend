import type { AmendmentResolutionQuote, AmendmentResolutionResult } from '@/types/amendmentResolution';

function requireMatch(matches: boolean): void {
  if (!matches) throw new Error('AmendmentResolutionEvidenceMismatch');
}

export function validateResolutionLoyaltyQuote(quote: AmendmentResolutionQuote): void {
  const loyalty = quote.loyalty;
  if (!loyalty) return;
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
  requireMatch(
    loyalty.candidatePoints === reviewed.candidatePoints &&
      loyalty.earnedClawbackPoints === reviewed.earnedClawbackPoints &&
      loyalty.redemptionRestorationPoints === reviewed.redemptionRestorationPoints,
  );
  requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints <= loyalty.candidatePoints);
  if (loyalty.awardPending) requireMatch(reviewed.awardPending && loyalty.appliedAwardPoints === 0);
  else requireMatch(loyalty.appliedAwardPoints + loyalty.suppressedPoints === loyalty.candidatePoints);
  if (!reviewed.awardPending) {
    requireMatch(
      loyalty.appliedAwardPoints === reviewed.appliedAwardPoints &&
        loyalty.suppressedPoints === reviewed.suppressedPoints,
    );
  }
  requireMatch(
    loyalty.postedClawbackPoints <= loyalty.earnedClawbackPoints &&
      loyalty.postedRestorationPoints <= loyalty.redemptionRestorationPoints,
  );
  if (result.state === 'Resolved') {
    requireMatch(loyalty.state === 'Resolved' || loyalty.state === 'None');
    if (loyalty.state === 'None') {
      requireMatch(
        loyalty.earnedClawbackPoints === 0 &&
          loyalty.redemptionRestorationPoints === 0 &&
          loyalty.suppressedPoints === 0,
      );
    }
    requireMatch(
      loyalty.postedClawbackPoints === loyalty.earnedClawbackPoints &&
        loyalty.postedRestorationPoints === loyalty.redemptionRestorationPoints,
    );
  } else requireMatch(loyalty.postedClawbackPoints === 0 && loyalty.postedRestorationPoints === 0);
}
