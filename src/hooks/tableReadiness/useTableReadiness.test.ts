import { act, renderHook, waitFor } from '@testing-library/react';
import { useTableReadiness } from './useTableReadiness';
import { lookupTableReadiness, markTableReady } from '@/services/tableReadinessService';
import { persistPendingTableReadiness, readPendingTableReadiness } from '@/lib/pendingTableReadiness';
import type { PendingTableReadiness } from '@/types/tableReadiness';

jest.mock('@/services/tableReadinessService', () => ({ lookupTableReadiness: jest.fn(), markTableReady: jest.fn() }));
const lookup = jest.mocked(lookupTableReadiness);
const mark = jest.mocked(markTableReady);
const pending: PendingTableReadiness = {
  actorId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'Cashier',
  tableId: '22222222-2222-4222-8222-222222222222',
  request: { operationId: '33333333-3333-4333-8333-333333333333', expectedReadinessVersion: 7 },
};
const read = () => readPendingTableReadiness(pending.actorId, pending.actorRole, pending.tableId);
const refresh = jest.fn<Promise<void>, []>(() => Promise.resolve());
const input = {
  actorId: pending.actorId,
  actorRole: pending.actorRole,
  tableId: pending.tableId,
  readinessState: 'NeedsReset',
  readinessVersion: 7,
  canStart: true,
  isStale: false,
  refresh,
};
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

it('saves before sending, prevents same-turn double submit and retains a lost response', async () => {
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(pending.request.operationId);
  mark.mockImplementation(async () => {
    expect(read()).toEqual({ status: 'pending', value: pending });
    throw new Error('lost response');
  });
  const { result } = renderHook(() => useTableReadiness(input));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => {
    await Promise.all([result.current.start(), result.current.start()]);
  });
  expect(mark).toHaveBeenCalledTimes(1);
  expect(result.current.stage).toBe('pending');
  expect(read()).toEqual({ status: 'pending', value: pending });
});

it('mounts owner lookup with flags off and never generates another operation', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  lookup.mockResolvedValue({ kind: 'refused', code: 'TableReadinessOperationNotFound', terminal: false });
  mark.mockResolvedValue({ kind: 'refused', code: 'TableReadinessFeatureDisabled', terminal: false });
  const { result } = renderHook(() => useTableReadiness({ ...input, canStart: false, readinessVersion: 99 }));
  await waitFor(() => expect(result.current.stage).toBe('pending'));
  expect(lookup).toHaveBeenCalledWith(pending.tableId, pending.request);
  await act(async () => result.current.start());
  expect(mark).not.toHaveBeenCalled();
  await act(async () => result.current.retry());
  expect(mark).toHaveBeenCalledWith(pending.tableId, pending.request);
  expect(read()).toEqual({ status: 'pending', value: pending });
});

it('clears success only after a fresh same-table ready projection advances the readiness version', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  lookup.mockResolvedValue({
    kind: 'succeeded',
    outcome: {
      tableId: pending.tableId,
      operationId: pending.request.operationId,
      readinessState: 'ReadyForGuests',
      readinessVersion: 8,
    },
  });
  const { result, rerender } = renderHook((props) => useTableReadiness(props), {
    initialProps: { ...input, canStart: false },
  });
  await waitFor(() => expect(result.current.stage).toBe('settled'));
  expect(read()).toEqual({ status: 'none' });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mark).not.toHaveBeenCalled();

  rerender({ ...input, canStart: false, readinessVersion: 7, readinessState: 'ReadyForGuests' });
  expect(result.current.stage).toBe('settled');
  rerender({ ...input, canStart: false, readinessVersion: 8, readinessState: 'ReadyForGuests' });
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  expect(result.current.result).toBeUndefined();
});

it('keeps success visible while the refreshed projection is stale, even if its version advanced', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  lookup.mockResolvedValue({
    kind: 'succeeded',
    outcome: {
      tableId: pending.tableId,
      operationId: pending.request.operationId,
      readinessState: 'ReadyForGuests',
      readinessVersion: 8,
    },
  });
  refresh.mockRejectedValueOnce(new Error('refresh failed'));
  const { result, rerender } = renderHook((props) => useTableReadiness(props), { initialProps: input });
  await waitFor(() => expect(result.current.stage).toBe('settled'));

  rerender({ ...input, canStart: false, readinessVersion: 8, readinessState: 'ReadyForGuests', isStale: true });
  expect(result.current.stage).toBe('settled');
  rerender({ ...input, canStart: false, readinessVersion: 8, readinessState: 'ReadyForGuests', isStale: false });
  await waitFor(() => expect(result.current.stage).toBe('idle'));
});

it('keeps a refusal visible across refresh and requires explicit retry after a fresh snapshot', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  lookup.mockResolvedValue({ kind: 'refused', code: 'TableReadinessVersionStale', terminal: true });
  jest.spyOn(crypto, 'randomUUID').mockReturnValue('44444444-4444-4444-8444-444444444444');
  mark.mockResolvedValue({ kind: 'refused', code: 'TableReadinessVisitOpen', terminal: true });
  const { result, rerender } = renderHook((props) => useTableReadiness(props), { initialProps: input });
  await waitFor(() => expect(result.current.stage).toBe('settled'));
  await act(async () => result.current.start());
  expect(mark).not.toHaveBeenCalled();
  rerender({ ...input, readinessState: 'ReadyForGuests', canStart: false });
  expect(result.current.stage).toBe('settled');
  expect(result.current.canRetryRefusal).toBe(false);
  await act(async () => result.current.start());
  expect(mark).not.toHaveBeenCalled();

  rerender({ ...input, readinessVersion: 8, readinessState: 'NeedsReset' });
  expect(result.current.stage).toBe('settled');
  expect(result.current.canRetryRefusal).toBe(true);
  await act(async () => result.current.start());
  expect(mark).toHaveBeenCalledWith(pending.tableId, {
    operationId: '44444444-4444-4444-8444-444444444444',
    expectedReadinessVersion: 8,
  });
  expect(result.current.stage).toBe('settled');
});

it('blocks writes if storage cannot preserve the operation', async () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const { result } = renderHook(() => useTableReadiness(input));
  await waitFor(() => expect(result.current.stage).toBe('idle'));
  await act(async () => result.current.start());
  expect(result.current.stage).toBe('unavailable');
  expect(mark).not.toHaveBeenCalled();
});

it('does not clear evidence if a lookup resolves after the keyed component unmounts', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  let finish: ((value: Awaited<ReturnType<typeof lookupTableReadiness>>) => void) | undefined;
  lookup.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = renderHook(() => useTableReadiness(input));
  await waitFor(() => expect(result.current.stage).toBe('working'));
  unmount();
  await act(async () => finish?.({ kind: 'refused', code: 'TableReadinessVersionStale', terminal: true }));
  expect(read()).toEqual({ status: 'pending', value: pending });
  expect(refresh).not.toHaveBeenCalled();
});
