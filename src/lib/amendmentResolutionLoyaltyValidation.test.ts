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

  it('accepts no current adjustment while preserving an earlier award suppression', () => {
    const { pending, result } = evidence();
    pending.reviewedQuote.loyalty = {
      ...reviewed,
      appliedAwardPoints: 15,
      suppressedPoints: 10,
      earnedClawbackPoints: 0,
      redemptionRestorationPoints: 0,
    };
    result.loyalty = {
      ...result.loyalty!,
      appliedAwardPoints: 15,
      suppressedPoints: 10,
      earnedClawbackPoints: 0,
      redemptionRestorationPoints: 0,
      state: 'None',
      postedClawbackPoints: 0,
      postedRestorationPoints: 0,
    };
    expect(validateResolutionResult(result, pending).loyalty).toMatchObject({
      state: 'None',
      suppressedPoints: 10,
      appliedAwardPoints: 15,
    });
  });

  it('preserves a known-ineligible earning as null while allowing proven redemption restoration', () => {
    const { pending, result } = evidence();
    const unevaluated = {
      ...reviewed,
      candidatePoints: null,
      earningDisposition: 'NoCustomerOwnerAtAcceptance' as const,
      earningRetired: false,
      appliedAwardPoints: 0,
      suppressedPoints: 0,
      earnedClawbackPoints: 0,
      redemptionRestorationPoints: 6,
    };
    pending.reviewedQuote.loyalty = unevaluated;
    result.loyalty = {
      ...result.loyalty!,
      ...unevaluated,
      state: 'Resolved',
      postedClawbackPoints: 0,
      postedRestorationPoints: 6,
      availablePointsBeforeClawback: null,
      clawbackShortfallPoints: null,
    };
    delete (result.loyalty as Partial<AmendmentResolutionLoyaltyQuote>).removedUnitCount;

    expect(validateResolutionResult(result, pending).loyalty).toMatchObject({
      candidatePoints: null,
      earningDisposition: 'NoCustomerOwnerAtAcceptance',
      earningRetired: false,
      earnedClawbackPoints: 0,
      postedRestorationPoints: 6,
    });
  });

  it('preserves retired unknown earning as null while allowing proven redemption restoration', () => {
    const { pending, result } = evidence();
    const retired = {
      ...reviewed,
      candidatePoints: null,
      earningDisposition: 'Unevaluated' as const,
      earningRetired: true,
      appliedAwardPoints: 0,
      suppressedPoints: 0,
      earnedClawbackPoints: 0,
      redemptionRestorationPoints: 6,
    };
    pending.reviewedQuote.loyalty = retired;
    result.loyalty = {
      ...result.loyalty!,
      ...retired,
      state: 'Resolved',
      postedClawbackPoints: 0,
      postedRestorationPoints: 6,
      availablePointsBeforeClawback: null,
      clawbackShortfallPoints: null,
    };
    delete (result.loyalty as Partial<AmendmentResolutionLoyaltyQuote>).removedUnitCount;

    expect(validateResolutionResult(result, pending).loyalty).toMatchObject({
      candidatePoints: null,
      earningDisposition: 'Unevaluated',
      earningRetired: true,
      earnedClawbackPoints: 0,
      postedRestorationPoints: 6,
    });
  });

  it.each([
    ['applied award', { appliedAwardPoints: 1 }],
    ['suppressed award', { suppressedPoints: 1 }],
    ['earned clawback', { earnedClawbackPoints: 1 }],
    ['evaluated disposition', { earningDisposition: 'Evaluated' as const }],
    ['unretired unknown earning', { earningDisposition: 'Unevaluated' as const, earningRetired: false }],
    [
      'retirement of known ineligibility',
      { earningDisposition: 'NoCustomerOwnerAtAcceptance' as const, earningRetired: true },
    ],
  ])('rejects null candidate evidence with invalid %s', (_label, override) => {
    const { pending } = evidence();
    pending.reviewedQuote.loyalty = {
      ...reviewed,
      candidatePoints: null,
      earningDisposition: 'NoCustomerOwnerAtAcceptance',
      earningRetired: false,
      appliedAwardPoints: 0,
      suppressedPoints: 0,
      earnedClawbackPoints: 0,
      ...override,
    };
    expect(() => validatePendingResolution(pending)).toThrow('AmendmentResolutionEvidenceMismatch');
  });

  it('retains resolution when immutable earning disposition or retirement evidence changes', () => {
    const { pending, result } = evidence();
    pending.reviewedQuote.loyalty = {
      ...reviewed,
      candidatePoints: null,
      earningDisposition: 'Unevaluated',
      earningRetired: true,
      appliedAwardPoints: 0,
      suppressedPoints: 0,
      earnedClawbackPoints: 0,
    };
    result.loyalty = {
      ...result.loyalty!,
      candidatePoints: null,
      earningDisposition: 'Unevaluated',
      earningRetired: true,
      appliedAwardPoints: 0,
      suppressedPoints: 0,
      earnedClawbackPoints: 0,
      state: 'Resolved',
      postedClawbackPoints: 0,
    };
    delete (result.loyalty as Partial<AmendmentResolutionLoyaltyQuote>).removedUnitCount;
    expect(validateResolutionResult(result, pending).state).toBe('Resolved');
    result.loyalty.earningRetired = false;
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
