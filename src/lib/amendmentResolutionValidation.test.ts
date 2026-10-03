import {
  validatePendingResolution,
  validateResolutionQuote,
  validateResolutionResult,
} from './amendmentResolutionValidation';
import {
  pendingTillConfirmationBatchForRetry,
  preparePendingTillConfirmations,
} from './amendmentResolutionTillValidation';
import { validateResolutionOutcome, validateResolutionRefusal } from './amendmentResolutionOutcomeValidation';
import { resolutionStartRequestSchema } from '@/schemas/amendmentResolution.schema';
import {
  pendingResolutionFixture,
  resolutionIds,
  resolutionRefusalFixture,
  resolutionResultFixture,
} from './__fixtures__/amendmentResolution';

describe('paid amendment evidence validation', () => {
  it('accepts an independently fixed 10.00 credit, 4.00 refund and 6.00 unpaid waiver', () => {
    const pending = pendingResolutionFixture();
    expect(validatePendingResolution(pending)).toEqual(pending);
    expect(validateResolutionResult(resolutionResultFixture(), pending)).toMatchObject({
      creditMinor: 1_000,
      refundMinor: 400,
      unpaidWaivedMinor: 600,
      state: 'Resolved',
    });
  });

  it.each(['sourceOrderId', 'amendmentId', 'clientOperationId'] as const)('rejects a foreign %s', (field) => {
    expect(() =>
      validateResolutionResult(
        { ...resolutionResultFixture(), [field]: resolutionIds.other },
        pendingResolutionFixture(),
      ),
    ).toThrow();
  });

  it('binds the first verified server operation and rejects a subsequent different operation', () => {
    const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
    expect(() =>
      validateResolutionResult({ ...resolutionResultFixture(), operationId: resolutionIds.other }, pending),
    ).toThrow();
  });

  it.each([
    { currency: 'EUR' },
    { creditMinor: 999 },
    { refundMinor: 399 },
    { unpaidWaivedMinor: 601 },
    { state: 'Complete' },
    { resolvedAt: null },
    { creditMinor: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects conflicting financial or terminal evidence %j', (change) => {
    expect(() =>
      validateResolutionResult({ ...resolutionResultFixture(), ...change }, pendingResolutionFixture()),
    ).toThrow();
  });

  it('does not treat a successful leg within a Processing aggregate as resolved', () => {
    const result = { ...resolutionResultFixture(), state: 'Processing', resolvedAt: null };
    expect(validateResolutionResult(result, pendingResolutionFixture()).state).toBe('Processing');
  });

  it('requires exact server till proof before a manual leg can be marked succeeded', () => {
    const pending = pendingResolutionFixture();
    pending.operationId = resolutionIds.operation;
    pending.reviewedQuote.refundLegs[0] = {
      ...pending.reviewedQuote.refundLegs[0],
      paymentMethod: 'Cash',
      custody: 'ManualTill',
      requiresTillConfirmation: true,
    };
    pending.pendingTillConfirmations = [{ paymentId: resolutionIds.payment, tillReference: 'Till-27' }];
    const result = resolutionResultFixture();
    result.refundLegs[0] = {
      ...result.refundLegs[0],
      custody: 'ManualTill',
      tillConfirmation: { tillReference: 'Till-27', confirmedAt: '2026-10-03T16:00:30Z' },
    };
    expect(validateResolutionResult(result, pending).refundLegs[0].tillConfirmation?.tillReference).toBe('Till-27');
    expect(
      validateResolutionResult(
        {
          ...result,
          refundLegs: [{ ...result.refundLegs[0], resolvedAt: '2026-10-03T18:00:30+02:00' }],
        },
        pending,
      ).refundLegs[0].resolvedAt,
    ).toBe('2026-10-03T18:00:30+02:00');
    expect(() =>
      validateResolutionResult(
        {
          ...result,
          refundLegs: [{ ...result.refundLegs[0], resolvedAt: '2026-10-03T16:00:31Z' }],
        },
        pending,
      ),
    ).toThrow();
    expect(() =>
      validateResolutionResult(
        {
          ...result,
          refundLegs: [
            {
              ...result.refundLegs[0],
              tillConfirmation: { ...result.refundLegs[0].tillConfirmation, tillReference: 'Other-27' },
            },
          ],
        },
        pending,
      ),
    ).toThrow();
    expect(() =>
      validateResolutionResult(
        { ...result, refundLegs: [{ ...result.refundLegs[0], tillConfirmation: null }] },
        pending,
      ),
    ).toThrow();
  });

  it('freezes every pending manual leg and permits only compatible exact retries', () => {
    const pending = pendingResolutionFixture();
    pending.operationId = resolutionIds.operation;
    const first = pending.reviewedQuote.refundLegs[0];
    const secondId = resolutionIds.allocation;
    pending.reviewedQuote.refundLegs = [
      {
        ...first,
        paymentMethod: 'Cash',
        custody: 'ManualTill',
        requiresTillConfirmation: true,
        amountMinor: 200,
        scopes: [],
      },
      {
        ...first,
        paymentId: secondId,
        paymentMethod: 'Cash',
        custody: 'ManualTill',
        requiresTillConfirmation: true,
        amountMinor: 200,
        scopes: [],
      },
    ];
    pending.reviewedQuote.refundMinor = 400;
    pending.request.quote.manualRefunds = [
      { paymentId: resolutionIds.payment, amountMinor: 200 },
      { paymentId: secondId, amountMinor: 200 },
    ];
    const result = resolutionResultFixture();
    result.state = 'Processing';
    result.resolvedAt = null;
    result.refundLegs = pending.reviewedQuote.refundLegs.map((leg) => ({
      paymentId: leg.paymentId,
      custody: 'ManualTill' as const,
      state: 'Pending' as const,
      amountMinor: leg.amountMinor,
      resolvedAt: null,
      tillConfirmation: null,
    }));
    const firstConfirmation = { paymentId: resolutionIds.payment, tillReference: 'Till-27' };
    const secondConfirmation = { paymentId: secondId, tillReference: 'Till-28' };

    expect(preparePendingTillConfirmations(pending, result, [firstConfirmation])).toBeNull();
    const prepared = preparePendingTillConfirmations(pending, result, [secondConfirmation, firstConfirmation]);
    expect(prepared?.pendingTillConfirmations).toEqual([firstConfirmation, secondConfirmation]);
    if (!prepared) throw new Error('Expected the complete till batch to be frozen');
    expect(() => validatePendingResolution({ ...prepared, pendingTillConfirmations: [firstConfirmation] })).toThrow();
    expect(pendingTillConfirmationBatchForRetry(prepared, result)).toEqual([firstConfirmation, secondConfirmation]);
    result.refundLegs[0] = {
      ...result.refundLegs[0],
      state: 'Succeeded',
      resolvedAt: '2026-10-03T16:00:30Z',
      tillConfirmation: { tillReference: 'Wrong-27', confirmedAt: '2026-10-03T16:00:30Z' },
    };
    expect(pendingTillConfirmationBatchForRetry(prepared, result)).toBeNull();
  });

  it('fills an original till batch from server proof when another device already confirmed one leg', () => {
    const pending = pendingResolutionFixture();
    pending.operationId = resolutionIds.operation;
    const firstId = resolutionIds.payment;
    const secondId = resolutionIds.allocation;
    const firstLeg = pending.reviewedQuote.refundLegs[0];
    pending.reviewedQuote.refundLegs = [firstId, secondId].map((paymentId) => ({
      ...firstLeg,
      paymentId,
      paymentMethod: 'Cash' as const,
      custody: 'ManualTill' as const,
      requiresTillConfirmation: true,
      amountMinor: 200,
      scopes: [],
    }));
    pending.reviewedQuote.refundMinor = 400;
    pending.request.quote.manualRefunds = [
      { paymentId: firstId, amountMinor: 200 },
      { paymentId: secondId, amountMinor: 200 },
    ];

    const result = resolutionResultFixture();
    result.state = 'Processing';
    result.resolvedAt = null;
    result.refundLegs = [
      {
        paymentId: firstId,
        custody: 'ManualTill',
        state: 'Succeeded',
        amountMinor: 200,
        resolvedAt: '2026-10-03T16:00:30Z',
        tillConfirmation: { tillReference: 'Remote-27', confirmedAt: '2026-10-03T16:00:30Z' },
      },
      {
        paymentId: secondId,
        custody: 'ManualTill',
        state: 'Pending',
        amountMinor: 200,
        resolvedAt: null,
        tillConfirmation: null,
      },
    ];
    const pendingInput = [{ paymentId: secondId, tillReference: 'Local-28' }];

    const prepared = preparePendingTillConfirmations(pending, result, pendingInput);
    expect(prepared?.pendingTillConfirmations).toEqual([
      { paymentId: firstId, tillReference: 'Remote-27' },
      { paymentId: secondId, tillReference: 'Local-28' },
    ]);
    if (!prepared) throw new Error('Expected server proof and new input to form a complete batch');
    expect(pendingTillConfirmationBatchForRetry(prepared, result)).toEqual(prepared.pendingTillConfirmations);

    expect(() => validatePendingResolution({ ...prepared, pendingTillConfirmations: [pendingInput[0]] })).toThrow();
    const wrongSavedProof = {
      ...prepared,
      pendingTillConfirmations: [
        { paymentId: firstId, tillReference: 'Wrong-27' },
        { paymentId: secondId, tillReference: 'Local-28' },
      ],
    };
    expect(pendingTillConfirmationBatchForRetry(wrongSavedProof, result)).toBeNull();

    const missingServerProof = {
      ...result,
      refundLegs: [{ ...result.refundLegs[0], tillConfirmation: null }, result.refundLegs[1]],
    };
    expect(pendingTillConfirmationBatchForRetry(prepared, missingServerProof)).toBeNull();
  });

  it('rejects a resolved aggregate with a pending leg, despite matching amounts', () => {
    const result = resolutionResultFixture();
    result.refundLegs[0] = { ...result.refundLegs[0], state: 'Pending', resolvedAt: null };
    expect(() => validateResolutionResult(result, pendingResolutionFixture())).toThrow();
  });

  it('rejects the wrong tender even when currency and refund total match', () => {
    const result = resolutionResultFixture();
    result.refundLegs[0].paymentId = resolutionIds.other;
    expect(() => validateResolutionResult(result, pendingResolutionFixture())).toThrow();
  });

  it('rejects changed allocation unit money and nonconserving credit before review', () => {
    const pending = pendingResolutionFixture();
    pending.reviewedQuote.refundLegs[0].scopes[0].minorPerUnit = 399;
    expect(() => validatePendingResolution(pending)).toThrow();
    pending.reviewedQuote.refundLegs[0].scopes[0].minorPerUnit = 400;
    pending.reviewedQuote.unpaidWaivedMinor = 601;
    expect(() => validatePendingResolution(pending)).toThrow();
  });

  it('requires explicit tender selection but forbids till attestations before Start', () => {
    const pending = pendingResolutionFixture();
    const leg = pending.reviewedQuote.refundLegs[0];
    Object.assign(leg, { paymentMethod: 'Cash', custody: 'ManualTill', requiresTillConfirmation: true, scopes: [] });
    expect(() => validatePendingResolution(pending)).toThrow();
    pending.request.quote.manualRefunds = [{ paymentId: resolutionIds.payment, amountMinor: 400 }];
    expect(validatePendingResolution(pending)).toEqual(pending);
    expect(() =>
      resolutionStartRequestSchema.parse({
        ...pending.request,
        tillConfirmations: [{ paymentId: resolutionIds.payment, tillReference: 'Till-refund-27' }],
      }),
    ).toThrow();
  });

  it('rejects changed frozen quote hash/expiry and a quote from another operation', () => {
    const pending = pendingResolutionFixture();
    pending.request.quoteHash = 'b'.repeat(64);
    expect(() => validatePendingResolution(pending)).toThrow();
    expect(() =>
      validateResolutionQuote(
        { ...pending.reviewedQuote, clientOperationId: resolutionIds.other },
        pending.orderId,
        pending.amendmentId,
        pending.request.quote,
      ),
    ).toThrow();
  });

  it('accepts a canonical durable pre-provider refusal for the original request', () => {
    const pending = pendingResolutionFixture();
    pending.request.quote.expectedAccountRevision = null;
    const refusal = resolutionRefusalFixture(pending);
    delete refusal.originalRequest.quote.expectedAccountRevision;
    refusal.actorUserId = refusal.actorUserId.toUpperCase();
    refusal.orderId = refusal.orderId.toUpperCase();
    refusal.amendmentId = refusal.amendmentId.toUpperCase();
    refusal.clientOperationId = refusal.clientOperationId.toUpperCase();
    refusal.originalRequest.quote.clientOperationId = refusal.originalRequest.quote.clientOperationId.toUpperCase();
    expect(validateResolutionOutcome({ outcome: 'refused', refusal, result: null }, pending)).toMatchObject({
      outcome: 'refused',
      refusal: { failureCode: 'sourceVersionConflict' },
    });
  });

  it('matches normalized manual selections by payment identity', () => {
    const pending = pendingResolutionFixture();
    const secondPaymentId = resolutionIds.allocation;
    pending.reviewedQuote.refundLegs = [
      ...pending.reviewedQuote.refundLegs,
      {
        ...pending.reviewedQuote.refundLegs[0],
        paymentId: secondPaymentId,
        paymentMethod: 'Cash',
        custody: 'ManualTill',
        requiresTillConfirmation: true,
        amountMinor: 200,
        scopes: [],
      },
    ];
    pending.reviewedQuote.refundLegs[0] = {
      ...pending.reviewedQuote.refundLegs[0],
      paymentMethod: 'Cash',
      custody: 'ManualTill',
      requiresTillConfirmation: true,
      amountMinor: 200,
      scopes: [],
    };
    pending.request.quote.manualRefunds = [
      { paymentId: resolutionIds.payment, amountMinor: 200 },
      { paymentId: secondPaymentId, amountMinor: 200 },
    ];
    const refusal = resolutionRefusalFixture(pending);
    refusal.originalRequest = JSON.parse(JSON.stringify(pending.request)) as typeof pending.request;
    refusal.originalRequest.quote.manualRefunds.reverse();

    expect(() => validatePendingResolution(pending)).not.toThrow();
    expect(() => validateResolutionRefusal(refusal, pending)).not.toThrow();
  });

  it.each([
    ['actorUserId', { actorUserId: resolutionIds.other }],
    ['orderId', { orderId: resolutionIds.other }],
    ['amendmentId', { amendmentId: resolutionIds.other }],
    ['clientOperationId', { clientOperationId: resolutionIds.other }],
    ['requestHash', { requestHash: 'short' }],
    ['failureCode', { failureCode: 'providerUnknown' }],
    ['failureCode', { failureCode: 'tillConfirmationInvalid' }],
    ['createdAt', { createdAt: 'not-a-date' }],
  ] as const)('rejects a refusal with conflicting %s', (_field, change) => {
    const pending = pendingResolutionFixture();
    const refusal = { ...resolutionRefusalFixture(pending), ...change };
    expect(() => validateResolutionOutcome({ outcome: 'refused', refusal }, pending)).toThrow();
  });

  it.each([
    ['quoteHash', { quoteHash: 'c'.repeat(64) }],
    ['expiry', { expiresAt: '2026-10-03T17:00:00Z' }],
    ['currency', { quote: { ...pendingResolutionFixture().request.quote, currency: 'EUR' } }],
  ] as const)('rejects a refusal whose original request changes %s', (_field, change) => {
    const pending = pendingResolutionFixture();
    const refusal = resolutionRefusalFixture(pending);
    Object.assign(refusal.originalRequest, change);
    expect(() => validateResolutionRefusal(refusal, pending)).toThrow();
  });

  it('never accepts a pre-provider refusal after a server operation ID is known', () => {
    const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
    expect(() => validateResolutionRefusal(resolutionRefusalFixture(pending), pending)).toThrow();
  });

  it('rejects ambiguous accepted/refused outcome payloads', () => {
    const pending = pendingResolutionFixture();
    const refusal = resolutionRefusalFixture(pending);
    expect(() =>
      validateResolutionOutcome({ outcome: 'accepted', result: resolutionResultFixture(), refusal }, pending),
    ).toThrow();
    expect(() =>
      validateResolutionOutcome({ outcome: 'refused', refusal, result: resolutionResultFixture() }, pending),
    ).toThrow();
  });
});
