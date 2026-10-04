import { act, renderHook, waitFor } from '@testing-library/react';
import { useAmendmentResolution } from './useAmendmentResolution';
import {
  pendingResolutionFixture,
  resolutionRefusalFixture,
  resolutionResultFixture,
} from '@/lib/__fixtures__/amendmentResolution';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import * as service from '@/services/amendmentResolutionService';

jest.mock('@/services/amendmentResolutionService');
const quote = jest.mocked(service.quoteAmendmentResolution);
const start = jest.mocked(service.startAmendmentResolution);
const lookup = jest.mocked(service.lookupAmendmentResolution);
const recover = jest.mocked(service.recoverAmendmentResolution);
const confirmTill = jest.mocked(service.confirmAmendmentResolutionTill);

function input(enabled = true) {
  const original = pendingResolutionFixture();
  return {
    actorId: original.actorId,
    orderId: original.orderId,
    amendmentId: original.amendmentId,
    enabled,
    refresh: jest.fn(async () => undefined),
  };
}

function request() {
  const { clientOperationId: _client, ...values } = pendingResolutionFixture().request.quote;
  return values;
}

function processing() {
  const result = resolutionResultFixture();
  result.state = 'Processing';
  result.resolvedAt = null;
  result.refundLegs[0] = { ...result.refundLegs[0], state: 'Pending', resolvedAt: null };
  return result;
}

function accepted(result = resolutionResultFixture()) {
  return { outcome: 'accepted' as const, result };
}

beforeEach(() => {
  window.sessionStorage.clear();
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-03T15:59:00Z'));
  quote.mockImplementation(async (_orderId, _amendmentId, original) => ({
    ...pendingResolutionFixture().reviewedQuote,
    clientOperationId: original.clientOperationId,
  }));
});
afterEach(() => jest.restoreAllMocks());

it('requests a fresh review before journaling or sending an already expired quote', async () => {
  const props = input();
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => result.current.review(request()));
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-03T16:00:01Z'));
  await act(async () => result.current.settle());
  expect(result.current.stage).toBe('reviewFailed');
  expect(start).not.toHaveBeenCalled();
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('none');
});

it('reads the original client key before any provider retry after remount with writes disabled', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  lookup.mockResolvedValue(accepted(processing()));
  recover.mockResolvedValue(accepted(processing()));
  const props = input(false);
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('pending'));
  expect(lookup).toHaveBeenCalledWith(original);
  expect(start).not.toHaveBeenCalled();
  await act(async () => result.current.refreshRefused());
  expect(result.current.stage).toBe('pending');
  expect(props.refresh).not.toHaveBeenCalled();
  await act(async () => result.current.review(request()));
  expect(quote).not.toHaveBeenCalled();
  await act(async () => result.current.retry());
  expect(recover).toHaveBeenCalledWith(
    expect.objectContaining({
      request: original.request,
      operationId: resolutionResultFixture().operationId,
    }),
  );
});

it('persists the reviewed request before Start and never replaces it after a lost response', async () => {
  const props = input();
  start.mockImplementation(async (original) => {
    expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId)).toEqual({
      status: 'pending',
      value: original,
    });
    throw new Error('response lost');
  });
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => result.current.review(request()));
  await act(async () => result.current.settle());
  expect(result.current.stage).toBe('pending');
  const saved = readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId);
  expect(saved.status).toBe('pending');
  await act(async () => result.current.review(request()));
  expect(quote).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  lookup.mockRejectedValue(new Error('not found'));
  await act(async () => result.current.check());
  expect(result.current.stage).toBe('pending');
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('pending');
});

it('starts a manual till refund before evidence and exposes its frozen quote for phase two', async () => {
  const props = input();
  const reviewedQuote = pendingResolutionFixture().reviewedQuote;
  reviewedQuote.refundLegs[0] = {
    ...reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
    scopes: [],
  };
  quote.mockImplementation(async (_orderId, _amendmentId, original) => ({
    ...reviewedQuote,
    clientOperationId: original.clientOperationId,
  }));
  const pendingResult = processing();
  pendingResult.refundLegs[0] = { ...pendingResult.refundLegs[0], custody: 'ManualTill' };
  start.mockImplementation(async (original) => {
    expect(original.request).not.toHaveProperty('tillConfirmations');
    expect(original.request.quote.manualRefunds).toEqual([
      { paymentId: reviewedQuote.refundLegs[0].paymentId, amountMinor: 400 },
    ]);
    return accepted(pendingResult);
  });
  const manualRequest = {
    ...request(),
    manualRefunds: [{ paymentId: reviewedQuote.refundLegs[0].paymentId, amountMinor: 400 }],
  };
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => result.current.review(manualRequest));
  await act(async () => result.current.settle());
  expect(result.current.stage).toBe('pending');
  expect(result.current.reviewedQuote?.refundLegs[0]).toMatchObject({
    custody: 'ManualTill',
    paymentMethod: 'Cash',
    amountMinor: 400,
  });
  const saved = readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId);
  expect(saved.status).toBe('pending');
  if (saved.status !== 'pending') throw new Error('Expected the phase-two journal to remain pending');
  expect(saved.value.request).not.toHaveProperty('tillConfirmations');
});

it('replays the frozen till batch after a lost confirmation response without re-entry', async () => {
  const props = input(true);
  const reviewedQuote = pendingResolutionFixture().reviewedQuote;
  reviewedQuote.refundLegs[0] = {
    ...reviewedQuote.refundLegs[0],
    paymentMethod: 'Cash',
    custody: 'ManualTill',
    requiresTillConfirmation: true,
    scopes: [],
  };
  quote.mockImplementation(async (_orderId, _amendmentId, original) => ({
    ...reviewedQuote,
    clientOperationId: original.clientOperationId,
  }));
  const pendingResult = processing();
  pendingResult.refundLegs[0] = {
    ...pendingResult.refundLegs[0],
    custody: 'ManualTill',
    tillConfirmation: null,
  };
  let clientOperationId = '';
  start.mockImplementation(async (original) => {
    clientOperationId = original.request.quote.clientOperationId;
    return accepted({ ...pendingResult, clientOperationId });
  });
  const confirmation = { paymentId: reviewedQuote.refundLegs[0].paymentId, tillReference: 'Till-27' };
  confirmTill.mockRejectedValueOnce(new Error('confirmation response lost'));
  const resolved = resolutionResultFixture();
  resolved.refundLegs[0] = {
    ...resolved.refundLegs[0],
    custody: 'ManualTill',
    tillConfirmation: { tillReference: 'Till-27', confirmedAt: '2026-10-03T16:00:30Z' },
  };
  confirmTill.mockImplementationOnce(async () => {
    resolved.clientOperationId = clientOperationId;
    return resolved;
  });

  const { result, rerender } = renderHook(({ enabled }) => useAmendmentResolution({ ...props, enabled }), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () =>
    result.current.review({
      ...request(),
      manualRefunds: [{ paymentId: reviewedQuote.refundLegs[0].paymentId, amountMinor: 400 }],
    }),
  );
  await act(async () => result.current.settle());
  rerender({ enabled: false });
  await act(async () => result.current.confirmTill([confirmation]));

  expect(result.current.stage).toBe('pending');
  expect(result.current.hasPendingTillConfirmation).toBe(true);
  const saved = readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId);
  expect(saved.status).toBe('pending');
  if (saved.status !== 'pending') throw new Error('Expected a frozen manual confirmation');
  expect(saved.value.pendingTillConfirmations).toEqual([confirmation]);
  await act(async () => result.current.confirmTill([{ ...confirmation, tillReference: 'Changed-27' }]));
  expect(confirmTill).toHaveBeenCalledTimes(1);

  await act(async () => result.current.retryTill());
  expect(confirmTill).toHaveBeenCalledTimes(2);
  expect(confirmTill.mock.calls[1]?.[0].pendingTillConfirmations).toEqual([confirmation]);
  expect(confirmTill.mock.calls[1]?.[1]).toEqual(confirmation);
  expect(result.current.stage).toBe('resolved');
  expect(result.current.hasPendingTillConfirmation).toBe(false);
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('none');
  expect(props.refresh).toHaveBeenCalledTimes(1);
});

it('clears only a validated resolved original and refreshes its account afterwards', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  lookup.mockResolvedValue(accepted());
  const props = input(false);
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('resolved'));
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('none');
  expect(props.refresh).toHaveBeenCalledTimes(1);
});

it('keeps failed provider reconciliation held without refreshing or quoting new money', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  const held = processing();
  held.state = 'ReconciliationRequired';
  held.refundLegs[0].state = 'Failed';
  lookup.mockResolvedValue(accepted(held));
  const props = input();
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('pending'));
  expect(result.current.result?.state).toBe('ReconciliationRequired');
  expect(props.refresh).not.toHaveBeenCalled();
  await act(async () => result.current.review(request()));
  expect(quote).not.toHaveBeenCalled();
});

it('clears only a matched durable refusal, refreshes, and requires explicit fresh review', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  lookup.mockResolvedValue({ outcome: 'refused', refusal: resolutionRefusalFixture(original) });
  const props = input(false);
  const { result, rerender } = renderHook(({ enabled }) => useAmendmentResolution({ ...props, enabled }), {
    initialProps: { enabled: false },
  });
  await waitFor(() => expect(result.current.stage).toBe('refused'));
  expect(result.current.refusal?.failureCode).toBe('sourceVersionConflict');
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('none');
  expect(props.refresh).toHaveBeenCalledTimes(1);
  await act(async () => result.current.review(request()));
  expect(quote).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await act(async () => result.current.review(request()));
  expect(quote).toHaveBeenCalledTimes(1);
  expect(result.current.stage).toBe('review');
});

it('keeps the refusal journal and blocks new review when storage cannot clear it', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  lookup.mockResolvedValue({ outcome: 'refused', refusal: resolutionRefusalFixture(original) });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  const props = input(true);
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('unavailable'));
  expect(result.current.refusal?.failureCode).toBe('sourceVersionConflict');
  expect(result.current.hasPending).toBe(true);
  await act(async () => result.current.review(request()));
  expect(quote).not.toHaveBeenCalled();
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('pending');
});

it('requires an explicit successful context refresh after a durable refusal before fresh review', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  lookup.mockResolvedValue({ outcome: 'refused', refusal: resolutionRefusalFixture(original) });
  const props = input(true);
  props.refresh.mockRejectedValueOnce(new Error('context unavailable')).mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('unavailable'));
  expect(result.current.refusal?.failureCode).toBe('sourceVersionConflict');
  expect(result.current.hasPending).toBe(false);
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId).status).toBe('none');
  await act(async () => result.current.review(request()));
  expect(quote).not.toHaveBeenCalled();

  await act(async () => result.current.refreshRefused());
  expect(result.current.stage).toBe('refused');
  expect(props.refresh).toHaveBeenCalledTimes(2);
  await act(async () => result.current.review(request()));
  expect(quote).toHaveBeenCalledTimes(1);
  expect(result.current.stage).toBe('review');
});

it('does not send money when the browser cannot preserve the original request', async () => {
  const { result } = renderHook(() => useAmendmentResolution(input()));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => result.current.review(request()));
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  await act(async () => result.current.settle());
  expect(result.current.stage).toBe('unavailable');
  expect(start).not.toHaveBeenCalled();
});

it('retains a lost response descriptor when saving its returned identity fails', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  lookup.mockResolvedValue(accepted());
  const props = input(false);
  const { result } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(result.current.stage).toBe('unavailable'));
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId)).toEqual({
    status: 'pending',
    value: original,
  });
  expect(props.refresh).not.toHaveBeenCalled();
});

it('ignores an unmounted response and leaves the original journal recoverable', async () => {
  const original = pendingResolutionFixture();
  expect(persistPendingAmendmentResolution(original)).toBe(true);
  let resolve: ((value: ReturnType<typeof accepted>) => void) | undefined;
  lookup.mockReturnValue(
    new Promise<ReturnType<typeof accepted>>((done) => {
      resolve = done;
    }),
  );
  const props = input();
  const { unmount } = renderHook(() => useAmendmentResolution(props));
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
  unmount();
  await act(async () => resolve?.(accepted()));
  expect(readPendingAmendmentResolution(props.actorId, props.orderId, props.amendmentId)).toEqual({
    status: 'pending',
    value: original,
  });
  expect(props.refresh).not.toHaveBeenCalled();
});
