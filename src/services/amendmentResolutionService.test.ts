import { apiClient } from '@/utils/apiClient';
import {
  pendingResolutionFixture,
  resolutionRefusalFixture,
  resolutionIds,
  resolutionResultFixture,
} from '@/lib/__fixtures__/amendmentResolution';
import {
  confirmAmendmentResolutionTill,
  lookupAmendmentResolution,
  quoteAmendmentResolution,
  recoverAmendmentResolution,
  startAmendmentResolution,
} from './amendmentResolutionService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = jest.mocked(apiClient.get);
const post = jest.mocked(apiClient.post);
beforeEach(() => jest.resetAllMocks());

it('uses authenticated original-client-key GET even without a returned server operation ID', async () => {
  const original = pendingResolutionFixture();
  get.mockResolvedValue({ success: true, data: { outcome: 'accepted', result: resolutionResultFixture() } });
  await expect(lookupAmendmentResolution(original)).resolves.toMatchObject({
    outcome: 'accepted',
    result: { state: 'Resolved', refundMinor: 400 },
  });
  expect(get).toHaveBeenCalledWith(
    `/api/staff/orders/${original.orderId}/amendments/${original.amendmentId}/financial-resolution/operations/${original.request.quote.clientOperationId}`,
    { requireAuth: true, signOutOn401: false },
  );
  expect(post).not.toHaveBeenCalled();
});

it('binds a lost-operation lookup to the frozen cash refund terms', async () => {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  const cashRefund = {
    policyVersion: 'chf-cash-5-rappen-v1' as const,
    originalExactAmountMinor: 335,
    originalDueAmountMinor: 335,
    previouslyRefundedExactMinor: 0,
    previouslyRefundedCashMinor: 0,
    exactRefundAmountMinor: 1,
    refundAdjustmentMinor: -1,
    cashRefundAmountMinor: 0,
    retainedExactAmountMinor: 334,
    retainedCashDueMinor: 335,
  };
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
  const result = {
    ...resolutionResultFixture(),
    state: 'Processing' as const,
    resolvedAt: null,
    creditMinor: 1_000,
    refundMinor: 1,
    unpaidWaivedMinor: 999,
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        custody: 'ManualTill' as const,
        state: 'Pending' as const,
        amountMinor: 1,
        resolvedAt: null,
        tillConfirmation: null,
        cashRefund,
      },
    ],
  };
  get.mockResolvedValueOnce({ success: true, data: { outcome: 'accepted', result } });
  await expect(lookupAmendmentResolution(pending)).resolves.toMatchObject({
    outcome: 'accepted',
    result: { refundLegs: [{ amountMinor: 1, cashRefund }] },
  });

  get.mockResolvedValueOnce({
    success: true,
    data: {
      outcome: 'accepted',
      result: {
        ...result,
        refundLegs: [{ ...result.refundLegs[0], cashRefund: { ...cashRefund, retainedExactAmountMinor: 335 } }],
      },
    },
  });
  await expect(lookupAmendmentResolution(pending)).rejects.toThrow('EvidenceMismatch');
  expect(post).not.toHaveBeenCalled();
});

it('rejects a foreign result before any consumer can retire its original money request', async () => {
  get.mockResolvedValue({
    success: true,
    data: { outcome: 'accepted', result: { ...resolutionResultFixture(), sourceOrderId: resolutionIds.other } },
  });
  await expect(lookupAmendmentResolution(pendingResolutionFixture())).rejects.toThrow('EvidenceMismatch');
});

it('accepts only a refused outcome bound to the original actor and exact client request', async () => {
  const original = pendingResolutionFixture();
  get.mockResolvedValue({
    success: true,
    data: { outcome: 'refused', refusal: resolutionRefusalFixture(original) },
  });
  await expect(lookupAmendmentResolution(original)).resolves.toMatchObject({
    outcome: 'refused',
    refusal: { actorUserId: original.actorId, clientOperationId: original.request.quote.clientOperationId },
  });
});

it('does not treat a failed envelope as proof of a resolved refund', async () => {
  get.mockResolvedValue({ success: false, data: resolutionResultFixture() });
  await expect(lookupAmendmentResolution(pendingResolutionFixture())).rejects.toThrow('Unavailable');
});

it('retries the exact original Start payload if its response was lost', async () => {
  const original = pendingResolutionFixture();
  post.mockResolvedValue({ success: true, data: { outcome: 'accepted', result: resolutionResultFixture() } });
  await recoverAmendmentResolution(original);
  expect(post).toHaveBeenCalledWith(expect.stringContaining('/financial-resolution'), original.request, {
    requireAuth: true,
    signOutOn401: false,
  });
});

it('uses only a verified saved server operation identity for explicit provider recovery', async () => {
  const original = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  post.mockResolvedValue({ success: true, data: resolutionResultFixture() });
  await expect(recoverAmendmentResolution(original)).resolves.toMatchObject({
    outcome: 'accepted',
    result: { operationId: resolutionIds.operation },
  });
  expect(post).toHaveBeenCalledWith(
    `/api/staff/amendment-financial-resolution-operations/${resolutionIds.operation}/recover`,
    {},
    { requireAuth: true, signOutOn401: false },
  );
});

it('posts only the exact persisted till reference and validates its result proof', async () => {
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
  post.mockResolvedValue({ success: true, data: result });
  await expect(
    confirmAmendmentResolutionTill(pending, { paymentId: resolutionIds.payment, tillReference: ' Till-27 ' }),
  ).resolves.toMatchObject({ refundLegs: [{ tillConfirmation: { tillReference: 'Till-27' } }] });
  expect(post).toHaveBeenCalledWith(
    `/api/staff/amendment-financial-resolution-operations/${resolutionIds.operation}/confirm-till`,
    { paymentId: resolutionIds.payment, tillReference: 'Till-27' },
    { requireAuth: true, signOutOn401: false },
  );
});

it('posts only the frozen physical cash amount including zero and rejects altered server terms', async () => {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  const cashRefund = {
    policyVersion: 'chf-cash-5-rappen-v1' as const,
    originalExactAmountMinor: 335,
    originalDueAmountMinor: 335,
    previouslyRefundedExactMinor: 0,
    previouslyRefundedCashMinor: 0,
    exactRefundAmountMinor: 1,
    refundAdjustmentMinor: -1,
    cashRefundAmountMinor: 0,
    retainedExactAmountMinor: 334,
    retainedCashDueMinor: 335,
  };
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
  const confirmation = { paymentId: resolutionIds.payment, tillReference: 'Till-zero', cashReturnedMinor: 0 };
  pending.pendingTillConfirmations = [confirmation];
  await expect(confirmAmendmentResolutionTill(pending, { ...confirmation, cashReturnedMinor: 1 })).rejects.toThrow(
    'TillEvidenceMismatch',
  );
  await expect(
    confirmAmendmentResolutionTill(pending, {
      paymentId: confirmation.paymentId,
      tillReference: confirmation.tillReference,
    }),
  ).rejects.toThrow('TillEvidenceMismatch');
  expect(post).not.toHaveBeenCalled();

  const confirmedAt = '2026-10-03T16:00:30Z';
  const result = {
    ...resolutionResultFixture(),
    state: 'Processing' as const,
    resolvedAt: null,
    creditMinor: 1_000,
    refundMinor: 1,
    unpaidWaivedMinor: 999,
    refundLegs: [
      {
        paymentId: resolutionIds.payment,
        custody: 'ManualTill' as const,
        state: 'Succeeded' as const,
        amountMinor: 1,
        resolvedAt: confirmedAt,
        tillConfirmation: { tillReference: 'Till-zero', confirmedAt },
        cashRefund,
        cashReturn: { exactRefundAmountMinor: 1, refundAdjustmentMinor: -1, cashReturnedMinor: 0, confirmedAt },
      },
    ],
  };
  post.mockResolvedValueOnce({
    success: true,
    data: {
      ...result,
      refundLegs: [
        { ...result.refundLegs[0], cashReturn: { ...result.refundLegs[0].cashReturn, cashReturnedMinor: 1 } },
      ],
    },
  });
  await expect(confirmAmendmentResolutionTill(pending, confirmation)).rejects.toThrow('EvidenceMismatch');
  expect(post).toHaveBeenCalledWith(
    `/api/staff/amendment-financial-resolution-operations/${resolutionIds.operation}/confirm-till`,
    confirmation,
    { requireAuth: true, signOutOn401: false },
  );

  post.mockResolvedValueOnce({ success: true, data: result });
  await expect(confirmAmendmentResolutionTill(pending, confirmation)).resolves.toMatchObject({
    refundLegs: [{ cashReturn: { cashReturnedMinor: 0 } }],
  });
});

it('refuses an unjournaled or changed till reference before sending a physical-refund request', async () => {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  await expect(
    confirmAmendmentResolutionTill(pending, { paymentId: resolutionIds.payment, tillReference: 'Till-27' }),
  ).rejects.toThrow('TillEvidenceUnavailable');
  pending.reviewedQuote.refundLegs[0] = {
    ...pending.reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
  };
  pending.pendingTillConfirmations = [{ paymentId: resolutionIds.payment, tillReference: 'Original-27' }];
  await expect(
    confirmAmendmentResolutionTill(pending, { paymentId: resolutionIds.payment, tillReference: 'Changed-27' }),
  ).rejects.toThrow('TillEvidenceMismatch');
  expect(post).not.toHaveBeenCalled();
});

it('does not send a mismatched frozen Start request', async () => {
  const original = pendingResolutionFixture();
  original.request.quote.currency = 'EUR';
  await expect(startAmendmentResolution(original)).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});

it('validates the quote operation and financial conservation before review', async () => {
  const original = pendingResolutionFixture();
  post.mockResolvedValue({ success: true, data: { ...original.reviewedQuote, unpaidWaivedMinor: 601 } });
  await expect(
    quoteAmendmentResolution(original.orderId, original.amendmentId, original.request.quote),
  ).rejects.toThrow();
});
