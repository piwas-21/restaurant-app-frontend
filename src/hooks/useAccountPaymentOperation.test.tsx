import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccountPaymentOperation } from './useAccountPaymentOperation';
import * as service from '@/services/accountPaymentsService';
import { persistPendingAccountPayment, readPendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { AccountPaymentOperation, CreateAccountPaymentQuoteRequest } from '@/types/accountPayments';
import type { AccountCashReceipt, AccountCashSettlement } from '@/types/accountCashSettlement';
import type { PendingAccountPayment } from '@/lib/pendingAccountPayment';
import type { AccountCashCollectionIntent } from '@/lib/accountCashCollectionIntent';

const translate = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
jest.mock('@/services/accountPaymentsService', () => ({
  getAccountPaymentAccount: jest.fn(),
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
  paymentMethod: 'CreditCard',
  amountMinor: 29,
};
const operation: AccountPaymentOperation = {
  serviceSessionId: visit,
  operationId: request.operationId,
  state: 'Quoted',
  version: 1,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'CreditCard',
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
const cashRequest: CreateAccountPaymentQuoteRequest = {
  ...request,
  paymentMethod: 'Cash',
  amountMinor: 333,
};
const cashSettlement: AccountCashSettlement = {
  policyVersion: 'chf-cash-5-rappen-v1',
  currency: 'CHF',
  paymentMethod: 'Cash',
  exactAmountMinor: 333,
  adjustmentMinor: 2,
  dueAmountMinor: 335,
};
const cashQuoted: AccountPaymentOperation = {
  ...operation,
  operationId: cashRequest.operationId,
  state: 'Quoted',
  paymentMethod: 'Cash',
  amountMinor: 333,
  currency: 'CHF',
  cashSettlement,
  allocations: [
    {
      ...operation.allocations[0],
      minorPerUnit: 333,
      amountMinor: 333,
    },
  ],
};
const cashReserved: AccountPaymentOperation = { ...cashQuoted, state: 'Reserved', version: 2 };
const cashReceipt: AccountCashReceipt = {
  policyVersion: cashSettlement.policyVersion,
  currency: cashSettlement.currency,
  exactAmountMinor: cashSettlement.exactAmountMinor,
  adjustmentMinor: cashSettlement.adjustmentMinor,
  dueAmountMinor: cashSettlement.dueAmountMinor,
  receivedMinor: 400,
  changeMinor: 65,
  capturedAt: '2026-10-03T12:00:00Z',
};
const cashIntent: AccountCashCollectionIntent = {
  operationId: cashRequest.operationId,
  serviceSessionId: visit,
  expectedVersion: 2,
  receivedMinor: 400,
  settlement: cashSettlement,
};
const cashCaptured: AccountPaymentOperation = {
  ...cashReserved,
  state: 'Captured',
  version: 3,
  cashReceipt,
};
const cashItemsRequest: CreateAccountPaymentQuoteRequest = {
  operationId: cashRequest.operationId,
  expectedAccountRevision: 7,
  mode: 'Items',
  paymentMethod: 'Cash',
  selectedUnits: [
    {
      orderId: '77777777-7777-4777-8777-777777777777',
      orderItemId: '88888888-8888-4888-8888-888888888888',
      ordinal: 1,
    },
  ],
};
const cashItemsQuoted: AccountPaymentOperation = {
  ...cashQuoted,
  mode: 'Items',
  allocations: [
    {
      orderId: cashItemsRequest.selectedUnits?.[0].orderId ?? '',
      orderItemId: cashItemsRequest.selectedUnits?.[0].orderItemId ?? '',
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 333,
      amountMinor: 333,
    },
  ],
};
const cashItemsReserved: AccountPaymentOperation = { ...cashItemsQuoted, state: 'Reserved', version: 2 };
const cashItemsCaptured: AccountPaymentOperation = { ...cashItemsReserved, state: 'Captured', version: 3, cashReceipt };

function renderOperationHook(
  actorId: string | undefined = actor,
  enabled = true,
  recoveryEnabled = false,
  currency: string | null = 'EUR',
) {
  return renderHook(() => useAccountPaymentOperation(actorId, visit, enabled, refresh, recoveryEnabled, currency));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('persists the original operation before sending and blocks simultaneous double-click writes', async () => {
  api.reserveAccountPayment.mockResolvedValue({ ...operation, state: 'Reserved', version: 2 });
  let resolve: (result: AccountPaymentOperation) => void = () => undefined;
  api.quoteAccountPayment.mockImplementation(() => {
    expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { request } });
    return new Promise<AccountPaymentOperation>((complete) => {
      resolve = complete;
    });
  });
  const { result } = renderOperationHook();
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
  expect(api.reserveAccountPayment).toHaveBeenCalledTimes(1);
  expect(api.reserveAccountPayment).toHaveBeenCalledWith(visit, request.operationId, {
    expectedVersion: operation.version,
    expectedAccountRevision: request.expectedAccountRevision,
  });
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(result.current.operation?.state).toBe('Reserved');
  expect(result.current.pending).toMatchObject({ stage: 'reserved', request, expectedVersion: 2, currency: 'EUR' });
});

it('keeps a stale quote pending for operator review without reserving or collecting it', async () => {
  api.quoteAccountPayment.mockResolvedValue({ ...operation, expectedAccountRevision: 6 });
  const { result } = renderOperationHook();
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    await result.current.quote(request);
  });

  expect(result.current.operation).toBeNull();
  expect(result.current.pending).toMatchObject({ stage: 'quote', request });
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('checks an unknown reserve result without retrying or collecting automatically', async () => {
  api.quoteAccountPayment.mockResolvedValue(operation);
  api.reserveAccountPayment.mockRejectedValue(new Error('response lost'));
  const { result } = renderOperationHook();
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    await result.current.quote(request);
  });

  expect(api.reserveAccountPayment).toHaveBeenCalledTimes(1);
  expect(result.current.operation?.state).toBe('Quoted');
  expect(result.current.pending).toMatchObject({ stage: 'reserving', request, expectedVersion: 1 });
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.reserve();
  });
  expect(api.reserveAccountPayment).toHaveBeenCalledTimes(1);

  api.getAccountPaymentOperation.mockResolvedValue({ ...operation, state: 'Reserved', version: 2 });
  await act(async () => {
    await result.current.check();
  });

  expect(result.current.operation?.state).toBe('Reserved');
  expect(result.current.pending).toMatchObject({ stage: 'reserved', request, expectedVersion: 2 });
  expect(api.reserveAccountPayment).toHaveBeenCalledTimes(1);
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('does not reserve a restored quote until an operator explicitly starts reservation', async () => {
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'quote',
    request,
  });
  api.getAccountPaymentOperation.mockResolvedValue(operation);
  const { result } = renderOperationHook();

  await waitFor(() => expect(result.current.operation?.state).toBe('Quoted'));
  expect(result.current.pending).toMatchObject({ stage: 'review', request });
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('never reserves an invalid cash quote or collects it', async () => {
  api.quoteAccountPayment.mockResolvedValue({
    ...cashQuoted,
    cashSettlement: { ...cashSettlement, exactAmountMinor: cashSettlement.exactAmountMinor + 1 },
  });
  const { result } = renderOperationHook(actor, true, false, 'CHF');
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    await result.current.quote(cashRequest);
    await result.current.reserve();
  });

  expect(result.current.operation?.state).toBe('Quoted');
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('never reserves a card quote whose frozen allocation total is inconsistent', async () => {
  api.quoteAccountPayment.mockResolvedValue({
    ...operation,
    allocations: [{ ...operation.allocations[0], amountMinor: 28 }],
  });
  const { result } = renderOperationHook();
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    await result.current.quote(request);
    await result.current.reserve();
  });

  expect(result.current.operation?.state).toBe('Quoted');
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('refuses a quote before network I/O when recovery storage cannot be written', async () => {
  const { result } = renderOperationHook();
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

it('never reserves when the quoted result cannot be durably saved to the recovery journal', async () => {
  api.quoteAccountPayment.mockResolvedValue(operation);
  const originalSetItem = Storage.prototype.setItem;
  let writeCount = 0;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    writeCount += 1;
    if (writeCount === 2) throw new Error('journal update denied');
    originalSetItem.call(this, key, value);
  });
  const { result } = renderOperationHook();
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    await result.current.quote(request);
  });

  expect(writeCount).toBe(2);
  expect(result.current.storageUnavailable).toBe(true);
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
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
  const first = renderOperationHook();
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
  const second = renderOperationHook(actor, false);
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
  const { result } = renderOperationHook(actor, false, true);
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
  const { result } = renderOperationHook(actor, false, true);

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
  const { result } = renderOperationHook(actor, false);

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
  const { result } = renderOperationHook(actor, false);

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
  const { result, rerender } = renderHook(
    ({ actorId }) => useAccountPaymentOperation(actorId, visit, true, refresh, false, 'EUR'),
    {
      initialProps: { actorId: actor },
    },
  );
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

it('does not reserve a quote if the cashier changes while acceptance refresh is pending', async () => {
  let finishRefresh: () => void = () => undefined;
  const delayedRefresh = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
  );
  const secondActor = '55555555-5555-4555-8555-555555555555';
  api.quoteAccountPayment.mockResolvedValue(operation);
  api.reserveAccountPayment.mockResolvedValue({ ...operation, state: 'Reserved', version: 2 });
  const { result, rerender } = renderHook(
    ({ actorId }) => useAccountPaymentOperation(actorId, visit, true, delayedRefresh, false, 'EUR'),
    { initialProps: { actorId: actor } },
  );
  await waitFor(() => expect(result.current.canStart).toBe(true));
  let submission: Promise<void> = Promise.resolve();
  act(() => {
    submission = result.current.quote(request);
  });
  await waitFor(() => expect(delayedRefresh).toHaveBeenCalledTimes(1));
  rerender({ actorId: secondActor });
  await waitFor(() => expect(result.current.canStart).toBe(true));

  await act(async () => {
    finishRefresh();
    await submission;
  });

  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(readPendingAccountPayment(secondActor, visit).status).toBe('none');
});

it('replays a lost cash capture from the immutable stored intent and clears only its matching receipt', async () => {
  api.quoteAccountPayment.mockResolvedValue(cashQuoted);
  api.reserveAccountPayment.mockResolvedValue(cashReserved);
  api.collectAccountPayment
    .mockImplementationOnce(async () => {
      expect(readPendingAccountPayment(actor, visit)).toMatchObject({
        status: 'pending',
        value: { stage: 'collecting', currency: 'CHF', cashIntent },
      });
      throw new Error('response lost');
    })
    .mockResolvedValueOnce(cashCaptured);
  const first = renderOperationHook(actor, true, false, 'CHF');
  await waitFor(() => expect(first.result.current.canStart).toBe(true));
  await act(async () => {
    await first.result.current.quote(cashRequest);
  });
  await waitFor(() => expect(first.result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await first.result.current.collect(400);
  });
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({
    status: 'pending',
    value: { stage: 'collecting', expectedVersion: 2, currency: 'CHF', cashIntent },
  });
  first.unmount();

  api.getAccountPaymentOperation.mockResolvedValue(cashReserved);
  const replay = renderOperationHook(actor, false, true, 'CHF');
  await waitFor(() => expect(replay.result.current.operation?.state).toBe('Reserved'));
  expect(replay.result.current.pending).toMatchObject({ cashIntent, expectedVersion: 2 });
  await act(async () => {
    await replay.result.current.collect(399);
  });
  expect(api.collectAccountPayment).toHaveBeenCalledTimes(1);
  await act(async () => {
    await replay.result.current.collect();
  });
  expect(api.collectAccountPayment).toHaveBeenCalledTimes(2);
  expect(api.collectAccountPayment).toHaveBeenLastCalledWith(visit, cashRequest.operationId, {
    expectedVersion: 2,
    receivedMinor: 400,
  });
  await waitFor(() => expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' }));
  expect(replay.result.current.operation).toMatchObject({ state: 'Captured', cashReceipt });
});

it('holds a same-amount cash capture whose frozen item scope differs, then clears on corrected lookup', async () => {
  api.quoteAccountPayment.mockResolvedValue(cashItemsQuoted);
  api.reserveAccountPayment.mockResolvedValue(cashItemsReserved);
  api.collectAccountPayment.mockResolvedValue({
    ...cashItemsCaptured,
    allocations: [
      {
        ...cashItemsCaptured.allocations[0],
        orderItemId: '99999999-9999-4999-8999-999999999999',
      },
    ],
  });
  const hook = renderOperationHook(actor, true, false, 'CHF');
  await waitFor(() => expect(hook.result.current.canStart).toBe(true));
  await act(async () => {
    await hook.result.current.quote(cashItemsRequest);
  });
  await waitFor(() => expect(hook.result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await hook.result.current.collect(400);
  });
  expect(hook.result.current.operation?.state).toBe('Reserved');
  expect(hook.result.current.canRetryCollection).toBe(false);
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({
    status: 'pending',
    value: { stage: 'collecting', cashIntent },
  });

  api.getAccountPaymentOperation.mockResolvedValue(cashItemsCaptured);
  await act(async () => {
    await hook.result.current.check();
  });
  await waitFor(() => expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' }));
  expect(hook.result.current.operation).toMatchObject({ state: 'Captured', allocations: cashItemsQuoted.allocations });
});

it('preserves a cash descriptor when a captured receipt disagrees with its saved intent', async () => {
  const saved: PendingAccountPayment = {
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    expectedVersion: 2,
    currency: 'CHF',
    cashIntent,
    request: cashRequest,
  };
  persistPendingAccountPayment(saved);
  api.getAccountPaymentOperation.mockResolvedValue({
    ...cashCaptured,
    cashReceipt: { ...cashReceipt, receivedMinor: 399, changeMinor: 64 },
  });
  const { result } = renderOperationHook(actor, false, true, 'CHF');
  await waitFor(() => expect(result.current.operation?.state).toBe('Captured'));
  expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'pending', value: saved });
  if (result.current.pending?.kind !== 'payment') throw new Error('Expected retained payment descriptor');
  expect(result.current.pending.cashIntent).toEqual(cashIntent);
});

it('allows a legacy cash lookup and explicit no-money release, but never retries inferred cash', async () => {
  const legacy: PendingAccountPayment = {
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'collecting',
    expectedVersion: 2,
    currency: 'CHF',
    request: cashRequest,
  };
  persistPendingAccountPayment(legacy);
  api.getAccountPaymentOperation.mockResolvedValue(cashReserved);
  api.releaseAccountPayment.mockResolvedValue({ ...cashReserved, state: 'Released', version: 3 });
  const { result } = renderOperationHook(actor, false, true, 'CHF');
  await waitFor(() => expect(result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await result.current.collect();
    await result.current.release();
  });
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(api.releaseAccountPayment).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.release(true);
  });
  expect(api.releaseAccountPayment).toHaveBeenCalledWith(visit, cashRequest.operationId, { expectedVersion: 2 });
  expect(readPendingAccountPayment(actor, visit)).toEqual({ status: 'none' });
});

it('holds a quote whose operation currency does not bind to the visit before reserve or collect', async () => {
  api.quoteAccountPayment.mockResolvedValue(operation);
  const { result } = renderOperationHook(actor, true, false, 'CHF');
  await waitFor(() => expect(result.current.canStart).toBe(true));
  await act(async () => {
    await result.current.quote(request);
  });
  expect(result.current.operation).toBeNull();
  expect(result.current.pending).toMatchObject({ stage: 'quote', request });
  await act(async () => {
    await result.current.reserve();
    await result.current.collect();
  });
  expect(api.reserveAccountPayment).not.toHaveBeenCalled();
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
});

it('refuses card collection payloads that include a cash received amount', async () => {
  const reserved = { ...operation, state: 'Reserved' as const, version: 2 };
  persistPendingAccountPayment({
    actorId: actor,
    serviceSessionId: visit,
    kind: 'payment',
    stage: 'reserved',
    request,
    expectedVersion: 2,
    currency: 'EUR',
  });
  api.getAccountPaymentOperation.mockResolvedValue(reserved);
  const { result } = renderOperationHook(actor, true, true, 'EUR');
  await waitFor(() => expect(result.current.operation?.state).toBe('Reserved'));
  await act(async () => {
    await result.current.collect(400);
  });
  expect(api.collectAccountPayment).not.toHaveBeenCalled();
  expect(readPendingAccountPayment(actor, visit)).toMatchObject({ status: 'pending', value: { stage: 'reserved' } });
});
