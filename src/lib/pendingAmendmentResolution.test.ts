import {
  clearPendingAmendmentResolution,
  clearPendingTillConfirmations,
  persistPendingAmendmentResolution,
  persistPendingTillConfirmations,
  readPendingAmendmentResolution,
  readPendingAmendmentResolutionsForOrder,
} from './pendingAmendmentResolution';
import { resolutionTillConfirmationsSchema } from '@/schemas/amendmentResolution.schema';
import {
  cashRefundFixture,
  cashReturnConfirmedResultFixture,
  cashReturnPendingFixture,
  legacyTillCashPendingFixture,
  zeroCashReturnConfirmationFixture,
} from './__fixtures__/amendmentResolutionCash';
import { pendingResolutionFixture, resolutionIds, resolutionResultFixture } from './__fixtures__/amendmentResolution';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());

it('preserves a lost Start request and only attaches its verified operation identity', () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId)).toEqual({
    status: 'pending',
    value: original,
  });
  const bound = { ...original, operationId: resolutionIds.operation };
  expect(persistPendingAmendmentResolution(bound)).toBe(true);
  expect(persistPendingAmendmentResolution({ ...bound, operationId: resolutionIds.other })).toBe(false);
  expect(clearPendingAmendmentResolution(original)).toBe(false);
  expect(clearPendingAmendmentResolution(bound)).toBe(true);
});

it('prevents replacing a pending original by a new key or modified monetary review', () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  const changed = pendingResolutionFixture();
  changed.request.quote.clientOperationId = resolutionIds.other;
  changed.reviewedQuote.clientOperationId = resolutionIds.other;
  expect(persistPendingAmendmentResolution(changed)).toBe(false);
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId)).toMatchObject({
    value: original,
  });
});

it('isolates another staff actor and amendment on the same browser', () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  expect(readPendingAmendmentResolution(resolutionIds.other, original.orderId, original.amendmentId)).toEqual({
    status: 'none',
  });
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, resolutionIds.other)).toEqual({
    status: 'none',
  });
});

it('inventories only exact actor and order journals for the order recovery host', () => {
  const original = pendingResolutionFixture();
  const secondAmendment = pendingResolutionFixture();
  secondAmendment.amendmentId = resolutionIds.other;
  secondAmendment.reviewedQuote.amendmentId = resolutionIds.other;
  secondAmendment.request.quote.clientOperationId = resolutionIds.item;
  secondAmendment.reviewedQuote.clientOperationId = resolutionIds.item;
  const otherActor = { ...pendingResolutionFixture(), actorId: resolutionIds.other };
  const otherOrder = { ...pendingResolutionFixture(), orderId: resolutionIds.other };
  otherOrder.reviewedQuote.orderId = resolutionIds.other;
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  expect(persistPendingAmendmentResolution(secondAmendment)).toBe(true);
  expect(persistPendingAmendmentResolution(otherActor)).toBe(true);
  expect(persistPendingAmendmentResolution(otherOrder)).toBe(true);
  const getItem = jest.spyOn(Storage.prototype, 'getItem');
  expect(readPendingAmendmentResolutionsForOrder(original.actorId, original.orderId)).toEqual({
    status: 'pending',
    values: [original, secondAmendment],
  });
  expect(getItem.mock.calls).toEqual([
    [`sofra.amendment-resolution.${original.actorId}.${original.orderId}.${original.amendmentId}`],
    [`sofra.amendment-resolution.${secondAmendment.actorId}.${secondAmendment.orderId}.${secondAmendment.amendmentId}`],
  ]);
});

it('reports an empty exact order inventory without reading other actors records', () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution({ ...original, actorId: resolutionIds.other })).toBe(true);
  const getItem = jest.spyOn(Storage.prototype, 'getItem');
  expect(readPendingAmendmentResolutionsForOrder(original.actorId, original.orderId)).toEqual({ status: 'none' });
  expect(getItem).not.toHaveBeenCalled();
});

it.each(['{broken', JSON.stringify({ ...pendingResolutionFixture(), amendmentId: resolutionIds.other })])(
  'fails the whole matching order inventory closed for malformed records',
  (raw) => {
    const original = pendingResolutionFixture();
    const storageKey = `sofra.amendment-resolution.${original.actorId}.${original.orderId}.${original.amendmentId}`;
    window.sessionStorage.setItem(storageKey, raw);
    expect(readPendingAmendmentResolutionsForOrder(original.actorId, original.orderId)).toEqual({
      status: 'unavailable',
    });
  },
);

it('fails the order inventory closed when storage enumeration is inaccessible', () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(readPendingAmendmentResolutionsForOrder(original.actorId, original.orderId)).toEqual({
    status: 'unavailable',
  });
});

it('keeps malformed storage unavailable instead of overwriting an unknown refund', () => {
  const original = pendingResolutionFixture();
  const storageKey = `sofra.amendment-resolution.${original.actorId}.${original.orderId}.${original.amendmentId}`;
  window.sessionStorage.setItem(storageKey, '{broken');
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId)).toEqual({
    status: 'unavailable',
  });
  expect(persistPendingAmendmentResolution(original)).toBe(false);
  expect(window.sessionStorage.getItem(storageKey)).toBe('{broken');
});

it('returns a blocking failure when storage cannot persist or clear the original request', () => {
  const original = pendingResolutionFixture();
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(persistPendingAmendmentResolution(original)).toBe(false);
  write.mockRestore();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(clearPendingAmendmentResolution(original)).toBe(false);
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId).status).toBe(
    'pending',
  );
});

it('freezes the whole manual confirmation batch and clears it only after exact server proof', () => {
  const original = legacyTillCashPendingFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  const confirmations = [{ paymentId: resolutionIds.payment, tillReference: 'Till-27' }];
  expect(persistPendingTillConfirmations(original, confirmations)).toBe(true);
  expect(persistPendingTillConfirmations(original, [{ ...confirmations[0], tillReference: 'Other-27' }])).toBe(false);
  const saved = readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId);
  expect(saved.status).toBe('pending');
  if (saved.status !== 'pending') throw new Error('Expected a frozen confirmation journal');
  expect(saved.value.pendingTillConfirmations).toEqual(confirmations);

  const result = resolutionResultFixture();
  const resultLeg = result.refundLegs[0];
  result.refundLegs[0] = {
    ...resultLeg,
    custody: 'ManualTill',
    tillConfirmation: { tillReference: 'Till-27', confirmedAt: '2026-10-03T16:00:30Z' },
  };
  const wrongProof = {
    ...result,
    refundLegs: [
      {
        ...result.refundLegs[0],
        tillConfirmation: { tillReference: 'Other-27', confirmedAt: '2026-10-03T16:00:30Z' },
      },
    ],
  };
  expect(clearPendingTillConfirmations(saved.value, wrongProof)).toBe(false);
  expect(clearPendingTillConfirmations(saved.value, result)).toBe(true);
  const after = readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId);
  expect(after.status).toBe('pending');
  if (after.status !== 'pending') throw new Error('Expected the operation journal to remain for provider recovery');
  expect(after.value.operationId).toBe(resolutionIds.operation);
  expect(after.value.pendingTillConfirmations).toBeUndefined();
});

it('keeps receipt-backed cash evidence frozen through wrong or changed return readbacks', () => {
  const original = cashReturnPendingFixture();
  const cashRefund = cashRefundFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  const confirmations = [zeroCashReturnConfirmationFixture()];
  expect(persistPendingTillConfirmations(original, confirmations)).toBe(true);
  const saved = readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId);
  expect(saved.status).toBe('pending');
  if (saved.status !== 'pending') throw new Error('Expected the cash-return journal to remain pending');

  const result = cashReturnConfirmedResultFixture();
  const wrongReturn = {
    ...result,
    refundLegs: [{ ...result.refundLegs[0], cashReturn: { ...result.refundLegs[0].cashReturn, cashReturnedMinor: 1 } }],
  };
  expect(clearPendingTillConfirmations(saved.value, wrongReturn)).toBe(false);
  const changedTerms = {
    ...result,
    refundLegs: [{ ...result.refundLegs[0], cashRefund: { ...cashRefund, retainedCashDueMinor: 330 } }],
  };
  expect(clearPendingTillConfirmations(saved.value, changedTerms)).toBe(false);
  expect(readPendingAmendmentResolution(original.actorId, original.orderId, original.amendmentId)).toMatchObject({
    status: 'pending',
    value: { pendingTillConfirmations: confirmations },
  });
  expect(clearPendingTillConfirmations(saved.value, result)).toBe(true);
});

it('normalizes phase-two till references with the reusable evidence schema', () => {
  expect(
    resolutionTillConfirmationsSchema.parse([{ paymentId: resolutionIds.payment, tillReference: ' Till-refund-27 ' }]),
  ).toEqual([{ paymentId: resolutionIds.payment, tillReference: 'Till-refund-27' }]);
});

it.each(['Till refund 27', 'é-27', 'T'.repeat(81), ''])('rejects unsupported till reference %j', (reference) => {
  expect(() =>
    resolutionTillConfirmationsSchema.parse([{ paymentId: resolutionIds.payment, tillReference: reference }]),
  ).toThrow();
});
