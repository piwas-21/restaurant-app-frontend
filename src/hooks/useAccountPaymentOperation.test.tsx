import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccountPaymentOperation } from './useAccountPaymentOperation';
import * as service from '@/services/accountPaymentsService';
import { persistPendingAccountPayment, readPendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { AccountPaymentOperation, CreateAccountPaymentQuoteRequest } from '@/types/accountPayments';

const translate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
jest.mock('@/services/accountPaymentsService', () => ({
  quoteAccountPayment: jest.fn(),
  getAccountPaymentOperation: jest.fn(),
  getAccountEqualSharePlan: jest.fn(),
  createAccountEqualSharePlan: jest.fn(),
  reserveAccountPayment: jest.fn(),
  collectAccountPayment: jest.fn(),
  releaseAccountPayment: jest.fn(),
}));
const api = jest.mocked(service);
const actor = '11111111-1111-4111-8111-111111111111';
const visit = '22222222-2222-4222-8222-222222222222';
const request: CreateAccountPaymentQuoteRequest = {
  operationId: '33333333-3333-4333-8333-333333333333',
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 29,
};
const operation: AccountPaymentOperation = {
  serviceSessionId: visit,
  operationId: request.operationId,
  state: 'Quoted',
  version: 1,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 29,
  currency: 'EUR',
  quoteExpiresAt: '2099-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: null,
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [
    {
      orderId: '55555555-5555-4555-8555-555555555555',
      orderItemId: null,
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 29,
      amountMinor: 29,
    },
  ],
};
const refresh = jest.fn(async () => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('persists the original operation before sending and blocks simultaneous double-click writes', async () => {
  let resolve: (result: AccountPaymentOperation) => void = () => undefined;
  api.quoteAccountPayment.mockImplementation(() => {
    expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { request } });
    return new Promise<AccountPaymentOperation>((complete) => {
      resolve = complete;
    });
  });
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, true, refresh));
  await waitFor(() => expect(result.current.canStart).toBe(true));
  let first: Promise<void> = Promise.resolve();
  act(() => {
    first = result.current.quote(request);
    void result.current.quote({ ...request, operationId: '44444444-4444-4444-8444-444444444444' });
  });
  expect(api.quoteAccountPayment).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(operation);
    await first;
  });
  expect(result.current.pending).toMatchObject({ stage: 'review', request });
});

it('refuses a quote before network I/O when recovery storage cannot be written', async () => {
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, true, refresh));
  await waitFor(() => expect(result.current.canStart).toBe(true));
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  await act(async () => {
    await result.current.quote(request);
  });
  expect(api.quoteAccountPayment).not.toHaveBeenCalled();
  expect(result.current.storageUnavailable).toBe(true);
  expect(result.current.error).toBe('accountPayments.storage_unavailable');
});

it('recovers a lost collection response after remount without creating or releasing another payment', async () => {
  const reserved = { ...operation, state: 'Reserved' as const, version: 2 };
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'reserved',
    request,
    expectedVersion: 2,
  });
  api.getAccountPaymentOperation.mockResolvedValue(reserved);
  api.collectAccountPayment.mockRejectedValue(new Error('response lost'));
  const first = renderHook(() => useAccountPaymentOperation(actor, visit, true, refresh));
  await waitFor(() => expect(first.result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await first.result.current.collect();
  });
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({
    status: 'pending',
    value: { stage: 'collecting', expectedVersion: 2 },
  });
  await act(async () => {
    await first.result.current.release();
  });
  expect(api.releaseAccountPayment).not.toHaveBeenCalled();
  first.unmount();
  api.getAccountPaymentOperation.mockResolvedValue({ ...reserved, state: 'Captured', version: 3 });
  const second = renderHook(() => useAccountPaymentOperation(actor, visit, false, refresh));
  await waitFor(() => expect(second.result.current.operation?.state).toBe('Captured'));
  expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' });
  expect(api.collectAccountPayment).toHaveBeenCalledTimes(1);
  expect(api.collectAccountPayment).toHaveBeenCalledWith(visit, request.operationId, { expectedVersion: 2 });
  expect(api.quoteAccountPayment).not.toHaveBeenCalled();
  expect(second.result.current.canStart).toBe(false);
});

it('permits owner lookup after feature disablement and retains the original collection payload for retry', async () => {
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    request,
    expectedVersion: 2,
  });
  api.getAccountPaymentOperation.mockResolvedValue({ ...operation, state: 'Reserved', version: 3 });
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, false, refresh, true));
  await waitFor(() => expect(result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await result.current.collect();
    await result.current.quote(request);
    await result.current.reserve();
    await result.current.release();
  });
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(api.quoteAccountPayment).not.toHaveBeenCalled();
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.releaseAccountPayment).not.toHaveBeenCalled();
  expect(result.current.pending).toMatchObject({ stage: 'collecting', expectedVersion: 2 });
});

it('replays only the original collecting operation after the account feature is disabled', async () => {
  const reserved = { ...operation, state: 'Reserved' as const, version: 2 };
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    expectedVersion: 2,
    request,
  });
  api.getAccountPaymentOperation.mockResolvedValue(reserved);
  api.collectAccountPayment.mockResolvedValue({ ...reserved, state: 'Captured', version: 3 });
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, false, refresh, true));

  await waitFor(() => expect(result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await result.current.collect();
  });

  expect(api.collectAccountPayment).toHaveBeenCalledTimes(1);
  expect(api.collectAccountPayment).toHaveBeenCalledWith(visit, request.operationId, { expectedVersion: 2 });
  expect(api.quoteAccountPayment).not.toHaveBeenCalled();
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.releaseAccountPayment).not.toHaveBeenCalled();
  expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' });
  expect(result.current.canStart).toBe(false);
});

it('permits same-actor safe release after feature disablement using the looked-up version', async () => {
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'reserved',
    request,
    expectedVersion: 2,
  });
  api.getAccountPaymentOperation.mockResolvedValue({ ...operation, state: 'Reserved', version: 2 });
  api.releaseAccountPayment.mockResolvedValue({ ...operation, state: 'Released', version: 3 });
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, false, refresh));

  await waitFor(() => expect(result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await result.current.release();
  });

  expect(api.releaseAccountPayment).toHaveBeenCalledWith(visit, request.operationId, { expectedVersion: 2 });
  expect(api.quoteAccountPayment).not.toHaveBeenCalled();
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' });
  expect(result.current.operation?.state).toBe('Released');
});

it('does not release an owner operation after status lookup reports provider processing', async () => {
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'releasing',
    expectedVersion: 2,
    request,
  });
  api.getAccountPaymentOperation.mockResolvedValue({ ...operation, state: 'Processing', version: 3 });
  const { result } = renderHook(() => useAccountPaymentOperation(actor, visit, false, refresh));

  await waitFor(() => expect(result.current.operation?.state).toBe('Processing'));
  await act(async () => {
    await result.current.release();
    await result.current.collect();
  });

  expect(api.releaseAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { stage: 'releasing' } });
});

it('does not attach an old actor response to the next actor after authentication changes', async () => {
  let resolve: (result: AccountPaymentOperation) => void = () => undefined;
  api.quoteAccountPayment.mockImplementation(
    () =>
      new Promise<AccountPaymentOperation>((complete) => {
        resolve = complete;
      }),
  );
  const secondActor = '55555555-5555-4555-8555-555555555555';
  const { result, rerender } = renderHook(({ actorId }) => useAccountPaymentOperation(actorId, visit, true, refresh), {
    initialProps: { actorId: actor },
  });
  await waitFor(() => expect(result.current.canStart).toBe(true));
  let write: Promise<void> = Promise.resolve();
  act(() => {
    write = result.current.quote(request);
  });
  rerender({ actorId: secondActor });
  await waitFor(() => expect(result.current.canStart).toBe(true));
  await act(async () => {
    resolve(operation);
    await write;
  });
  expect(result.current.operation).toBeNull();
  expect(result.current.pending).toBeNull();
  expect(readPendingAccountPayment(actor, visit).status).toBe('pending');
  expect(readPendingAccountPayment(secondActor, visit).status).toBe('none');
});
