import type { AccountPaymentOperation } from '@/types/accountPayments';
import type { PendingAccountPayment } from './pendingAccountPayment';
import { canReleaseAccountPaymentRecovery, canRetryAccountPaymentCollection } from './accountPaymentRecovery';

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

const orderId = '77777777-7777-4777-8777-777777777777';
const itemId = '88888888-8888-4888-8888-888888888888';
const malformedIdentities = ['not-a-uuid', 'x'.repeat(36)];
const collecting: PendingAccountPayment = { ...pending, stage: 'collecting' };
const collectableOperation: AccountPaymentOperation = {
  ...operation,
  state: 'Reserved',
  allocations: [
    {
      orderId,
      orderItemId: null,
      startOrdinal: 1,
      unitCount: 1,
      minorPerUnit: 29,
      amountMinor: 29,
    },
  ],
};

function canRetryCollection(
  actor = actorId,
  visit = serviceSessionId,
  saved: PendingAccountPayment | null = collecting,
  current: AccountPaymentOperation | null = collectableOperation,
  recoveryEnabled = true,
  busy = false,
  storageUnavailable = false,
): boolean {
  return canRetryAccountPaymentCollection(actor, visit, saved, current, recoveryEnabled, busy, storageUnavailable);
}

it('allows an exact original collection retry for the same actor, visit, request, version, and frozen scope', () => {
  expect(canRetryCollection()).toBe(true);
  expect(canRetryCollection(actorId.toUpperCase(), serviceSessionId.toUpperCase())).toBe(true);
});

it.each(malformedIdentities)('rejects a matching malformed actor identity: %s', (invalidId) => {
  const invalidPending = { ...collecting, actorId: invalidId };
  expect(canRetryCollection(invalidId, serviceSessionId, invalidPending, collectableOperation)).toBe(false);
});

it.each(malformedIdentities)('rejects matching malformed visit identities: %s', (invalidId) => {
  const invalidPending = { ...collecting, serviceSessionId: invalidId };
  const invalidOperation = { ...collectableOperation, serviceSessionId: invalidId };
  expect(canRetryCollection(actorId, invalidId, invalidPending, invalidOperation)).toBe(false);
});

it.each(malformedIdentities)('rejects matching malformed operation identities: %s', (invalidId) => {
  const invalidPending = { ...collecting, request: { ...collecting.request, operationId: invalidId } };
  const invalidOperation = { ...collectableOperation, operationId: invalidId };
  expect(canRetryCollection(actorId, serviceSessionId, invalidPending, invalidOperation)).toBe(false);
});

it.each([
  ['another actor', () => canRetryCollection('44444444-4444-4444-8444-444444444444')],
  ['another visit', () => canRetryCollection(actorId, '55555555-5555-4555-8555-555555555555')],
  [
    'another operation',
    () =>
      canRetryCollection(actorId, serviceSessionId, collecting, {
        ...collectableOperation,
        operationId: '66666666-6666-4666-8666-666666666666',
      }),
  ],
  [
    'a changed reserved version',
    () => canRetryCollection(actorId, serviceSessionId, collecting, { ...collectableOperation, version: 3 }),
  ],
  [
    'a wrong request amount',
    () => canRetryCollection(actorId, serviceSessionId, collecting, { ...collectableOperation, amountMinor: 30 }),
  ],
  ['a denied recovery', () => canRetryCollection(actorId, serviceSessionId, collecting, collectableOperation, false)],
  [
    'a busy write path',
    () => canRetryCollection(actorId, serviceSessionId, collecting, collectableOperation, true, true),
  ],
  [
    'unavailable recovery storage',
    () => canRetryCollection(actorId, serviceSessionId, collecting, collectableOperation, true, false, true),
  ],
  [
    'a provider-processing state',
    () => canRetryCollection(actorId, serviceSessionId, collecting, { ...collectableOperation, state: 'Processing' }),
  ],
  [
    'an item allocation for a different unit',
    () => {
      const selectedRequest = {
        ...collecting,
        request: {
          ...collecting.request,
          mode: 'Items' as const,
          selectedUnits: [{ orderId, orderItemId: itemId, ordinal: 1 }],
          amountMinor: undefined,
        },
      };
      const selectedOperation = {
        ...collectableOperation,
        mode: 'Items' as const,
        allocations: [{ ...collectableOperation.allocations[0], orderItemId: itemId, startOrdinal: 2 }],
      };
      return canRetryCollection(actorId, serviceSessionId, selectedRequest, selectedOperation);
    },
  ],
  [
    'an oversized returned item range',
    () => {
      const selectedRequest = {
        ...collecting,
        request: {
          ...collecting.request,
          mode: 'Items' as const,
          selectedUnits: [{ orderId, orderItemId: itemId, ordinal: 1 }],
          amountMinor: undefined,
        },
      };
      const selectedOperation = {
        ...collectableOperation,
        mode: 'Items' as const,
        amountMinor: Number.MAX_SAFE_INTEGER,
        allocations: [
          {
            ...collectableOperation.allocations[0],
            orderItemId: itemId,
            unitCount: Number.MAX_SAFE_INTEGER,
            minorPerUnit: 1,
            amountMinor: Number.MAX_SAFE_INTEGER,
          },
        ],
      };
      return canRetryCollection(actorId, serviceSessionId, selectedRequest, selectedOperation);
    },
  ],
])('blocks collection retry for %s', (_reason, check) => {
  expect(check()).toBe(false);
});

it('matches an item retry by exact selected unit identity rather than amount alone', () => {
  const selectedRequest: PendingAccountPayment = {
    ...collecting,
    request: {
      ...collecting.request,
      mode: 'Items',
      selectedUnits: [
        { orderId, orderItemId: itemId, ordinal: 1 },
        { orderId, orderItemId: itemId, ordinal: 2 },
      ],
      amountMinor: undefined,
    },
  };
  const selectedOperation: AccountPaymentOperation = {
    ...collectableOperation,
    mode: 'Items',
    amountMinor: 10,
    allocations: [{ orderId, orderItemId: itemId, startOrdinal: 1, unitCount: 2, minorPerUnit: 5, amountMinor: 10 }],
  };

  expect(canRetryCollection(actorId, serviceSessionId, selectedRequest, selectedOperation)).toBe(true);
});

it('rejects an Items retry carrying a conflicting equal-share ordinal', () => {
  const selectedRequest: PendingAccountPayment = {
    ...collecting,
    request: {
      ...collecting.request,
      mode: 'Items',
      selectedUnits: [{ orderId, orderItemId: itemId, ordinal: 1 }],
      amountMinor: undefined,
      equalShareOrdinal: 1,
    },
  };
  const selectedOperation: AccountPaymentOperation = {
    ...collectableOperation,
    mode: 'Items',
    allocations: [{ orderId, orderItemId: itemId, startOrdinal: 1, unitCount: 1, minorPerUnit: 29, amountMinor: 29 }],
  };

  expect(canRetryCollection(actorId, serviceSessionId, selectedRequest, selectedOperation)).toBe(false);
});

it('matches an Equal retry when the valid frozen plan ID differs only by letter case', () => {
  const uppercasePlanId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  const planId = uppercasePlanId.toLowerCase();
  const equalRequest: PendingAccountPayment = {
    ...collecting,
    request: {
      ...collecting.request,
      mode: 'Equal',
      amountMinor: undefined,
      equalSharePlanId: uppercasePlanId,
      equalShareOrdinal: 1,
    },
  };
  const equalOperation: AccountPaymentOperation = {
    ...collectableOperation,
    mode: 'Equal',
    equalSharePlanId: planId,
    equalShareOrdinal: 1,
  };

  expect(canRetryCollection(actorId, serviceSessionId, equalRequest, equalOperation)).toBe(true);
});
