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
import { createPaymentOperationId } from '@/lib/guestAccountPaymentRules';
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
import { recoverActivePayment } from './guestPaymentRecoveryHelpers';
import { useGuestAccountPaymentFlow } from './useGuestAccountPaymentFlow';
import { GUEST_ACCOUNT_READ_TIMEOUT_MS } from './useGuestPaymentAccountState';
import { GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS } from './useGuestPaymentRecovery';

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
  createPaymentOperationId: jest.fn(() => '00000000-0000-4000-8000-000000000010'),
  createReceiptCredential: () => 'A'.repeat(43),
}));

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const OPERATION_ID = '00000000-0000-4000-8000-000000000010';
const ATTEMPT_ID = '00000000-0000-4000-8000-000000000020';
const SECOND_OPERATION_ID = '00000000-0000-4000-8000-000000000011';
const SECOND_ATTEMPT_ID = '00000000-0000-4000-8000-000000000021';
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

function operation(
  state: GuestAccountPaymentOperation['state'],
  version: number,
  operationId = OPERATION_ID,
): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SESSION_ID,
    operationId,
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

async function saveStartedPaymentAttempt() {
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
  const started = withCheckoutAttempt(withStartRequested(withReservation(quoted, 2, 'A'.repeat(43))), ATTEMPT_ID);
  if (!saveGuestAccountPaymentAttempt(started)) throw new Error('test checkout descriptor was not saved');
  return started;
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
    jest.useRealTimers();
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

  it('does not expose a captured operation beside a stale processing receipt', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const capturedReceipt = {
      ...processingReceipt,
      state: 'Captured' as const,
      receivedMinor: 1250,
      completedAt: '2030-01-01T00:00:00Z',
      receiptExpiresAt: '2030-01-04T00:00:00Z',
    };
    const capturedOperation = operation('Captured', 3);
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(capturedOperation)
      .mockResolvedValue(capturedOperation);
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValue(capturedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(capturedReceipt)
      .mockResolvedValue(capturedReceipt);
    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(), returnAttemptId: ATTEMPT_ID }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkout).toMatchObject({ state: 'Processing' });
    expect(result.current.receipts).toEqual([]);
    expect(result.current.operation).toBeNull();
    expect(result.current.canReplaceAttempt).toBe(false);

    await waitFor(
      () => {
        expect(result.current.checkout).toEqual(capturedCheckout);
        expect(result.current.receipts[0]?.receipt).toMatchObject({ state: 'Captured', receivedMinor: 1250 });
        expect(result.current.operation).toEqual(capturedOperation);
      },
      { timeout: 5_000 },
    );
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('settles the same payer after the returned receipt and operation confirm capture', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const capturedCheckout = {
      ...checkout(),
      state: 'Captured' as const,
      version: 3,
      receivedMinor: 1250,
    };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const capturedReceipt = {
      ...processingReceipt,
      state: 'Captured' as const,
      receivedMinor: 1250,
      completedAt: '2030-01-01T00:00:00Z',
      receiptExpiresAt: '2030-01-04T00:00:00Z',
    };
    const capturedOperation = operation('Captured', 3);
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(capturedOperation);
    const settledAccount: GuestAccountPaymentAccount = {
      ...account,
      outstandingMinor: 3750,
      availableMinor: 3750,
      capturedAccountPaymentMinor: 1250,
      outstandingAllocations: [
        { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 3750, amountMinor: 3750 },
      ],
      availableAllocations: [
        { orderId: ORDER_ID, orderItemId: null, startOrdinal: 1, unitCount: 1, minorPerUnit: 3750, amountMinor: 3750 },
      ],
    };
    jest
      .mocked(guestAccountPaymentService.getAccount)
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce(settledAccount);
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(capturedCheckout)
      .mockResolvedValueOnce(capturedCheckout)
      .mockResolvedValueOnce(capturedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(capturedReceipt)
      .mockResolvedValueOnce(capturedReceipt);

    const flowOptions = { ...options(), returnAttemptId: ATTEMPT_ID };
    const { result } = renderHook(() => useGuestAccountPaymentFlow(flowOptions));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.receipts[0]?.receipt).toMatchObject({ state: 'Processing', receivedMinor: 0 });
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(result.current.checkout).toMatchObject({ state: 'Processing', receivedMinor: 0 });
    expect(result.current.receipts[0]?.receipt).toMatchObject({ state: 'Processing', receivedMinor: 0 });

    await waitFor(() => expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(2), {
      timeout: 10_000,
    });
    expect(result.current.checkout).toMatchObject({ state: 'Processing', receivedMinor: 0 });
    expect(result.current.canReplaceAttempt).toBe(false);

    await waitFor(
      () => {
        expect(result.current.checkout).toMatchObject({ state: 'Captured', receivedMinor: 1250 });
        expect(result.current.receipts[0]?.receipt).toMatchObject({ state: 'Captured', receivedMinor: 1250 });
        expect(result.current.operation).toEqual(capturedOperation);
        expect(result.current.account).toEqual(settledAccount);
        expect(result.current.canReplaceAttempt).toBe(true);
      },
      { timeout: 15_000 },
    );

    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(4);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(4);
    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(3);
    expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(2);
    expect(flowOptions.onAccountUpdated).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 25_000);

  it('blocks replay during the poll delay and lets cancellation restart recovery without stale terminal publication', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const failedCheckout = { ...checkout(), state: 'Failed' as const, version: 3 };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const failedReceipt = { ...processingReceipt, state: 'Failed' as const };
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const capturedReceipt = {
      ...processingReceipt,
      state: 'Captured' as const,
      receivedMinor: 1250,
      completedAt: '2030-01-01T00:00:00Z',
      receiptExpiresAt: '2030-01-04T00:00:00Z',
    };
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(operation('Failed', 3))
      .mockResolvedValueOnce(operation('Failed', 3))
      .mockResolvedValue(operation('Captured', 2));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(failedCheckout)
      .mockResolvedValue(capturedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(failedReceipt)
      .mockResolvedValue(capturedReceipt);
    jest.mocked(guestAccountPaymentService.requestCancellation).mockResolvedValueOnce(failedCheckout);

    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(), returnAttemptId: ATTEMPT_ID }));
    await waitFor(() => expect(result.current.isRecoveryPolling).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.checkout).toEqual(processingCheckout);

    await act(async () => {
      expect(await result.current.startOrResumeCheckout()).toBe(false);
      expect(await result.current.refreshPaymentStatus()).toBe(false);
      expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1);
      expect(await result.current.requestCancellation()).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.checkout).toEqual(failedCheckout);
      expect(result.current.operation).toEqual(operation('Failed', 3));
      expect(result.current.isRecoveryPolling).toBe(false);
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2_100)));

    expect(result.current.checkout).toEqual(failedCheckout);
    expect(result.current.operation).toEqual(operation('Failed', 3));
    expect(guestAccountPaymentService.requestCancellation).toHaveBeenCalledWith(
      identity,
      expect.objectContaining({ operationId: OPERATION_ID }),
      processingCheckout.version,
    );
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(3);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('keeps a newer cancellation working while the prior recovery finishes', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const failedCheckout = { ...checkout(), state: 'Failed' as const, version: 3 };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const failedReceipt = { ...processingReceipt, state: 'Failed' as const };
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(operation('Failed', 3))
      .mockResolvedValueOnce(operation('Failed', 3));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(failedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(failedReceipt);

    let resolveSecondCancellation!: (value: GuestAccountCheckoutStatus) => void;
    jest
      .mocked(guestAccountPaymentService.requestCancellation)
      .mockResolvedValueOnce(failedCheckout)
      .mockImplementationOnce(
        () => new Promise<GuestAccountCheckoutStatus>((resolve) => (resolveSecondCancellation = resolve)),
      );

    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(), returnAttemptId: ATTEMPT_ID }));
    await waitFor(() => expect(result.current.isRecoveryPolling).toBe(true));
    let firstCancellation!: Promise<boolean>;
    await act(async () => {
      firstCancellation = result.current.requestCancellation();
    });
    await waitFor(() => {
      expect(guestAccountPaymentService.requestCancellation).toHaveBeenCalledTimes(1);
      expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2);
      expect(result.current.isRecoveryPolling).toBe(true);
    });

    let secondCancellation!: Promise<boolean>;
    await act(async () => {
      secondCancellation = result.current.requestCancellation();
    });
    await waitFor(() => {
      expect(guestAccountPaymentService.requestCancellation).toHaveBeenCalledTimes(2);
      expect(result.current.isCancellationWorking).toBe(true);
    });
    await act(async () => {
      expect(await firstCancellation).toBe(true);
    });
    expect(result.current.isCancellationWorking).toBe(true);

    await act(async () => {
      resolveSecondCancellation(failedCheckout);
      expect(await secondCancellation).toBe(true);
    });
    expect(result.current.checkout).toEqual(failedCheckout);
    expect(result.current.operation).toEqual(operation('Failed', 3));
    expect(result.current.isCancellationWorking).toBe(false);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('recovers a second contribution by its new attempt even when the old return hint remains mounted', async () => {
    await saveStartedPaymentAttempt();
    const oldCapturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const oldCapturedReceipt = {
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
    const newCapturedCheckout = {
      ...oldCapturedCheckout,
      attemptId: SECOND_ATTEMPT_ID,
      operationId: SECOND_OPERATION_ID,
    };
    const newCapturedReceipt = { ...oldCapturedReceipt, attemptId: SECOND_ATTEMPT_ID };
    const secondQuotedOperation = operation('Quoted', 1, SECOND_OPERATION_ID);
    const secondReservedOperation = operation('Reserved', 2, SECOND_OPERATION_ID);
    const secondCapturedOperation = operation('Captured', 3, SECOND_OPERATION_ID);
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Captured', 3))
      .mockResolvedValueOnce(operation('Captured', 3))
      .mockResolvedValueOnce(secondQuotedOperation)
      .mockResolvedValueOnce(secondCapturedOperation)
      .mockResolvedValueOnce(secondCapturedOperation);
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(oldCapturedCheckout)
      .mockResolvedValueOnce(newCapturedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(oldCapturedReceipt)
      .mockResolvedValueOnce(newCapturedReceipt);
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: secondQuotedOperation,
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'c'.repeat(64) },
    });
    jest.mocked(guestAccountPaymentService.reserve).mockResolvedValue(secondReservedOperation);
    jest.mocked(guestAccountPaymentService.startCheckout).mockResolvedValue(newCapturedCheckout);

    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(), returnAttemptId: ATTEMPT_ID }));
    await waitFor(() => expect(result.current.checkout).toEqual(oldCapturedCheckout));
    await waitFor(() => expect(result.current.canReplaceAttempt).toBe(true));

    jest.mocked(createPaymentOperationId).mockReturnValueOnce(SECOND_OPERATION_ID);
    await act(async () => {
      expect(
        await result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
      expect(await result.current.startOrResumeCheckout()).toBe(true);
    });

    expect(result.current.attempt).toMatchObject({
      operationId: SECOND_OPERATION_ID,
      attemptId: SECOND_ATTEMPT_ID,
    });
    expect(result.current.checkout).toEqual(newCapturedCheckout);
    expect(result.current.operation).toEqual(secondCapturedOperation);
    expect(result.current.receipts).toEqual([
      expect.objectContaining({ attemptId: SECOND_ATTEMPT_ID, receipt: newCapturedReceipt }),
    ]);
    expect(jest.mocked(guestAccountPaymentService.getOperation).mock.calls.map((call) => call[1].operationId)).toEqual([
      OPERATION_ID,
      OPERATION_ID,
      SECOND_OPERATION_ID,
      SECOND_OPERATION_ID,
      SECOND_OPERATION_ID,
    ]);
    expect(
      jest.mocked(guestAccountPaymentService.getCheckoutStatus).mock.calls.map((call) => call[1].operationId),
    ).toEqual([OPERATION_ID, SECOND_OPERATION_ID]);
    expect(guestAccountPaymentService.startCheckout).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('scopes a no-attempt-id recovery to its operation instead of the older return hint', async () => {
    await saveStartedPaymentAttempt();
    const oldCapturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const oldCapturedReceipt = {
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
    const secondQuotedOperation = operation('Quoted', 1, SECOND_OPERATION_ID);
    const secondFailedOperation = operation('Failed', 2, SECOND_OPERATION_ID);
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Captured', 3))
      .mockResolvedValueOnce(operation('Captured', 3))
      .mockResolvedValueOnce(secondFailedOperation)
      .mockResolvedValueOnce(secondFailedOperation);
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockResolvedValueOnce(oldCapturedCheckout);
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValueOnce(oldCapturedReceipt);
    jest.mocked(guestAccountPaymentService.createQuote).mockResolvedValue({
      operation: secondQuotedOperation,
      contribution: { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'e'.repeat(64) },
    });

    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(), returnAttemptId: ATTEMPT_ID }));
    await waitFor(() => expect(result.current.checkout).toEqual(oldCapturedCheckout));
    await waitFor(() => expect(result.current.canReplaceAttempt).toBe(true));

    jest.mocked(createPaymentOperationId).mockReturnValueOnce(SECOND_OPERATION_ID);
    await act(async () => {
      expect(
        await result.current.reviewContribution({
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        }),
      ).toBe(true);
      expect(await result.current.startOrResumeCheckout()).toBe(true);
    });

    expect(result.current.attempt).toMatchObject({ operationId: SECOND_OPERATION_ID, attemptId: null });
    expect(result.current.checkout).toBeNull();
    expect(result.current.operation).toEqual(secondFailedOperation);
    expect(result.current.receipts).toEqual([]);
    expect(jest.mocked(guestAccountPaymentService.getOperation).mock.calls.map((call) => call[1].operationId)).toEqual([
      OPERATION_ID,
      OPERATION_ID,
      SECOND_OPERATION_ID,
      SECOND_OPERATION_ID,
    ]);
    expect(
      jest.mocked(guestAccountPaymentService.getCheckoutStatus).mock.calls.map((call) => call[1].operationId),
    ).toEqual([OPERATION_ID]);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('does not publish a settled account read after the participant changes', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const capturedReceipt = {
      ...processingReceipt,
      state: 'Captured' as const,
      receivedMinor: 1250,
      completedAt: '2030-01-01T00:00:00Z',
    };
    const staleAccount = { ...account, outstandingMinor: 1000, availableMinor: 1000 };
    const nextParticipantAccount = { ...account, outstandingMinor: 4000, availableMinor: 4000 };
    let resolveStaleAccount!: (value: GuestAccountPaymentAccount) => void;
    const pendingStaleAccount = new Promise<GuestAccountPaymentAccount>((resolve) => {
      resolveStaleAccount = resolve;
    });
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Processing', 2))
      .mockResolvedValueOnce(operation('Captured', 3));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(capturedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockResolvedValueOnce(capturedReceipt);
    jest
      .mocked(guestAccountPaymentService.getAccount)
      .mockResolvedValueOnce(account)
      .mockImplementationOnce(() => pendingStaleAccount)
      .mockResolvedValueOnce(nextParticipantAccount);
    const flowOptions = { ...options(), returnAttemptId: ATTEMPT_ID };
    const otherIdentity = { ...identity, participantToken: 'another-participant-secret' };
    const { result, rerender } = renderHook(
      ({ activeIdentity }: { activeIdentity: TableGuestVisitIdentity | null }) =>
        useGuestAccountPaymentFlow({ ...flowOptions, activeIdentity }),
      { initialProps: { activeIdentity: identity } },
    );
    await waitFor(() => expect(result.current.account).toEqual(account));
    await waitFor(() => expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(2), { timeout: 5_000 });

    rerender({ activeIdentity: otherIdentity });
    await waitFor(() => expect(result.current.account).toEqual(nextParticipantAccount));
    await act(async () => {
      resolveStaleAccount(staleAccount);
      await pendingStaleAccount;
    });

    expect(result.current.account).toEqual(nextParticipantAccount);
    expect(flowOptions.onAccountUpdated).not.toHaveBeenCalled();
    expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(3);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('keeps the newest account read when an older same-identity response arrives later', async () => {
    let resolveInitialAccount!: (value: GuestAccountPaymentAccount) => void;
    const pendingInitialAccount = new Promise<GuestAccountPaymentAccount>((resolve) => {
      resolveInitialAccount = resolve;
    });
    const refreshedAccount = { ...account, outstandingMinor: 3200, availableMinor: 3200 };
    const staleAccount = { ...account, outstandingMinor: 4100, availableMinor: 4100 };
    jest
      .mocked(guestAccountPaymentService.getAccount)
      .mockImplementationOnce(() => pendingInitialAccount)
      .mockResolvedValueOnce(refreshedAccount);

    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(1));
    const initialAccountSignal = jest.mocked(guestAccountPaymentService.getAccount).mock.calls[0]?.[1];
    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(initialAccountSignal).toBeInstanceOf(AbortSignal);
    expect(initialAccountSignal?.aborted).toBe(true);
    expect(result.current.account).toEqual(refreshedAccount);

    await act(async () => {
      resolveInitialAccount(staleAccount);
      await pendingInitialAccount;
    });

    expect(result.current.account).toEqual(refreshedAccount);
    expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(2);
  });

  it('does not publish an account or clear the timeout error when an aborted read resolves late', async () => {
    jest.useFakeTimers();
    let resolveAccount!: (value: GuestAccountPaymentAccount) => void;
    const pendingAccount = new Promise<GuestAccountPaymentAccount>((resolve) => {
      resolveAccount = resolve;
    });
    jest.mocked(guestAccountPaymentService.getAccount).mockReturnValueOnce(pendingAccount);

    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    const requestSignal = jest.mocked(guestAccountPaymentService.getAccount).mock.calls[0]?.[1];
    expect(requestSignal).toBeInstanceOf(AbortSignal);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(GUEST_ACCOUNT_READ_TIMEOUT_MS);
    });

    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.isAccountLoading).toBe(false);
    expect(result.current.error).toBe('load');

    await act(async () => {
      resolveAccount(account);
      await pendingAccount;
    });

    expect(result.current.account).toBeNull();
    expect(result.current.isAccountLoading).toBe(false);
    expect(result.current.error).toBe('load');
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('aborts a hung recovery GET at its deadline and leaves the status action available', async () => {
    await saveStartedPaymentAttempt();
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    jest.mocked(guestAccountPaymentService.getOperation).mockImplementation(
      (_identity, _descriptor, signal) =>
        new Promise((_resolve, reject) => {
          requestSignal = signal;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }),
    );

    const { result } = renderHook(() => useGuestAccountPaymentFlow({ ...options(false), returnAttemptId: ATTEMPT_ID }));
    await waitFor(() => expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(1));
    expect(requestSignal?.aborted).toBe(false);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(GUEST_PAYMENT_RECOVERY_MAX_DURATION_MS);
    });

    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('load');
    expect(result.current.returnReceiptUnavailable).toBe(true);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('keeps confirmed capture visible when the balance refresh fails', async () => {
    await saveStartedPaymentAttempt();
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const capturedReceipt = {
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
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(operation('Captured', 3));
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockResolvedValue(capturedCheckout);
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValue(capturedReceipt);
    jest
      .mocked(guestAccountPaymentService.getAccount)
      .mockResolvedValueOnce(account)
      .mockRejectedValueOnce(new Error('balance unavailable'));
    const flowOptions = { ...options(), returnAttemptId: ATTEMPT_ID };
    const { result } = renderHook(() => useGuestAccountPaymentFlow(flowOptions));

    await waitFor(() => {
      expect(result.current.checkout).toEqual(capturedCheckout);
      expect(result.current.operation).toEqual(operation('Captured', 3));
      expect(result.current.error).toBe('load');
    });

    expect(result.current.account).toEqual(account);
    expect(result.current.canReplaceAttempt).toBe(true);
    expect(flowOptions.onAccountUpdated).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it('preserves a recovery error when the initial account read succeeds afterward', async () => {
    await saveStartedPaymentAttempt();
    let resolveInitialAccount!: (value: GuestAccountPaymentAccount) => void;
    const pendingInitialAccount = new Promise<GuestAccountPaymentAccount>((resolve) => {
      resolveInitialAccount = resolve;
    });
    jest.mocked(guestAccountPaymentService.getOperation).mockRejectedValueOnce(new Error('status unavailable'));
    jest.mocked(guestAccountPaymentService.getAccount).mockImplementationOnce(() => pendingInitialAccount);
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));

    await waitFor(() => expect(result.current.error).toBe('load'));
    await act(async () => {
      resolveInitialAccount(account);
      await pendingInitialAccount;
    });

    expect(result.current.account).toEqual(account);
    expect(result.current.error).toBe('load');
    expect(guestAccountPaymentService.getAccount).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

  it.each(['Failed', 'Released'] as const)(
    'waits for a matching %s receipt before publishing terminal status',
    async (state) => {
      await saveStartedPaymentAttempt();
      const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
      const terminalCheckout = { ...checkout(), state, version: 3 };
      const processingReceipt = {
        attemptId: ATTEMPT_ID,
        amountMinor: 1250,
        currency: 'CHF',
        state: 'Processing' as const,
        receivedMinor: 0,
        refundedMinor: 0,
        reconciliationRequired: false,
        completedAt: null,
        receiptExpiresAt: null,
      };
      const terminalReceipt = {
        ...processingReceipt,
        state,
        completedAt: '2030-01-01T00:00:00Z',
        receiptExpiresAt: '2030-01-04T00:00:00Z',
      };
      jest
        .mocked(guestAccountPaymentService.getOperation)
        .mockResolvedValueOnce(operation('Processing', 2))
        .mockResolvedValueOnce(operation(state, 3));
      jest
        .mocked(guestAccountPaymentService.getCheckoutStatus)
        .mockResolvedValueOnce(processingCheckout)
        .mockResolvedValueOnce(terminalCheckout)
        .mockResolvedValueOnce(terminalCheckout);
      jest
        .mocked(guestAccountPaymentService.getReceipt)
        .mockResolvedValueOnce(processingReceipt)
        .mockResolvedValueOnce(processingReceipt)
        .mockResolvedValueOnce(terminalReceipt);

      const { result } = renderHook(() =>
        useGuestAccountPaymentFlow({ ...options(false), returnAttemptId: ATTEMPT_ID }),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await waitFor(() => expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2), { timeout: 7_500 });
      await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(result.current.checkout).toMatchObject({ state: 'Processing' });
      expect(result.current.returnReceiptUnavailable).toBe(false);

      await waitFor(
        () => {
          expect(result.current.checkout).toMatchObject({ state });
          expect(result.current.receipts[0]?.receipt).toMatchObject({ state });
        },
        { timeout: 7_000 },
      );

      expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(3);
      expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(3);
      expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
    },
    10_000,
  );

  it('marks a terminal return unavailable after all bounded reads fail to match its receipt', async () => {
    await saveStartedPaymentAttempt();
    const descriptor = readGuestAccountPaymentAttempts();
    if (descriptor.kind !== 'ready') throw new Error('test payment attempt is unavailable');
    const attempt = descriptor.attempts[0];
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const capturedCheckout = {
      ...checkout(),
      state: 'Captured' as const,
      version: 3,
      receivedMinor: 1250,
    };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(operation('Processing', 2));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValue(capturedCheckout);
    const checkoutUpdates: GuestAccountCheckoutStatus[] = [];
    const receiptReads = jest.fn(async () => processingReceipt);
    const delays: number[] = [];
    const markUnavailable = jest.fn();
    await recoverActivePayment(attempt, identity, ATTEMPT_ID, {
      isCurrent: () => true,
      setOperation: jest.fn(),
      setCheckout: (value) => checkoutUpdates.push(value),
      setError: jest.fn(),
      setReturnReceiptUnavailable: markUnavailable,
      setIsLoading: jest.fn(),
      setIsRecoveryPolling: jest.fn(),
      fetchReceipt: receiptReads,
      publishReceipt: jest.fn(),
      saveUpdatedDescriptor: () => true,
      setStorageUnavailable: jest.fn(),
      runExclusive: async <T,>(read: () => Promise<T>, _blocked: T) => read(),
      waitForNextPoll: async (delayMs) => {
        delays.push(delayMs);
        return true;
      },
    });

    expect(checkoutUpdates).toEqual([processingCheckout]);
    expect(markUnavailable).toHaveBeenCalledWith(true);
    expect(receiptReads).toHaveBeenCalledTimes(8);
    expect(delays).toEqual([2_000, 4_000, 8_000, 16_000, 20_000, 25_000, 30_000]);
    expect(delays.reduce((total, delay) => total + delay, 0)).toBe(105_000);
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(8);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('polls a discovered attempt for an operation-scoped recovery with no attempt id', async () => {
    await saveStartedPaymentAttempt();
    const participantFingerprint = await fingerprintGuestParticipant(identity.participantToken);
    if (!participantFingerprint) throw new Error('test participant fingerprint is unavailable');
    const secondQuoted = withQuotedOperation(
      createGuestAccountPaymentDescriptor(
        SESSION_ID,
        SECOND_OPERATION_ID,
        {
          expectedAccountRevision: 7,
          mode: 'Amount',
          paymentMethod: 'OnlinePayment',
          amountMinor: 1250,
        },
        participantFingerprint,
      ),
      1,
      { amountMinor: 1250, currency: 'CHF', snapshotFingerprint: 'f'.repeat(64) },
    );
    const secondStarted = withStartRequested(withReservation(secondQuoted, 2, 'B'.repeat(43)));
    expect(saveGuestAccountPaymentAttempt(secondStarted)).toBe(true);

    const discoveredAttemptId = SECOND_ATTEMPT_ID;
    const processingCheckout = {
      ...checkout(),
      attemptId: discoveredAttemptId,
      operationId: SECOND_OPERATION_ID,
      state: 'Processing' as const,
      version: 2,
    };
    const capturedCheckout = {
      ...processingCheckout,
      state: 'Captured' as const,
      version: 3,
      receivedMinor: 1250,
    };
    const processingReceipt = {
      attemptId: discoveredAttemptId,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    const capturedReceipt = {
      ...processingReceipt,
      state: 'Captured' as const,
      receivedMinor: 1250,
      completedAt: '2030-01-01T00:00:00Z',
      receiptExpiresAt: '2030-01-04T00:00:00Z',
    };
    jest
      .mocked(guestAccountPaymentService.getOperation)
      .mockResolvedValueOnce(operation('Processing', 2, SECOND_OPERATION_ID))
      .mockResolvedValueOnce(operation('Captured', 3, SECOND_OPERATION_ID));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(capturedCheckout);
    const receiptReads = jest.fn().mockResolvedValueOnce(processingReceipt).mockResolvedValueOnce(capturedReceipt);
    const checkoutUpdates: GuestAccountCheckoutStatus[] = [];
    const operationUpdates: GuestAccountPaymentOperation[] = [];
    const pollStates: boolean[] = [];
    const delays: number[] = [];

    await recoverActivePayment(secondStarted, identity, null, {
      isCurrent: () => true,
      setOperation: (value) => operationUpdates.push(value),
      setCheckout: (value) => checkoutUpdates.push(value),
      setError: jest.fn(),
      setReturnReceiptUnavailable: jest.fn(),
      setIsLoading: jest.fn(),
      setIsRecoveryPolling: (value) => pollStates.push(value),
      pollWithoutReturnHint: true,
      fetchReceipt: receiptReads,
      publishReceipt: jest.fn(),
      saveUpdatedDescriptor: () => true,
      setStorageUnavailable: jest.fn(),
      runExclusive: async <T,>(read: () => Promise<T>, _blocked: T) => read(),
      waitForNextPoll: async (delayMs) => {
        delays.push(delayMs);
        return true;
      },
    });

    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2);
    expect(
      jest.mocked(guestAccountPaymentService.getCheckoutStatus).mock.calls.map((call) => call[1].operationId),
    ).toEqual([SECOND_OPERATION_ID, SECOND_OPERATION_ID]);
    expect(receiptReads.mock.calls.map((call) => call[1])).toEqual([discoveredAttemptId, discoveredAttemptId]);
    expect(delays).toEqual([2_000]);
    expect(checkoutUpdates).toEqual([processingCheckout, capturedCheckout]);
    expect(operationUpdates).toEqual([
      operation('Processing', 2, SECOND_OPERATION_ID),
      operation('Captured', 3, SECOND_OPERATION_ID),
    ]);
    expect(pollStates).toEqual([true, false]);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('does not mark a new recovery unavailable when a superseded operation read fails', async () => {
    await saveStartedPaymentAttempt();
    const stored = readGuestAccountPaymentAttempts();
    if (stored.kind !== 'ready') throw new Error('test payment attempt is unavailable');
    jest.mocked(guestAccountPaymentService.getOperation).mockRejectedValueOnce(new Error('old read failed'));
    const markUnavailable = jest.fn();
    const setError = jest.fn();
    await recoverActivePayment(stored.attempts[0], identity, '00000000-0000-4000-8000-000000000099', {
      isCurrent: () => false,
      setOperation: jest.fn(),
      setCheckout: jest.fn(),
      setError,
      setReturnReceiptUnavailable: markUnavailable,
      setIsLoading: jest.fn(),
      setIsRecoveryPolling: jest.fn(),
      fetchReceipt: jest.fn().mockResolvedValue(null),
      publishReceipt: jest.fn(),
      saveUpdatedDescriptor: () => true,
      setStorageUnavailable: jest.fn(),
      runExclusive: async <T,>(_read: () => Promise<T>, blocked: T) => blocked,
      waitForNextPoll: async () => false,
    });

    expect(markUnavailable).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('cancels a pending return poll when the active participant changes', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(operation('Processing', 2));
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockResolvedValue(processingCheckout);
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
    const otherIdentity = { ...identity, participantToken: 'another-participant-secret' };
    const returnOptions = { ...options(false), returnAttemptId: ATTEMPT_ID };
    const { result, rerender } = renderHook(
      ({ activeIdentity }: { activeIdentity: TableGuestVisitIdentity | null }) =>
        useGuestAccountPaymentFlow({ ...returnOptions, activeIdentity }),
      { initialProps: { activeIdentity: identity } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1);

    rerender({ activeIdentity: otherIdentity });
    await waitFor(() => expect(result.current.returnReceiptUnavailable).toBe(true));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2_100)));

    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('ignores a status read whose receipt finishes after the participant changes', async () => {
    await saveStartedPaymentAttempt();
    const processingCheckout = { ...checkout(), state: 'Processing' as const, version: 2 };
    const refreshedCheckout = { ...processingCheckout, version: 3 };
    const processingReceipt = {
      attemptId: ATTEMPT_ID,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Processing' as const,
      receivedMinor: 0,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: null,
      receiptExpiresAt: null,
    };
    let resolveReceipt!: (receipt: typeof processingReceipt) => void;
    const pendingReceipt = new Promise<typeof processingReceipt>((resolve) => {
      resolveReceipt = resolve;
    });
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(operation('Processing', 2));
    jest
      .mocked(guestAccountPaymentService.getCheckoutStatus)
      .mockResolvedValueOnce(processingCheckout)
      .mockResolvedValueOnce(refreshedCheckout);
    jest
      .mocked(guestAccountPaymentService.getReceipt)
      .mockResolvedValueOnce(processingReceipt)
      .mockImplementationOnce(() => pendingReceipt);

    const returnOptions = { ...options(false), returnAttemptId: ATTEMPT_ID };
    const otherIdentity = { ...identity, participantToken: 'another-participant-secret' };
    const { result, rerender } = renderHook(
      ({ activeIdentity }: { activeIdentity: TableGuestVisitIdentity | null }) =>
        useGuestAccountPaymentFlow({ ...returnOptions, activeIdentity }),
      { initialProps: { activeIdentity: identity } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2), {
      timeout: 5_000,
    });
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(2);
    const staleReceiptSignal = jest.mocked(guestAccountPaymentService.getReceipt).mock.calls[1]?.[3];
    expect(staleReceiptSignal).toBeInstanceOf(AbortSignal);

    rerender({ activeIdentity: otherIdentity });
    expect(staleReceiptSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.returnReceiptUnavailable).toBe(true));
    await act(async () => {
      resolveReceipt(processingReceipt);
      await pendingReceipt;
    });

    expect(result.current.checkout).toBeNull();
    expect(result.current.receipts).toEqual([]);
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  }, 10_000);

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
      expect.any(AbortSignal),
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
      expect.any(AbortSignal),
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
        expect.any(AbortSignal),
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
      expect.any(AbortSignal),
    );
    expect(guestAccountPaymentService.getOperation).not.toHaveBeenCalled();
    expect(guestAccountPaymentService.getCheckoutStatus).not.toHaveBeenCalled();
  });

  it('keeps manual status refresh processing until checkout, receipt, and operation agree', async () => {
    await saveStartedPaymentAttempt();
    const processingOperation = operation('Processing', 2);
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const capturedReceipt = {
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
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(processingOperation);
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockResolvedValue(capturedCheckout);
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValue(capturedReceipt);
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.mocked(guestAccountPaymentService.getOperation).mockClear();
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockClear();
    jest.mocked(guestAccountPaymentService.getReceipt).mockClear();
    await act(async () => {
      expect(await result.current.refreshPaymentStatus()).toBe(true);
    });

    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(2);
    expect(guestAccountPaymentService.getCheckoutStatus).toHaveBeenCalledTimes(1);
    expect(guestAccountPaymentService.getReceipt).toHaveBeenCalledTimes(1);
    expect(result.current.operation).toEqual(processingOperation);
    expect(result.current.checkout).toBeNull();
    expect(result.current.receipts).toEqual([]);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
  });

  it('does not publish a terminal receipt when its authoritative operation revision differs', async () => {
    await saveStartedPaymentAttempt();
    const staleOperation = operation('Captured', 2);
    const capturedCheckout = { ...checkout(), state: 'Captured' as const, version: 3, receivedMinor: 1250 };
    const capturedReceipt = {
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
    jest.mocked(guestAccountPaymentService.getOperation).mockResolvedValue(staleOperation);
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockResolvedValue(capturedCheckout);
    jest.mocked(guestAccountPaymentService.getReceipt).mockResolvedValue(capturedReceipt);
    const { result } = renderHook(() => useGuestAccountPaymentFlow(options()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    jest.mocked(guestAccountPaymentService.getOperation).mockClear();
    jest.mocked(guestAccountPaymentService.getCheckoutStatus).mockClear();
    jest.mocked(guestAccountPaymentService.getReceipt).mockClear();
    await act(async () => {
      expect(await result.current.refreshPaymentStatus()).toBe(true);
    });

    expect(guestAccountPaymentService.getOperation).toHaveBeenCalledTimes(2);
    expect(result.current.operation).toBeNull();
    expect(result.current.checkout).toBeNull();
    expect(result.current.receipts).toEqual([]);
    expect(guestAccountPaymentService.startCheckout).not.toHaveBeenCalled();
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
