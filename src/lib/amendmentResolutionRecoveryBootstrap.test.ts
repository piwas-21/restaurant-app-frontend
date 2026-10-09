import { readPendingAmendmentResolution, persistPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import { restoreAmendmentResolutionRecovery } from './amendmentResolutionRecoveryBootstrap';
import { pendingResolutionFixture, resolutionIds, resolutionResultFixture } from './__fixtures__/amendmentResolution';
import type { AmendmentResolutionRecovery } from '@/services/amendmentResolutionRecoveryService';

beforeEach(() => window.sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());

function acceptedRecovery(): AmendmentResolutionRecovery {
  return {
    pending: { ...pendingResolutionFixture(), operationId: resolutionIds.operation },
    result: resolutionResultFixture(),
  };
}

function manualPendingRecovery(): AmendmentResolutionRecovery {
  const recovery = acceptedRecovery();
  recovery.pending.reviewedQuote.refundLegs[0] = {
    ...recovery.pending.reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
  };
  recovery.result.state = 'Processing';
  recovery.result.resolvedAt = null;
  recovery.result.refundLegs[0] = {
    ...recovery.result.refundLegs[0],
    custody: 'ManualTill',
    state: 'Pending',
    resolvedAt: null,
    tillConfirmation: null,
  };
  return recovery;
}

it('persists a validated accepted server operation before returning it for recovery', () => {
  const recovery = acceptedRecovery();

  expect(restoreAmendmentResolutionRecovery(recovery)).toEqual({
    status: 'pending',
    value: recovery.pending,
    result: recovery.result,
  });
  expect(
    readPendingAmendmentResolution(recovery.pending.actorId, recovery.pending.orderId, recovery.pending.amendmentId),
  ).toEqual({ status: 'pending', value: recovery.pending });
});

it('binds the accepted operation id to the matching local Start request', () => {
  const recovery = acceptedRecovery();
  const local = { ...recovery.pending, operationId: null };
  expect(persistPendingAmendmentResolution(local)).toBe(true);

  const restored = restoreAmendmentResolutionRecovery(recovery);

  expect(restored.status).toBe('pending');
  expect(restored.status === 'pending' && restored.value.operationId).toBe(resolutionIds.operation);
});

it('preserves the exact local till batch while restoring server operation and result', () => {
  const recovery = manualPendingRecovery();
  const local = {
    ...recovery.pending,
    pendingTillConfirmations: [{ paymentId: resolutionIds.payment, tillReference: 'Till-27' }],
  };
  expect(persistPendingAmendmentResolution(local)).toBe(true);

  const restored = restoreAmendmentResolutionRecovery(recovery);

  expect(restored.status).toBe('pending');
  if (restored.status !== 'pending') return;
  expect(restored.value.pendingTillConfirmations).toEqual(local.pendingTillConfirmations);
  expect(readPendingAmendmentResolution(local.actorId, local.orderId, local.amendmentId)).toMatchObject({
    status: 'pending',
    value: { pendingTillConfirmations: local.pendingTillConfirmations },
  });
});

it('holds a local journal whose request differs from the server-owned accepted request', () => {
  const recovery = acceptedRecovery();
  const local = pendingResolutionFixture();
  local.request.quote.expectedOrderVersion += 1;
  expect(persistPendingAmendmentResolution(local)).toBe(true);

  expect(restoreAmendmentResolutionRecovery(recovery)).toEqual({ status: 'unavailable' });
  expect(readPendingAmendmentResolution(local.actorId, local.orderId, local.amendmentId)).toEqual({
    status: 'pending',
    value: local,
  });
});

it('does not rebind an already accepted local journal to a different server operation', () => {
  const recovery = acceptedRecovery();
  const local = { ...recovery.pending, operationId: resolutionIds.other };
  expect(persistPendingAmendmentResolution(local)).toBe(true);

  expect(restoreAmendmentResolutionRecovery(recovery)).toEqual({ status: 'unavailable' });
  expect(readPendingAmendmentResolution(local.actorId, local.orderId, local.amendmentId)).toEqual({
    status: 'pending',
    value: local,
  });
});

it('rejects missing operation identity and mismatched result without writing a journal', () => {
  const recovery = acceptedRecovery();
  expect(
    restoreAmendmentResolutionRecovery({
      ...recovery,
      pending: { ...recovery.pending, operationId: null },
    }),
  ).toEqual({ status: 'unavailable' });
  expect(
    restoreAmendmentResolutionRecovery({
      ...recovery,
      result: { ...recovery.result, operationId: resolutionIds.other },
    }),
  ).toEqual({ status: 'unavailable' });
  expect(
    readPendingAmendmentResolution(recovery.pending.actorId, recovery.pending.orderId, recovery.pending.amendmentId),
  ).toEqual({ status: 'none' });
});

it('keeps an existing till batch when fresh server proof conflicts with its reference', () => {
  const recovery = manualPendingRecovery();
  const local = {
    ...recovery.pending,
    pendingTillConfirmations: [{ paymentId: resolutionIds.payment, tillReference: 'Till-27' }],
  };
  expect(persistPendingAmendmentResolution(local)).toBe(true);
  recovery.result.state = 'Resolved';
  recovery.result.resolvedAt = '2026-10-03T16:01:00Z';
  recovery.result.refundLegs[0] = {
    ...recovery.result.refundLegs[0],
    state: 'Succeeded',
    resolvedAt: '2026-10-03T16:00:30Z',
    tillConfirmation: { tillReference: 'Different-27', confirmedAt: '2026-10-03T16:00:30Z' },
  };

  expect(restoreAmendmentResolutionRecovery(recovery)).toEqual({ status: 'unavailable' });
  expect(readPendingAmendmentResolution(local.actorId, local.orderId, local.amendmentId)).toEqual({
    status: 'pending',
    value: local,
  });
});

it('fails closed when the accepted recovery cannot be durably stored', () => {
  const recovery = acceptedRecovery();
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('unavailable');
  });

  expect(restoreAmendmentResolutionRecovery(recovery)).toEqual({ status: 'unavailable' });
});
