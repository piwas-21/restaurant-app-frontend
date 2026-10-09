import {
  clearPendingAccountPayment,
  persistPendingAccountPayment,
  readPendingAccountPayment,
} from './pendingAccountPayment';
import type { PendingAccountPayment } from './pendingAccountPayment';

const actorId = '11111111-1111-4111-8111-111111111111';
const serviceSessionId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const cashIntent = {
  operationId,
  serviceSessionId,
  expectedVersion: 2,
  receivedMinor: 35,
  settlement: {
    policyVersion: 'exact-v1' as const,
    currency: 'EUR',
    paymentMethod: 'Cash' as const,
    exactAmountMinor: 29,
    adjustmentMinor: 0,
    dueAmountMinor: 29,
  },
};
const payment: PendingAccountPayment = {
  actorId,
  serviceSessionId,
  kind: 'payment',
  stage: 'collecting',
  expectedVersion: 2,
  request: { operationId, expectedAccountRevision: 7, mode: 'Amount', paymentMethod: 'Cash', amountMinor: 29 },
};

beforeEach(() => {
  window.sessionStorage.clear();
  jest.restoreAllMocks();
});

it('retains the original reviewed operation across a lost response and never expires a hold locally', () => {
  expect(persistPendingAccountPayment(payment)).toBe(true);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'pending', value: payment });
  expect(clearPendingAccountPayment(actorId, serviceSessionId, '44444444-4444-4444-8444-444444444444')).toBe(false);
  expect(readPendingAccountPayment(actorId, serviceSessionId).status).toBe('pending');
  expect(clearPendingAccountPayment(actorId, serviceSessionId, operationId)).toBe(true);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'none' });
});

it('isolates a prior actor and table visit rather than replaying their operation', () => {
  persistPendingAccountPayment(payment);
  expect(readPendingAccountPayment('55555555-5555-4555-8555-555555555555', serviceSessionId)).toEqual({
    status: 'none',
  });
  expect(readPendingAccountPayment(actorId, '66666666-6666-4666-8666-666666666666')).toEqual({ status: 'none' });
});

it('fails closed on corrupt or unavailable storage before sending money writes', () => {
  window.sessionStorage.setItem(`sofra.account-payment.${actorId}.${serviceSessionId}`, '{broken');
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'unavailable' });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage denied');
  });
  expect(persistPendingAccountPayment(payment)).toBe(false);
});

it('rejects added guest names, free notes, or provider credentials in a descriptor', () => {
  expect(
    persistPendingAccountPayment({ ...payment, customerEmail: 'private@example.invalid' } as PendingAccountPayment),
  ).toBe(false);
  expect(window.sessionStorage).toHaveLength(0);
});

it('treats an existing empty descriptor as corruption instead of an absent operation', () => {
  window.sessionStorage.setItem(`sofra.account-payment.${actorId}.${serviceSessionId}`, '');
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'unavailable' });
});

it.each(['review', 'reserving', 'reserved', 'collecting', 'releasing'] as const)(
  'fails closed when a %s recovery descriptor omits its expected operation version',
  (stage) => {
    const malformed = { ...payment, stage } as Record<string, unknown>;
    delete malformed.expectedVersion;
    window.sessionStorage.setItem(`sofra.account-payment.${actorId}.${serviceSessionId}`, JSON.stringify(malformed));
    expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'unavailable' });
  },
);

it.each(['review', 'reserving', 'reserved', 'collecting', 'releasing'] as const)(
  'rejects a non-positive expected version for the %s recovery stage before storage',
  (stage) => {
    const malformed = { ...payment, stage, expectedVersion: 0 } as PendingAccountPayment;
    expect(persistPendingAccountPayment(malformed)).toBe(false);
    expect(window.sessionStorage).toHaveLength(0);
  },
);

it('keeps the initial quote stage valid without an expected version', () => {
  const initialQuote: PendingAccountPayment = {
    actorId,
    serviceSessionId,
    kind: 'payment',
    stage: 'quote',
    request: payment.request,
  };
  expect(persistPendingAccountPayment(initialQuote)).toBe(true);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'pending', value: initialQuote });
});

it('refuses overwriting an escaped operation or changing its frozen request', () => {
  expect(persistPendingAccountPayment(payment)).toBe(true);
  const replacement = {
    ...payment,
    request: { ...payment.request, operationId: '44444444-4444-4444-8444-444444444444' },
  };
  expect(persistPendingAccountPayment(replacement)).toBe(false);
  expect(persistPendingAccountPayment({ ...payment, request: { ...payment.request, amountMinor: 30 } })).toBe(false);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'pending', value: payment });
});

it('stores the frozen cash intent and refuses changing its terms or received amount', () => {
  const collected = { ...payment, currency: 'EUR', cashIntent };
  expect(persistPendingAccountPayment(collected)).toBe(true);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'pending', value: collected });
  expect(persistPendingAccountPayment({ ...collected, cashIntent: { ...cashIntent, receivedMinor: 36 } })).toBe(false);
  expect(
    persistPendingAccountPayment({
      ...collected,
      cashIntent: { ...cashIntent, settlement: { ...cashIntent.settlement, dueAmountMinor: 30 } },
    }),
  ).toBe(false);
  expect(readPendingAccountPayment(actorId, serviceSessionId)).toEqual({ status: 'pending', value: collected });
});

it('rejects a cash intent attached to a card descriptor', () => {
  const cardWithCash = {
    ...payment,
    request: { ...payment.request, paymentMethod: 'CreditCard' as const },
    cashIntent,
  } as unknown as PendingAccountPayment;
  expect(persistPendingAccountPayment(cardWithCash)).toBe(false);
  expect(window.sessionStorage).toHaveLength(0);
});
