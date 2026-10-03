import { waitFor } from '@testing-library/react';
import { submitTillConfirmationBatch } from './amendmentResolutionTillHandler';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from './pendingAmendmentResolution';
import { pendingResolutionFixture, resolutionIds, resolutionResultFixture } from './__fixtures__/amendmentResolution';
import { confirmAmendmentResolutionTill } from '@/services/amendmentResolutionService';
import type { AmendmentResolutionResult } from '@/types/amendmentResolution';

jest.mock('@/services/amendmentResolutionService');
const confirm = jest.mocked(confirmAmendmentResolutionTill);

function twoManualLegs() {
  const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
  pending.request.quote.manualRefunds = [
    { paymentId: resolutionIds.payment, amountMinor: 400 },
    { paymentId: resolutionIds.other, amountMinor: 400 },
  ];
  pending.reviewedQuote.refundMinor = 800;
  pending.reviewedQuote.unpaidWaivedMinor = 200;
  pending.reviewedQuote.refundLegs = pending.request.quote.manualRefunds.map((value) => ({
    paymentId: value.paymentId,
    amountMinor: value.amountMinor,
    paymentMethod: 'CreditCard',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
    scopes: [],
  }));
  const result = resolutionResultFixture();
  result.state = 'Processing';
  result.resolvedAt = null;
  result.refundMinor = 800;
  result.unpaidWaivedMinor = 200;
  result.refundLegs = pending.reviewedQuote.refundLegs.map((value) => ({
    paymentId: value.paymentId,
    amountMinor: 400,
    custody: 'ManualTill',
    state: 'Pending',
    resolvedAt: null,
    tillConfirmation: null,
  }));
  const confirmations = [
    { paymentId: resolutionIds.payment, tillReference: 'Till-first' },
    { paymentId: resolutionIds.other, tillReference: 'Till-second' },
  ];
  expect(persistPendingAmendmentResolution(pending)).toBe(true);
  return { pending, result, confirmations };
}

beforeEach(() => {
  window.sessionStorage.clear();
  jest.resetAllMocks();
});

it('waits for the first till response and preserves the complete exact batch after the second response is lost', async () => {
  const { pending, result, confirmations } = twoManualLegs();
  let releaseFirst: (value: AmendmentResolutionResult) => void = () => {
    throw new Error('The controlled first response was not initialized');
  };
  const firstResponse = new Promise<AmendmentResolutionResult>((resolve) => {
    releaseFirst = resolve;
  });
  confirm.mockReturnValueOnce(firstResponse).mockRejectedValueOnce(new Error('Second response lost'));
  const submitting = submitTillConfirmationBatch(pending, result, confirmations);
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(confirm.mock.calls[0]?.[1]).toEqual(confirmations[0]);
  const saved = readPendingAmendmentResolution(pending.actorId, pending.orderId, pending.amendmentId);
  expect(saved).toMatchObject({ status: 'pending', value: { pendingTillConfirmations: confirmations } });
  await Promise.resolve();
  expect(confirm).toHaveBeenCalledTimes(1);

  const firstProven: AmendmentResolutionResult = {
    ...result,
    refundLegs: [
      {
        ...result.refundLegs[0],
        state: 'Succeeded',
        resolvedAt: '2026-10-03T16:00:30Z',
        tillConfirmation: { tillReference: 'Till-first', confirmedAt: '2026-10-03T16:00:30Z' },
      },
      result.refundLegs[1],
    ],
  };
  releaseFirst(firstProven);
  const outcome = await submitting;
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(confirm.mock.calls[1]?.[1]).toEqual(confirmations[1]);
  expect(outcome?.result).toEqual(firstProven);
  expect(outcome?.pending.pendingTillConfirmations).toEqual(confirmations);
  expect(readPendingAmendmentResolution(pending.actorId, pending.orderId, pending.amendmentId)).toEqual(saved);
});

it('does not post the second confirmation when the first response is unknown', async () => {
  const { pending, result, confirmations } = twoManualLegs();
  confirm.mockRejectedValueOnce(new Error('First response lost'));
  const outcome = await submitTillConfirmationBatch(pending, result, confirmations);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(outcome?.result).toEqual(result);
  expect(outcome?.pending.pendingTillConfirmations).toEqual(confirmations);
  expect(readPendingAmendmentResolution(pending.actorId, pending.orderId, pending.amendmentId)).toMatchObject({
    status: 'pending',
    value: { pendingTillConfirmations: confirmations },
  });
});
