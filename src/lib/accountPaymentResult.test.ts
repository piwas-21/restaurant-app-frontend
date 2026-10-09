import { accountPaymentResultTransition } from './accountPaymentResult';
import type { AccountCashReceipt, AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountEqualSharePlan, AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';

const actor = '11111111-1111-4111-8111-111111111111';
const visit = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const saved: PendingAccountPayment = {
  actorId: actor,
  serviceSessionId: visit,
  kind: 'payment',
  stage: 'collecting',
  expectedVersion: 2,
  currency: 'EUR',
  request: {
    operationId,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'CreditCard',
    amountMinor: 29,
  },
};
const result: AccountPaymentOperation = {
  serviceSessionId: visit,
  operationId,
  state: 'Reserved',
  version: 3,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'CreditCard',
  amountMinor: 29,
  currency: 'EUR',
  quoteExpiresAt: '2026-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: null,
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
};
const cashSettlement: AccountCashSettlement = {
  policyVersion: 'exact-v1',
  currency: 'EUR',
  paymentMethod: 'Cash',
  exactAmountMinor: 29,
  adjustmentMinor: 0,
  dueAmountMinor: 29,
};
const cashReceipt: AccountCashReceipt = {
  policyVersion: cashSettlement.policyVersion,
  currency: cashSettlement.currency,
  exactAmountMinor: cashSettlement.exactAmountMinor,
  adjustmentMinor: cashSettlement.adjustmentMinor,
  dueAmountMinor: cashSettlement.dueAmountMinor,
  receivedMinor: 35,
  changeMinor: 6,
  capturedAt: '2026-10-03T12:00:00Z',
};
const cashPending: PendingAccountPayment = {
  actorId: actor,
  serviceSessionId: visit,
  kind: 'payment',
  stage: 'collecting',
  expectedVersion: 2,
  currency: 'EUR',
  cashIntent: {
    operationId,
    serviceSessionId: visit,
    expectedVersion: 2,
    receivedMinor: 35,
    settlement: cashSettlement,
  },
  request: {
    operationId,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'Cash',
    amountMinor: 29,
  },
};
const capturedCash: AccountPaymentOperation = {
  ...result,
  state: 'Captured',
  version: 3,
  paymentMethod: 'Cash',
  cashSettlement,
  cashReceipt,
  allocations: [
    {
      orderId: '44444444-4444-4444-8444-444444444444',
      orderItemId: null,
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 29,
      amountMinor: 29,
    },
  ],
};

it('retains the original collection version after card status lookup', () => {
  expect(accountPaymentResultTransition(saved, result, visit, 'mismatch', 'EUR')).toMatchObject({
    terminal: false,
    pending: { stage: 'collecting', expectedVersion: 2, currency: 'EUR', request: saved.request },
  });
});

it.each(['Captured', 'Released', 'Failed'] as const)(
  'clears only an authoritative %s card result for the same operation',
  (state) => {
    expect(accountPaymentResultTransition(saved, { ...result, state }, visit, 'mismatch', 'EUR')).toMatchObject({
      terminal: true,
      operation: { state },
    });
  },
);

it.each([
  { operationId: '44444444-4444-4444-8444-444444444444' },
  { serviceSessionId: '44444444-4444-4444-8444-444444444444' },
  { amountMinor: 30 },
  { expectedAccountRevision: 8 },
  { paymentMethod: 'Cash' },
  { currency: 'CHF' },
  { version: 0 },
  { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
] as Partial<AccountPaymentOperation>[])('rejects a mismatched result before clearing', (different) => {
  expect(() => accountPaymentResultTransition(saved, { ...result, ...different }, visit, 'mismatch', 'EUR')).toThrow(
    'mismatch',
  );
});

it('clears a cash capture only when its receipt matches the saved tender intent', () => {
  expect(accountPaymentResultTransition(cashPending, capturedCash, visit, 'mismatch', 'EUR')).toMatchObject({
    terminal: true,
    operation: { state: 'Captured', cashReceipt },
  });
});

it.each([
  { cashReceipt: { ...cashReceipt, receivedMinor: 36, changeMinor: 7 } },
  { cashReceipt: { ...cashReceipt, capturedAt: '2026-10-03T12:00:00Z' }, version: 4 },
  { cashSettlement: { ...cashSettlement, dueAmountMinor: 30 } },
])('preserves the original cash descriptor when a capture does not match it', (different) => {
  const transition = accountPaymentResultTransition(
    cashPending,
    { ...capturedCash, ...different } as AccountPaymentOperation,
    visit,
    'mismatch',
    'EUR',
  );
  expect(transition).toEqual({ terminal: false, operation: { ...capturedCash, ...different }, pending: cashPending });
});

it('keeps a legacy cash capture without frozen intent visible as unattested recovery', () => {
  const legacy: PendingAccountPayment = { ...cashPending, cashIntent: undefined };
  expect(accountPaymentResultTransition(legacy, capturedCash, visit, 'mismatch', 'EUR')).toEqual({
    terminal: false,
    operation: capturedCash,
    pending: legacy,
  });
});

it('retains provider-unknown holds for reconciliation', () => {
  expect(
    accountPaymentResultTransition(saved, { ...result, state: 'ReconciliationRequired' }, visit, 'mismatch', 'EUR'),
  ).toMatchObject({ terminal: false, pending: { stage: 'collecting', expectedVersion: 2 } });
});

it('checks the reviewed share count, revision and visit currency before clearing a plan', () => {
  const request = { operationId, expectedAccountRevision: 7, shareCount: 3 };
  const planPending: PendingAccountPayment = { actorId: actor, serviceSessionId: visit, kind: 'plan', request };
  const plan: AccountEqualSharePlan = {
    serviceSessionId: visit,
    operationId,
    planId: '55555555-5555-4555-8555-555555555555',
    accountRevision: 7,
    totalMinor: 1000,
    shareCount: 3,
    currency: 'EUR',
    createdAt: '2026-10-03T00:00:00Z',
    invalidatedAt: null,
    scope: [],
  };
  expect(accountPaymentResultTransition(planPending, plan, visit, 'mismatch', 'EUR')).toEqual({
    terminal: true,
    operation: null,
  });
  expect(() =>
    accountPaymentResultTransition(planPending, { ...plan, shareCount: 4 }, visit, 'mismatch', 'EUR'),
  ).toThrow();
  expect(() =>
    accountPaymentResultTransition(planPending, { ...plan, currency: 'CHF' }, visit, 'mismatch', 'EUR'),
  ).toThrow();
});

it('requires a recovered custom plan to match the exact saved guest amounts', () => {
  const request = {
    operationId,
    expectedAccountRevision: 7,
    shareCount: 2,
    customAmountsMinor: [1440, 60],
  };
  const pending: PendingAccountPayment = { actorId: actor, serviceSessionId: visit, kind: 'plan', request };
  const plan: AccountEqualSharePlan = {
    serviceSessionId: visit,
    operationId,
    planId: '55555555-5555-4555-8555-555555555555',
    accountRevision: 7,
    totalMinor: 1500,
    shareCount: 2,
    currency: 'EUR',
    createdAt: '2026-10-03T00:00:00Z',
    invalidatedAt: null,
    scope: [],
    customAmountsMinor: [1440, 60],
  };
  expect(accountPaymentResultTransition(pending, plan, visit, 'mismatch', 'EUR')).toEqual({
    terminal: true,
    operation: null,
  });
  expect(() =>
    accountPaymentResultTransition(pending, { ...plan, customAmountsMinor: [1439, 61] }, visit, 'mismatch', 'EUR'),
  ).toThrow('mismatch');
  expect(() =>
    accountPaymentResultTransition(pending, { ...plan, customAmountsMinor: null }, visit, 'mismatch', 'EUR'),
  ).toThrow('mismatch');
});
