import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { act, renderHook, waitFor } from '@testing-library/react';
import type {
  GuestAccountPaymentAccount,
  GuestAccountCheckoutStatus,
  GuestAccountPaymentOperation,
  GuestEqualSharePlan,
} from '@/types/guestAccountPayments';
import type { TableGuestVisitIdentity } from '@/types/tableGuestVisit';
import { guestAccountPaymentService } from '@/services/guestAccountPaymentService';
import { fingerprintGuestParticipant } from '@/lib/guestParticipantFingerprint';
import {
  createGuestAccountPaymentDescriptor,
  readGuestAccountPaymentAttempts,
  saveGuestAccountPaymentAttempt,
  withCheckoutAttempt,
  withQuotedOperation,
  withReservation,
  withStartRequested,
} from '@/services/guestAccountPaymentStorage';
import { readGuestEqualSharePlanIntents } from '@/services/guestEqualSharePlanStorage';
import { useGuestAccountPaymentFlow } from './useGuestAccountPaymentFlow';

jest.mock('@/services/guestAccountPaymentService', () => ({
  guestAccountPaymentService: {
    getAccount: jest.fn(),
    createQuote: jest.fn(),
    retryQuote: jest.fn(),
    createEqualSharePlan: jest.fn(),
    getEqualSharePlan: jest.fn(),
    getOperation: jest.fn(),
    reserve: jest.fn(),
    release: jest.fn(),
    getCheckoutStatus: jest.fn(),
    startCheckout: jest.fn(),
    requestCancellation: jest.fn(),
    getReceipt: jest.fn(),
  },
}));

jest.mock('@/lib/guestAccountPaymentRules', () => ({
  ...jest.requireActual('@/lib/guestAccountPaymentRules'),
  createPaymentOperationId: () => '00000000-0000-4000-8000-000000000010',
  createReceiptCredential: () => 'A'.repeat(43),
}));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000020';
const ORDER_ID = '00000000-0000-4000-8000-000000000030';
const PAYMENT_STORAGE_KEY = 'rumi_table_guest_payment_attempts_v1';
const identity: TableGuestVisitIdentity = {
  serviceSessionId: SESSION_ID,
  participantToken: 'participant-secret',
  expiresAt: '2030-01-01T00:00:00Z',
};
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const originalTextEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');

const account: GuestAccountPaymentAccount = {
  serviceSessionId: SESSION_ID,
  status: 'Open',
  accountRevision: 7,
  currency: 'CHF',
  outstandingMinor: 5000,
  reservedMinor: 0,
  availableMinor: 5000,
  capturedAccountPaymentMinor: 0,
  outstandingAllocations: [
    { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 5000, amountMinor: 5000 },
  ],
  availableAllocations: [
    { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 5000, amountMinor: 5000 },
  ],
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 20,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
  },
};
const ownedPlanAccount: GuestAccountPaymentAccount = {
  ...account,
  activeEqualSharePlan: {
    planId: '00000000-0000-4000-8000-000000000031',
    accountRevision: 7,
    totalMinor: 5000,
    shareCount: 2,
    currency: 'CHF',
    isOwnPlan: true,
    slots: [],
    scope: [],
  },
};

function operation(state: GuestAccountPaymentOperation['state'], version: number): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SESSION_ID,
    operationId: OPERATION_ID,
    state,
    version,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'OnlinePayment',
    amountMinor: 1250,
    currency: 'CHF',
    quoteExpiresAt: '2030-01-01T00:00:00Z',
    reservedAt: state === 'Reserved' ? '2030-01-01T00:00:00Z' : null,
    reservationExpiresAt: state === 'Reserved' ? '2030-01-01T00:10:00Z' : null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    allocations: [],
  };
}

function checkout(): GuestAccountCheckoutStatus {
  return {
    attemptId: ATTEMPT_ID,
    operationId: OPERATION_ID,
    state: 'Starting',
    version: 1,
    amountMinor: 1250,
    currency: 'CHF',
    expiresAt: '2030-01-01T00:10:00Z',
    checkoutUrl: null,
    reconciliationRequired: false,
    receivedMinor: 0,
    refundedMinor: 0,
  };
}

function equalSharePlan(shareCount = 2): GuestEqualSharePlan {
  return {
    serviceSessionId: SESSION_ID,
    planId: '00000000-0000-4000-8000-000000000030',
    operationId: OPERATION_ID,
    accountRevision: 7,
    totalMinor: 5000,
    shareCount,
    currency: 'CHF',
    createdAt: '2030-01-01T00:00:00Z',
    invalidatedAt: null,
    scope: [],
  };
}

async function saveUnfinishedQuote(operationId = OPERATION_ID) {
  const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
  if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
  const descriptor = createGuestAccountPaymentDescriptor(
    SESSION_ID,
    operationId,
    { expectedAccountRevision: 7, mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 1250 },
    participantFingerprint,
  );
  if (!saveGuestAccountPaymentAttempt(descriptor)) throw new Error('test quote descriptor was not saved');
  return descriptor;
}

function options(enabled = true, activeIdentity: TableGuestVisitIdentity | null = identity) {
  return {
    activeIdentity,
    recoveryIdentity: identity,
    newPaymentsEnabled: enabled,
    canCreatePayment: enabled,
    returnAttemptId: null,
    onAccountUpdated: jest.fn(),
  };
}

describe('useGuestAccountPaymentFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
    jest.clearAllMocks();
    jest.mocked(guestAccountPaymentService.getAccount).mockResolvedValue(account);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else Reflect.deleteProperty(globalThis, 'crypto');
    if (originalTextEncoder) Object.defineProperty(globalThis, 'TextEncoder', originalTextEncoder);
    else Reflect.deleteProperty(globalThis, 'TextEncoder');
  });

  it('persists the operation before quote I/O and blocks a second same-turn quote', async () => {
    let resolveQuote!: (value: {
      operation: GuestAccountPaymentOperation;
      contribution: { amountMinor: number; currency: string; snapshotFingerprint: string };
    }) => void;
    jest.mocked(guestAccountPaymentService.createQuote).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuote = resolve;
        }),
    );
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.account).toEqual(account));

    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    await act(() => {
      first = result.current.reviewContribution({ mode: 'Amount', paymentMethod: 'OnlinePayment', amountMinor: 1250 });
      duplicate = result.current.reviewContribution({
        mode: 'Amount',
        paymentMethod: 'OnlinePayment',
        amountMinor: 1250,
      });
    });
    await waitFor(() =>
      expect(readGuestAccountPaymentAttempts()).toMatchObject({
        kind: 'ready',
        attempts: [{ operationId: OPERATION_ID, quote: { amountMinor: 1250, expectedAccountRevision: 7 } }],
      }),
    );
    await act(async () => {
      resolveQuote({
        operation: operation('Quoted', 1),
        contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
      });
      expect(await Promise.all([first, duplicate])).toEqual([true, false]);
    });

    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({
        operationId: OPERATION_ID,
        expectedAccountRevision: 7,
      }),
      expect.objectContaining({ operationId: OPERATION_ID, participantFingerprint: expect.any(String) }),
      expect.objectContaining({ accountRevision: 7 }),
    );
  });

  it('retries an unfinished quote with the frozen operation and reviewed request after account availability changes', async () => {
    const descriptor = await saveUnfinishedQuote();
    jest.mocked(guestAccountPaymentService.getOperation).mockRejectedValueOnce(new Error('operation not found'));
    jest.mocked(guestAccountPaymentService.getAccount).mockResolvedValue({
      ...account,
      accountRevision: 8,
      availableMinor: 250,
      availableAllocations: [],
    });
    jest.mocked(guestAccountPaymentService.retryQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'c'.repeat(64) },
    });

    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      expect(await result.current.retryUnfinishedQuote()).toBe(true);
    });

    expect(guestAccountPaymentService.retryQuote).toHaveBeenCalledWith(identity, descriptor, 'CHF');
    expect(guestAccountPaymentService.createQuote).not.toHaveBeenCalled();
    expect(readGuestAccountPaymentAttempts()).toMatchObject({
      kind: 'ready',
      attempts: [{ operationId: OPERATION_ID, quote: { expectedAccountRevision: 7, amountMinor: 1250 } }],
    });
    expect(result.current.operation?.state).toBe('Quoted');
    expect(result.current.attempt?.unfinishedQuote).toBe(false);
  });

  it('allows explicit discard only for a marker-free unfinished quote', async () => {
    await saveUnfinishedQuote('00000000-0000-4000-8000-000000000011');
    jest.mocked(guestAccountPaymentService.getOperation).mockRejectedValueOnce(new Error('status unavailable'));
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'd'.repeat(64) },
    });
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      expect(await result.current.discardUnfinishedQuote()).toBe(true);
    });
    expect(readGuestAccountPaymentAttempts()).toEqual({ kind: 'empty', attempts: [] });
    expect(guestAccountPaymentService.reserve).not.toHaveBeenCalled();
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();

    await act(async () => {
      expect(
        await result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
    });
    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({ operationId: OPERATION_ID, expectedAccountRevision: 7 }),
      expect.objectContaining({ operationId: OPERATION_ID }),
      expect.objectContaining({ accountRevision: 7 }),
    );
  });

  it.each([
    [
      'quoted contribution',
      { contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'e'.repeat(64) }, quotedVersion: 1 },
    ],
    ['saved reservation capability', { receiptCredential: 'A'.repeat(43) }],
  ])('keeps an unfinished quote held when it has a %s', async (_label, changes) => {
    const descriptor = await saveUnfinishedQuote();
    const updated = { ...descriptor, ...changes };
    expect(saveGuestAccountPaymentAttempt(updated)).toBe(true);
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      expect(await result.current.discardUnfinishedQuote()).toBe(false);
    });
    const stored = readGuestAccountPaymentAttempts();
    expect(stored.kind).toBe('ready');
    if (stored.kind === 'ready') expect(stored.attempts[0].operationId).toBe(OPERATION_ID);
    expect(guestAccountPaymentService.retryQuote).not.toHaveBeenCalled();
  });

  it('persists a reservation marker before reserve and resumes the same operation after a lost response and reload', async () => {
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
    });
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Quoted', 1))
      .mockResolvedValueOnce(operation('Reserved', 2))
      .mockResolvedValueOnce(operation('Reserved', 2));
    let reserveCredential: string | null = null;
    jest.mocked(guestAccountPaymentService.reserve).mockImplementationOnce(async () => {
      const saved = readGuestAccountPaymentAttempts();
      expect(saved.kind).toBe('ready');
      if (saved.kind === 'ready') {
        reserveCredential = saved.attempts[0].receiptCredential;
        expect(reserveCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(saved.attempts[0].reservedExpectedVersion).toBeNull();
      }
      throw new Error('reserve committed but response was lost');
    });
    jest.mocked(guestAccountPaymentService.startCheckout).mockResolvedValue(checkout());
    const original = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(original.result.current.account).toEqual(account));
    await act(async () => {
      expect(
        await original.result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
      expect(await original.result.current.startOrResumeCheckout()).toBe(false);
    });
    original.unmount();

    const pending = readGuestAccountPaymentAttempts();
    expect(pending.kind).toBe('ready');
    if (pending.kind !== 'ready') throw new Error('expected durable reserve intent');
    expect(pending.attempts[0]).toMatchObject({ receiptCredential: reserveCredential, reservedExpectedVersion: null });
    const recovered = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(recovered.result.current.isLoading).toBe(false));
    expect(recovered.result.current.operation?.state).toBe('Reserved');
    await act(async () => {
      expect(await recovered.result.current.discardUnfinishedQuote()).toBe(false);
    });
    await act(async () => {
      expect(await recovered.result.current.startOrResumeCheckout()).toBe(true);
    });

    expect(guestAccountPaymentService.reserve).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.startCheckout).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({ operationId: OPERATION_ID, receiptCredential: reserveCredential }),
      2,
      reserveCredential,
    );
  });

  it('does not send reserve when the durable reservation marker cannot be saved', async () => {
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
    });
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(operation('Quoted', 1));
    const originalSetItem = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === PAYMENT_STORAGE_KEY) {
        const stored = JSON.parse(value) as { attempts?: Array<{ receiptCredential?: string | null }> };
        if (stored.attempts?.some((attempt) => attempt.receiptCredential !== null)) throw new Error('quota');
      }
      originalSetItem.call(this, key, value);
    });
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.account).toEqual(account));
    await act(async () => {
      expect(
        await result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
      expect(await result.current.startOrResumeCheckout()).toBe(false);
    });

    expect(guestAccountPaymentService.reserve).not.toHaveBeenCalled();
    expect(result.current.storageUnavailable).toBe(true);
    const saved = readGuestAccountPaymentAttempts();
    expect(saved.kind).toBe('ready');
    if (saved.kind === 'ready') expect(saved.attempts[0].receiptCredential).toBeNull();
  });

  it('recovers a committed checkout after a lost response with the same operation, version and receipt credential when the flag turns off', async () => {
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
    });
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Quoted', 1))
      .mockResolvedValue(operation('Reserved', 2));
    jest.mocked(guestAccountPaymentService.reserve).mockResolvedValue(operation('Reserved', 2));
    jest
      .mocked(guestAccountPaymentService.startCheckout)
      .mockRejectedValueOnce(new Error('response lost after server commit'))
      .mockResolvedValue(checkout());
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockRejectedValueOnce(new Error('first status unavailable'))
      .mockRejectedValueOnce(new Error('replay status unavailable'));

    const original = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(original.result.current.account).toEqual(account));
    await act(async () => {
      expect(
        await original.result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
    });
    await act(async () => {
      expect(await original.result.current.startOrResumeCheckout()).toBe(false);
    });
    original.unmount();

    const saved = readGuestAccountPaymentAttempts();
    expect(saved.kind).toBe('ready');
    if (saved.kind !== 'ready') throw new Error('expected a saved pending checkout');
    expect(saved.attempts[0]).toMatchObject({
      serviceSessionId: SESSION_ID,
      operationId: OPERATION_ID,
      reservedExpectedVersion: 2,
      startRequestedAt: expect.any(Number),
      attemptId: null,
    });
    const receiptCredential = saved.attempts[0].receiptCredential;
    expect(receiptCredential).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const recovered = renderHook(() => useGuestAccountPaymentFlow(options(false)));
    await waitFor(() => expect(recovered.result.current.isLoading).toBe(false));
    expect(recovered.result.current.error).toBe('load');
    await act(async () => {
      expect(await recovered.result.current.startOrResumeCheckout()).toBe(true);
    });

    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.startCheckout).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.startCheckout).toHaveBeenNthCalledWith(
      1,
      identity,
      expect.objectContaining({ operationId: OPERATION_ID, contribution: expect.any(Object) }),
      2,
      receiptCredential,
    );
    expect(guestAccountPaymentService.startCheckout).toHaveBeenNthCalledWith(
      2,
      identity,
      expect.objectContaining({ operationId: OPERATION_ID, contribution: expect.any(Object) }),
      2,
      receiptCredential,
    );
  });

  it('reads only the saved owner receipt after the visit has ended', async () => {
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION_ID,
      OPERATION_ID,
      {
        expectedAccountRevision: 7,
        mode: 'Amount',
        paymentMethod: 'OnlinePayment',
        amountMinor: 1250,
      },
      participantFingerprint,
    );
    const quoted = withQuotedOperation(descriptor, 1, {
      amountMinor: 1250,
      currency: 'CHF',
      snapshotFingerprint: 'd'.repeat(64),
    });
    const started = withCheckoutAttempt(withStartRequested(withReservation(quoted, 2, 'A'.repeat(43))), ATTEMPT_ID);
    expect(saveGuestAccountPaymentAttempt(started)).toBe(true);
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValue({
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Captured',
      receivedMinor: 1250,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: '2030-01-01T00:00:00Z',
      receiptExpiresAt: '2030-01-04T00:00:00Z',
    });

    const { result } = renderHook(() => useGuestAccountPaymentFlow(options(false, null)));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledWith(
      ATTEMPT_ID,
      'A'.repeat(43),
      expect.objectContaining({ operationId: OPERATION_ID }),
    );
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
    expect(guestAccountPaymentService.getCheckoutStatus).not.toHaveBeenCalled();
    expect(result.current.receipts).toEqual([
      expect.objectContaining({ attemptId: ATTEMPT_ID, receipt: expect.objectContaining({ state: 'Captured' }) }),
    ]);
    expect(await result.current.startOrResumeCheckout()).toBe(false);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('recovers a returned attempt by private receipt capability when storing the start response fails', async () => {
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
    });
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Quoted', 1))
      .mockResolvedValue(operation('Reserved', 2));
    jest.mocked(guestAccountPaymentService.reserve).mockResolvedValue(operation('Reserved', 2));
    jest.mocked(guestAccountPaymentService.startCheckout).mockResolvedValue(checkout());
    const originalSetItem = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === PAYMENT_STORAGE_KEY) {
        try {
          const stored = JSON.parse(value) as { attempts?: Array<{ attemptId?: string | null }> };
          if (stored.attempts?.some((attempt) => attempt.attemptId === ATTEMPT_ID)) throw new Error('quota');
        } catch (error) {
          if (error instanceof Error && error.message === 'quota') throw error;
        }
      }
      originalSetItem.call(this, key, value);
    });
    const original = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(original.result.current.account).toEqual(account));
    await act(async () => {
      expect(
        await original.result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
      expect(await original.result.current.startOrResumeCheckout()).toBe(true);
    });
    original.unmount();
    jest.clearAllMocks();

    const stored = readGuestAccountPaymentAttempts();
    expect(stored.kind).toBe('ready');
    if (stored.kind !== 'ready') throw new Error('expected the pre-start recovery evidence');
    expect(stored.attempts[0]).toMatchObject({ startRequestedAt: expect.any(Number), attemptId: null });
    const receiptCredential = stored.attempts[0].receiptCredential;
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValue({
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing',
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    });
    const recovered = renderHook(() =>
      useGuestAccountPaymentFlow({
        ...options(false, null),
        returnAttemptId: ATTEMPT_ID,
      }),
    );
    await waitFor(() => expect(recovered.result.current.isLoading).toBe(false));
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledWith(
      ATTEMPT_ID,
      receiptCredential,
      expect.objectContaining({ attemptId: null, contribution: expect.any(Object) }),
    );
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
    const recoveredDescriptor = readGuestAccountPaymentAttempts();
    expect(recoveredDescriptor.kind).toBe('ready');
    if (recoveredDescriptor.kind === 'ready') expect(recoveredDescriptor.attempts[0].attemptId).toBeNull();
  });

  it.each(['unavailable', 'available'] as const)(
    'reports receipt availability for a saved attempt without a return hint when the read is %s',
    async (outcome) => {
      const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
      if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
      const quoted = withQuotedOperation(
        createGuestAccountPaymentDescriptor(
          SESSION_ID,
          OPERATION_ID,
          {
            expectedAccountRevision: 7,
            mode: 'Amount',
            paymentMethod: 'OnlinePayment',
            amountMinor: 1250,
          },
          participantFingerprint,
        ),
        1,
        { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'd'.repeat(64) },
      );
      const pending = withCheckoutAttempt(withStartRequested(withReservation(quoted, 2, 'A'.repeat(43))), ATTEMPT_ID);
      expect(saveGuestAccountPaymentAttempt(pending)).toBe(true);

      const receipt = {
        attemptId: ATTEMPT_ID,
        amountMinor: 1250,
        currency: 'CHF',
        state: 'Captured' as const,
        receivedMinor: 1250,
        refundedMinor: 0,
        reconciliationRequired: false,
        completedAt: '2030-01-01T00:00:00Z',
        receiptExpiresAt: '2030-01-04T00:00:00Z',
      };
      if (outcome === 'unavailable')
        jest.mocked(guestAccountPaymentService.getReceipt).mockRejectedValueOnce(new Error('receipt read failed'));
      else jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValueOnce(receipt);

      const { result } = renderHook(() => useGuestAccountPaymentFlow(options(false, null)));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledWith(
        ATTEMPT_ID,
        'A'.repeat(43),
        expect.objectContaining({ attemptId: ATTEMPT_ID, operationId: OPERATION_ID }),
      );
      expect(result.current.returnReceiptUnavailable).toBe(outcome === 'unavailable');
      if (outcome === 'available')
        expect(result.current.receipts).toEqual([
          expect.objectContaining({ attemptId: ATTEMPT_ID, receipt: expect.objectContaining({ state: 'Captured' }) }),
        ]);

      const stored = readGuestAccountPaymentAttempts();
      expect(stored.kind).toBe('ready');
      if (stored.kind === 'ready')
        expect(stored.attempts[0]).toMatchObject({ attemptId: ATTEMPT_ID, receiptCredential: 'A'.repeat(43) });
    },
  );

  it('keeps a closed-visit return receipt retryable with only its saved private capability', async () => {
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const quoted = withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        SESSION_ID,
        OPERATION_ID,
        {
          expectedAccountRevision: 7,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        },
        participantFingerprint,
      ),
      1,
      { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'd'.repeat(64) },
    );
    const pending = withStartRequested(withReservation(quoted, 2, 'A'.repeat(43)));
    expect(saveGuestAccountPaymentAttempt(pending)).toBe(true);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockRejectedValueOnce(new Error('receipt read unavailable'))
      .mockResolvedValue({
        attemptId: ATTEMPT_ID,
        amountMinor: 1250,
        currency: 'CHF',
        state: 'Processing',
        receivedMinor: 0,
        refundedMinor: 0,
        reconciliationRequired: false,
        completedAt: null,
        receiptExpiresAt: null,
      });

    const { result } = renderHook(() =>
      useGuestAccountPaymentFlow({
        ...options(false, null),
        recoveryIdentity: null,
        returnAttemptId: ATTEMPT_ID,
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.returnReceiptUnavailable).toBe(true);
    expect(result.current.attempt).toMatchObject({ startRequested: true, attemptId: null });
    await act(async () => {
      expect(await result.current.refreshPaymentStatus()).toBe(true);
    });

    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenNthCalledWith(
      2,
      ATTEMPT_ID,
      'A'.repeat(43),
      expect.objectContaining({ serviceSessionId: SESSION_ID, attemptId: null }),
    );
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
    expect(guestAccountPaymentService.getCheckoutStatus).not.toHaveBeenCalled();
  });

  it('does not expose a same-session prior participant receipt to the active participant return hint', async () => {
    const previousFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!previousFingerprint) throw new Error('test participant fingerprint is unavailable');
    const previous = withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        SESSION_ID,
        OPERATION_ID,
        {
          expectedAccountRevision: 7,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        },
        previousFingerprint,
      ),
      1,
      { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'd'.repeat(64) },
    );
    const owned = withCheckoutAttempt(withStartRequested(withReservation(previous, 2, 'A'.repeat(43))), ATTEMPT_ID);
    expect(saveGuestAccountPaymentAttempt(owned)).toBe(true);

    const activeIdentity = { ...identity, participantToken: 'second-participant-secret' };
    const { result } = renderHook(() =>
      useGuestAccountPaymentFlow({
        ...options(false, activeIdentity),
        recoveryIdentity: identity,
        returnAttemptId: ATTEMPT_ID,
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(guestAccountPaymentService.getReceipt).not.toHaveBeenCalled();
    expect(result.current.receipts).toEqual([]);
    expect(result.current.returnReceiptUnavailable).toBe(true);
    expect(result.current.attempt).toBeNull();
  });

  it('does not query a same-visit prior participant operation or block the new participant', async () => {
    const previous = withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        SESSION_ID,
        OPERATION_ID,
        {
          expectedAccountRevision: 7,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        },
        'e'.repeat(64),
      ),
      1,
      { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'd'.repeat(64) },
    );
    expect(saveGuestAccountPaymentAttempt(withStartRequested(withReservation(previous, 2, 'A'.repeat(43))))).toBe(true);
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: operation('Quoted', 1),
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'b'.repeat(64) },
    });
    const otherIdentity = { ...identity, participantToken: 'second-participant-secret' };
    const { result } = renderHook(() =>
      useGuestAccountPaymentFlow({
        ...options(true, otherIdentity),
        recoveryIdentity: identity,
      }),
    );
    await waitFor(() => expect(result.current.account).toEqual(account));
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
    expect(result.current.canReplaceAttempt).toBe(true);
    await act(async () => {
      expect(
        await result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
    });
    const participantFingerprint = await fingerprintGuestParticipant(otherIdentity.participantToken);
    expect(guestAccountPaymentService.createQuote).toHaveBeenCalledWith(
      otherIdentity,
      expect.any(Object),
      expect.objectContaining({ participantFingerprint }),
      account,
    );
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
  });

  it('recovers a committed share plan after a lost response without creating another operation', async () => {
    jest
      .mocked(guestAccountPaymentService.createEqualSharePlan)
      .mockRejectedValueOnce(new Error('response lost after server commit'));
    const original = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(original.result.current.planRecoveryLoading).toBe(false));

    await act(async () => {
      expect(await original.result.current.createEqualSharePlan(2)).toBe(false);
    });
    const stored = readGuestEqualSharePlanIntents();
    expect(stored.kind).toBe('ready');
    if (stored.kind !== 'ready') throw new Error('expected a persisted equal-share request');
    expect(stored.intents[0]).toMatchObject({
      serviceSessionId: SESSION_ID,
      operationId: OPERATION_ID,
      expectedAccountRevision: 7,
      shareCount: 2,
      supersedesPlanId: null,
    });
    original.unmount();

    jest.mocked(guestAccountPaymentService.getEqualSharePlan).mockResolvedValue(equalSharePlan());
    const recovered = renderHook(() => useGuestAccountPaymentFlow(options(false)));
    await waitFor(() => expect(recovered.result.current.planRecoveryLoading).toBe(false));

    expect(guestAccountPaymentService.getEqualSharePlan).toHaveBeenCalledWith(identity, OPERATION_ID);
    expect(guestAccountPaymentService.createEqualSharePlan).toHaveBeenCalledTimes(1);
    expect(readGuestEqualSharePlanIntents()).toEqual({ kind: 'empty' });
    expect(recovered.result.current.pendingPlanIntent).toBeNull();
  });

  it('keeps an unresolved original plan across flag-off lookup and only replays the exact key when enabled', async () => {
    jest
      .mocked(guestAccountPaymentService.createEqualSharePlan)
      .mockRejectedValueOnce(new Error('request outcome unknown'))
      .mockResolvedValueOnce(equalSharePlan(3));
    jest.mocked(guestAccountPaymentService.getAccount).mockResolvedValue(ownedPlanAccount);
    const original = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(original.result.current.planRecoveryLoading).toBe(false));
    await act(async () => {
      expect(await original.result.current.createEqualSharePlan(3)).toBe(false);
    });
    original.unmount();

    jest.mocked(guestAccountPaymentService.getEqualSharePlan).mockRejectedValue(new Error('lookup unavailable'));
    const recovery = renderHook(
      (currentOptions: ReturnType<typeof options>) => useGuestAccountPaymentFlow(currentOptions),
      {
        initialProps: options(false),
      },
    );
    await waitFor(() => expect(recovery.result.current.planRecoveryLoading).toBe(false));
    await act(async () => {
      expect(await recovery.result.current.resolveOriginalPlan()).toBe(false);
    });
    expect(guestAccountPaymentService.createEqualSharePlan).toHaveBeenCalledTimes(1);
    expect(recovery.result.current.pendingPlanIntent?.operationId).toBe(OPERATION_ID);
    expect(recovery.result.current.planRecoveryBlocked).toBe(true);

    recovery.rerender(options(true));
    await waitFor(() => expect(recovery.result.current.planRecoveryLoading).toBe(false));
    await waitFor(() => expect(recovery.result.current.account).toEqual(ownedPlanAccount));
    await act(async () => {
      expect(await recovery.result.current.createEqualSharePlan(4)).toBe(false);
    });
    expect(guestAccountPaymentService.createEqualSharePlan).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await recovery.result.current.resolveOriginalPlan()).toBe(true);
    });
    expect(guestAccountPaymentService.createEqualSharePlan).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.createEqualSharePlan).toHaveBeenLastCalledWith(identity, {
      operationId: OPERATION_ID,
      expectedAccountRevision: 7,
      shareCount: 3,
      supersedesPlanId: '00000000-0000-4000-8000-000000000031',
    });
    expect(readGuestEqualSharePlanIntents()).toEqual({ kind: 'empty' });
  });
});
