import { act, renderHook, waitFor } from '@testing-library/react';
import { useChannelDecision } from './useChannelDecision';
import { getChannelDecision, queueChannelDecision } from '@/services/channelDecisionService';
import { ApiError } from '@/utils/apiClient';
import type { ChannelDecisionDto } from '@/types/order/channelDecision';

jest.mock('@/services/channelDecisionService');
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const pending: ChannelDecisionDto = {
  orderId: id,
  operationId,
  action: 'accept',
  state: 'Pending',
  createdAt: '2026-10-01T20:00:00Z',
  lastObservedAt: null,
};
const request = { action: 'accept' as const, reason: 'Items and instructions checked', expectedVersion: 7 };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getChannelDecision).mockResolvedValue(null);
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(operationId);
});
afterEach(() => jest.restoreAllMocks());

it('keeps a queued request pending and never announces provider success early', async () => {
  jest.mocked(queueChannelDecision).mockResolvedValue(pending);
  const changed = jest.fn();
  const { result } = renderHook(() => useChannelDecision(id, true, changed));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.submit(request);
  });
  expect(result.current.decision?.state).toBe('Pending');
  expect(changed).not.toHaveBeenCalled();
});
it('retries the identical request after a lost response, even when a caller changes its draft', async () => {
  jest
    .mocked(queueChannelDecision)
    .mockRejectedValueOnce(new TypeError('connection lost'))
    .mockResolvedValueOnce(pending);
  const { result } = renderHook(() => useChannelDecision(id, true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.submit(request);
  });
  expect(result.current.uncertain).toBe(true);
  await act(async () => {
    await result.current.submit({ action: 'deny', reason: 'Changed', expectedVersion: 99 });
  });
  const calls = jest.mocked(queueChannelDecision).mock.calls;
  expect(calls[0][1]).toEqual({ ...request, operationId });
  expect(calls[1][1]).toEqual(calls[0][1]);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
});
it('discards a definitive stale-version refusal so a refreshed request can be made', async () => {
  jest.mocked(queueChannelDecision).mockRejectedValueOnce(new ApiError(409, '')).mockResolvedValueOnce(pending);
  const { result } = renderHook(() => useChannelDecision(id, true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.submit(request);
  });
  expect(result.current.uncertain).toBe(false);
  await act(async () => {
    await result.current.submit({ ...request, expectedVersion: 8 });
  });
  expect(jest.mocked(queueChannelDecision).mock.calls[1][1].expectedVersion).toBe(8);
});
it('does not let a delayed lookup replace a newly queued decision', async () => {
  const read = deferred<ChannelDecisionDto | null>();
  jest.mocked(getChannelDecision).mockReturnValue(read.promise);
  jest.mocked(queueChannelDecision).mockResolvedValue(pending);
  const { result } = renderHook(() => useChannelDecision(id, true));
  await act(async () => {
    await result.current.submit(request);
  });
  await act(async () => {
    read.resolve(null);
  });
  expect(result.current.decision).toEqual(pending);
});
it('does not show an old order response after switching tickets', async () => {
  const read = deferred<ChannelDecisionDto | null>();
  jest.mocked(getChannelDecision).mockReturnValueOnce(read.promise).mockResolvedValue(null);
  const { result, rerender } = renderHook(({ orderId }) => useChannelDecision(orderId, true), {
    initialProps: { orderId: id },
  });
  rerender({ orderId: other });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    read.resolve(pending);
  });
  expect(result.current.orderId).toBe(other);
  expect(result.current.decision).toBeNull();
});
it('refreshes the host only once for a confirmed operation', async () => {
  jest.mocked(getChannelDecision).mockResolvedValue({ ...pending, state: 'Succeeded' });
  const changed = jest.fn();
  const { result } = renderHook(() => useChannelDecision(id, true, changed));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(changed).toHaveBeenCalledTimes(2);
});
it('makes no lookup for an ordinary order', () => {
  renderHook(() => useChannelDecision(id, false));
  expect(getChannelDecision).not.toHaveBeenCalled();
});
