import type { AccountPaymentOperation } from '@/types/accountPayments';
import { accountCashCollectionMatchesIntent, createAccountCashCollectionIntent } from './accountCashCollectionIntent';

const operation: AccountPaymentOperation = {
  serviceSessionId: '11111111-1111-4111-8111-111111111111',
  operationId: '22222222-2222-4222-8222-222222222222',
  state: 'Reserved',
  version: 2,
  expectedAccountRevision: 1,
  mode: 'Amount',
  paymentMethod: 'Cash',
  amountMinor: 333,
  currency: 'CHF',
  quoteExpiresAt: '2026-10-04T12:02:00Z',
  reservedAt: '2026-10-04T12:01:00Z',
  reservationExpiresAt: '2026-10-04T12:06:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
  cashSettlement: {
    policyVersion: 'chf-cash-5-rappen-v1',
    currency: 'CHF',
    paymentMethod: 'Cash',
    exactAmountMinor: 333,
    adjustmentMinor: 2,
    dueAmountMinor: 335,
  },
};
const intent = createAccountCashCollectionIntent(operation, 500);
const captured: AccountPaymentOperation = {
  ...operation,
  state: 'Captured',
  version: 3,
  cashReceipt: {
    policyVersion: 'chf-cash-5-rappen-v1',
    currency: 'CHF',
    exactAmountMinor: 333,
    adjustmentMinor: 2,
    dueAmountMinor: 335,
    receivedMinor: 500,
    changeMinor: 165,
    capturedAt: '2026-10-04T12:02:00Z',
  },
};

it('copies frozen review terms and preserves the original received amount across recovery', () => {
  expect(intent).toEqual({
    operationId: operation.operationId,
    serviceSessionId: operation.serviceSessionId,
    expectedVersion: 2,
    receivedMinor: 500,
    settlement: operation.cashSettlement,
  });
  expect(intent?.settlement).not.toBe(operation.cashSettlement);
  expect(accountCashCollectionMatchesIntent(JSON.parse(JSON.stringify(intent)) as unknown, operation)).toBe(true);
  expect(accountCashCollectionMatchesIntent(intent, captured)).toBe(true);
});

it('holds a self-consistent receipt if it attests a different amount received', () => {
  expect(
    accountCashCollectionMatchesIntent(intent, {
      ...captured,
      cashReceipt: { ...captured.cashReceipt!, receivedMinor: 1000, changeMinor: 665 },
    }),
  ).toBe(false);
});

it.each([0, 2, 4, NaN, Number.MAX_SAFE_INTEGER + 1])('holds a captured receipt at incorrect version %s', (version) => {
  expect(accountCashCollectionMatchesIntent(intent, { ...captured, version })).toBe(false);
});

it.each([
  { operationId: '33333333-3333-4333-8333-333333333333' },
  { serviceSessionId: '33333333-3333-4333-8333-333333333333' },
  { operationId: 'not-an-operation' },
  { operationId: '00000000-0000-0000-0000-000000000000' },
  { serviceSessionId: '00000000-0000-0000-0000-000000000000' },
  { version: 3 },
  { state: 'Released' as const },
  { state: 'ReconciliationRequired' as const },
])('holds a different identity or reservation: %j', (change) => {
  expect(accountCashCollectionMatchesIntent(intent, { ...operation, ...change })).toBe(false);
});

it('accepts UUID case differences without changing currency or tender terms', () => {
  const ids = {
    operationId: 'abcdefab-abcd-4abc-8abc-abcdefabcdef',
    serviceSessionId: 'abcdefab-abcd-4abc-8abc-abcdefabcdea',
  };
  const saved = createAccountCashCollectionIntent({ ...operation, ...ids }, 500);
  expect(
    accountCashCollectionMatchesIntent(saved, {
      ...operation,
      operationId: ids.operationId.toUpperCase(),
      serviceSessionId: ids.serviceSessionId.toUpperCase(),
    }),
  ).toBe(true);
});

it('holds lookup terms that are valid on their own but differ from the frozen review', () => {
  expect(
    accountCashCollectionMatchesIntent(intent, {
      ...operation,
      amountMinor: 332,
      cashSettlement: { ...operation.cashSettlement!, exactAmountMinor: 332, adjustmentMinor: -2, dueAmountMinor: 330 },
    }),
  ).toBe(false);
});

it.each([null, { ...intent, actorId: 'private-actor' }, { ...intent, receivedMinor: 334 }])(
  'holds damaged or inadequate physical tender intent %j',
  (saved) => expect(accountCashCollectionMatchesIntent(saved, operation)).toBe(false),
);

it('requires reviewed cash terms and the rounded physical minimum before creating intent', () => {
  expect(createAccountCashCollectionIntent(operation, 333)).toBeNull();
  expect(createAccountCashCollectionIntent({ ...operation, cashSettlement: null }, 500)).toBeNull();
  expect(createAccountCashCollectionIntent({ ...operation, state: 'Quoted' }, 500)).toBeNull();
  expect(createAccountCashCollectionIntent({ ...operation, paymentMethod: 'CreditCard' }, 500)).toBeNull();
  expect(createAccountCashCollectionIntent({ ...operation, version: 0 }, 500)).toBeNull();
  expect(
    createAccountCashCollectionIntent({ ...operation, operationId: '00000000-0000-0000-0000-000000000000' }, 500),
  ).toBeNull();
});

it('keeps rounded-down exact allocation distinct from physical tender and change', () => {
  const reserved = {
    ...operation,
    amountMinor: 332,
    cashSettlement: { ...operation.cashSettlement!, exactAmountMinor: 332, adjustmentMinor: -2, dueAmountMinor: 330 },
  };
  const saved = createAccountCashCollectionIntent(reserved, 330);
  expect(saved?.settlement.exactAmountMinor).toBe(332);
  expect(saved?.receivedMinor).toBe(330);
  expect(accountCashCollectionMatchesIntent(saved, reserved)).toBe(true);
});
