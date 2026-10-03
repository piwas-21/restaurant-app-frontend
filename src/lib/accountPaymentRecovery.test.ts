import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import { canReleaseAccountPaymentRecovery } from './accountPaymentRecovery';

const actorId = '11111111-1111-4111-8111-111111111111';
const serviceSessionId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const pending: PendingAccountPayment = {
  actorId,
  serviceSessionId,
  kind: 'payment',
  stage: 'reserved',
  expectedVersion: 2,
  request: {
    operationId,
    expectedAccountRevision: 7,
    mode: 'Amount',
    paymentMethod: 'Cash',
    amountMinor: 29,
  },
};
const operation: AccountPaymentOperation = {
  serviceSessionId,
  operationId,
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 7,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 29,
  currency: 'EUR',
  quoteExpiresAt: '2099-10-03T00:00:00Z',
  reservedAt: null,
  reservationExpiresAt: '2099-10-03T00:00:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
};

function canRelease(
  actor = actorId,
  visit = serviceSessionId,
  saved: PendingAccountPayment | null = pending,
  current: AccountPaymentOperation | null = operation,
  recoveryEnabled = true,
  busy = false,
  storageUnavailable = false,
) {
  return canReleaseAccountPaymentRecovery(actor, visit, saved, current, recoveryEnabled, busy, storageUnavailable);
}

it('allows only the matching actor, visit and operation in a Quoted or Reserved state', () => {
  expect(canRelease()).toBe(true);
  expect(canRelease(actorId.toUpperCase(), serviceSessionId.toUpperCase())).toBe(true);
  expect(canRelease(actorId, serviceSessionId, pending, { ...operation, state: 'Quoted' })).toBe(true);
});

it.each([
  ['another actor', () => canRelease('44444444-4444-4444-8444-444444444444')],
  ['another visit', () => canRelease(actorId, '55555555-5555-4555-8555-555555555555')],
  [
    'a different operation',
    () =>
      canRelease(actorId, serviceSessionId, pending, {
        ...operation,
        operationId: '66666666-6666-4666-8666-666666666666',
      }),
  ],
  ['a denied recovery action', () => canRelease(actorId, serviceSessionId, pending, operation, false)],
  ['a concurrent mutation', () => canRelease(actorId, serviceSessionId, pending, operation, true, true)],
  ['unavailable session storage', () => canRelease(actorId, serviceSessionId, pending, operation, true, false, true)],
  [
    'a provider-pending state',
    () => canRelease(actorId, serviceSessionId, pending, { ...operation, state: 'Processing' }),
  ],
  ['a captured state', () => canRelease(actorId, serviceSessionId, pending, { ...operation, state: 'Captured' })],
])('blocks release for %s', (_reason, check) => {
  expect(check()).toBe(false);
});
