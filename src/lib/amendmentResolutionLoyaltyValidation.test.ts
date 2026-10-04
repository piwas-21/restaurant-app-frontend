import { validatePendingResolution, validateResolutionResult } from './amendmentResolutionValidation';
import { pendingResolutionFixture, resolutionResultFixture } from './__fixtures__/amendmentResolution';
import type { AmendmentResolutionLoyaltyQuote } from '@/schemas/amendmentResolutionLoyalty.schema';

const reviewed: AmendmentResolutionLoyaltyQuote = {
  awardPending: false,
  candidatePoints: 25,
  appliedAwardPoints: 25,
  suppressedPoints: 0,
  earnedClawbackPoints: 10,
  redemptionRestorationPoints: 6,
  removedUnitCount: 1,
};

function evidence() {
  const pending = pendingResolutionFixture();
  pending.reviewedQuote.loyalty = { ...reviewed };
  const result = resolutionResultFixture();
  result.loyalty = {
    ...reviewed,
    state: 'Resolved',
    postedClawbackPoints: 10,
    postedRestorationPoints: 6,
    availablePointsBeforeClawback: 40,
    clawbackShortfallPoints: null,
  };
  // The result deliberately has no removedUnitCount: the wire contracts differ.
  delete (result.loyalty as Partial<AmendmentResolutionLoyaltyQuote>).removedUnitCount;
  return { pending, result };
}

describe('loyalty evidence in amendment recovery', () => {
  it('accepts older responses with absent or null loyalty', () => {
    const pending = pendingResolutionFixture();
    const result = resolutionResultFixture();
    expect(validateResolutionResult(result, pending).state).toBe('Resolved');
    pending.reviewedQuote.loyalty = null;
    result.loyalty = null;
    expect(validateResolutionResult(result, pending).state).toBe('Resolved');
  });

  it('keeps points separate from the independently fixed money totals', () => {
    const { pending, result } = evidence();
    expect(validatePendingResolution(pending).reviewedQuote.loyalty).toEqual(reviewed);
    expect(validateResolutionResult(result, pending)).toMatchObject({
      creditMinor: 1000,
      refundMinor: 400,
      unpaidWaivedMinor: 600,
      loyalty: { postedClawbackPoints: 10, postedRestorationPoints: 6 },
    });
  });

  it.each(['candidatePoints', 'earnedClawbackPoints', 'redemptionRestorationPoints'] as const)(
    'retains recovery when the accepted %s obligation changes',
    (field) => {
      const { pending, result } = evidence();
      result.loyalty![field] += 1;
      expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
    },
  );

  it.each(['postedClawbackPoints', 'postedRestorationPoints'] as const)(
    'rejects terminal money evidence that omits the exact %s posting',
    (field) => {
      const { pending, result } = evidence();
      result.loyalty![field] -= 1;
      expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
    },
  );

  it('accepts a held shortfall with zero postings and refuses invented posted points', () => {
    const { pending, result } = evidence();
    result.state = 'Processing';
    result.resolvedAt = null;
    result.loyalty = {
      ...result.loyalty!,
      state: 'HeldShortfall',
      postedClawbackPoints: 0,
      postedRestorationPoints: 0,
      availablePointsBeforeClawback: 3,
      clawbackShortfallPoints: 7,
    };
    expect(validateResolutionResult(result, pending).loyalty?.clawbackShortfallPoints).toBe(7);
    result.loyalty.postedRestorationPoints = 6;
    expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
  });

  it('allows a pending award witness to become durable after the quote', () => {
    const { pending, result } = evidence();
    pending.reviewedQuote.loyalty = { ...reviewed, awardPending: true, appliedAwardPoints: 0 };
    expect(validateResolutionResult(result, pending).loyalty?.appliedAwardPoints).toBe(25);
    result.loyalty = { ...result.loyalty!, awardPending: true, appliedAwardPoints: 25 };
    expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
  });

  it('refuses a response that drops new loyalty evidence and malformed point values', () => {
    const { pending, result } = evidence();
    result.loyalty = null;
    expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
    pending.reviewedQuote.loyalty = { ...reviewed, candidatePoints: -1 };
    expect(() => validatePendingResolution(pending)).toThrow();
    pending.reviewedQuote.loyalty = { ...reviewed, candidatePoints: 24 };
    expect(() => validatePendingResolution(pending)).toThrow('AmendmentResolutionEvidenceMismatch');
  });

  it('rejects incomplete durable award evidence and a held state under a terminal refund', () => {
    const { pending, result } = evidence();
    pending.reviewedQuote.loyalty = { ...reviewed, appliedAwardPoints: 24 };
    expect(() => validatePendingResolution(pending)).toThrow('AmendmentResolutionEvidenceMismatch');
    pending.reviewedQuote.loyalty = { ...reviewed };
    result.loyalty!.state = 'HeldShortfall';
    expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
    result.loyalty!.state = 'None';
    expect(() => validateResolutionResult(result, pending)).toThrow('AmendmentResolutionEvidenceMismatch');
  });
});
