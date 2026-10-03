import { accountPaymentResultTransition } from './accountPaymentResult';
import type { AccountEqualSharePlan, AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';

const visit = '22222222-2222-4222-8222-222222222222';
const saved: PendingAccountPayment = {
  actorId: '11111111-1111-4111-8111-111111111111',
  serviceSessionId: visit,
  kind: 'payment',
  stage: 'collecting',
  expectedVersion: 2,
  request: {
    operationId: '33333333-3333-4333-8333-333333333333',
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'Cash',
    amountMinor: 29,
  },
};
const result: AccountPaymentOperation = {
  serviceSessionId: visit,
  operationId: saved.request.operationId,
  state: 'Reserved',
  version: 3,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 29,
  currency: 'EUR',
  quoteExpiresAt: '2026-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: null,
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
};

it('retains the original collection version after lookup so an unknown write is retried unchanged', () => {
  expect(accountPaymentResultTransition(saved, result, visit, 'mismatch')).toMatchObject({
    terminal: false,
    pending: { stage: 'collecting', expectedVersion: 2, request: saved.request },
  });
});

it.each(['Captured', 'Released', 'Failed'] as const)(
  'clears only an authoritative %s result for the same operation',
  (state) => {
    expect(accountPaymentResultTransition(saved, { ...result, state }, visit, 'mismatch')).toMatchObject({
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
  { paymentMethod: 'CreditCard' },
  { version: 0 },
  { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
] as Partial<AccountPaymentOperation>[])(
  'rejects a mismatched result before permitting descriptor clearing',
  (different) => {
    expect(() => accountPaymentResultTransition(saved, { ...result, ...different }, visit, 'mismatch')).toThrow(
      'mismatch',
    );
  },
);

it('retains provider-unknown holds for reconciliation', () => {
  expect(
    accountPaymentResultTransition(saved, { ...result, state: 'ReconciliationRequired' }, visit, 'mismatch'),
  ).toMatchObject({ terminal: false, pending: { stage: 'collecting', expectedVersion: 2 } });
});

it('checks the reviewed share count and revision before clearing a recovered plan operation', () => {
  const request = { operationId: saved.request.operationId, expectedAccountRevision: 7, shareCount: 3 };
  const planPending: PendingAccountPayment = { actorId: saved.actorId, serviceSessionId: visit, kind: 'plan', request };
  const plan: AccountEqualSharePlan = {
    serviceSessionId: visit,
    operationId: request.operationId,
    planId: '55555555-5555-4555-8555-555555555555',
    accountRevision: 7,
    totalMinor: 1000,
    shareCount: 3,
    currency: 'EUR',
    createdAt: '2026-10-03T00:00:00Z',
    invalidatedAt: null,
    scope: [],
  };
  expect(accountPaymentResultTransition(planPending, plan, visit, 'mismatch')).toEqual({
    terminal: true,
    operation: null,
  });
  expect(() => accountPaymentResultTransition(planPending, { ...plan, shareCount: 4 }, visit, 'mismatch')).toThrow();
  expect(() =>
    accountPaymentResultTransition(planPending, { ...plan, accountRevision: 8 }, visit, 'mismatch'),
  ).toThrow();
});
