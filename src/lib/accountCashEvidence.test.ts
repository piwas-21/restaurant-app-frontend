import type { AccountCashSettlement } from '@/types/accountCashSettlement';
import type { AccountPaymentOperation } from '@/types/accountPayments';
import { canCollectReviewedCash, readAccountCashEvidence } from './accountCashEvidence';

const settlement: AccountCashSettlement = {
  policyVersion: 'chf-cash-5-rappen-v1',
  currency: 'CHF',
  paymentMethod: 'Cash',
  exactAmountMinor: 333,
  adjustmentMinor: 2,
  dueAmountMinor: 335,
};
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
  quoteExpiresAt: '2026-10-03T12:02:00Z',
  reservedAt: '2026-10-03T12:01:00Z',
  reservationExpiresAt: '2026-10-03T12:06:00Z',
  equalSharePlanId: null,
  equalShareOrdinal: null,
  allocations: [],
  cashSettlement: settlement,
};

it.each([
  [331, -1, 330],
  [332, -2, 330],
  [333, 2, 335],
  [334, 1, 335],
  [335, 0, 335],
])('accepts frozen CHF cash terms for exact %i and adjustment %i', (exact, adjustment, due) => {
  const current = {
    ...operation,
    amountMinor: exact,
    cashSettlement: { ...settlement, exactAmountMinor: exact, adjustmentMinor: adjustment, dueAmountMinor: due },
  };
  expect(readAccountCashEvidence(current).status).toBe('valid');
});

it('requires the physical amount due and keeps the exact bill amount intact', () => {
  expect(canCollectReviewedCash(operation, 333)).toBe(false);
  expect(canCollectReviewedCash(operation, 335)).toBe(true);
  expect(operation.amountMinor).toBe(333);
});

it('permits a rounded-down physical amount without adding the missing cents to the bill', () => {
  const current = {
    ...operation,
    amountMinor: 332,
    cashSettlement: { ...settlement, exactAmountMinor: 332, adjustmentMinor: -2, dueAmountMinor: 330 },
  };
  expect(canCollectReviewedCash(current, 330)).toBe(true);
  expect(current.amountMinor).toBe(332);
});

it.each([undefined, null])('keeps legacy %s cash terms unattested and blocks a fresh physical collection', (value) => {
  const current = { ...operation, cashSettlement: value };
  expect(readAccountCashEvidence(current).status).toBe('missing');
  expect(canCollectReviewedCash(current, 1000)).toBe(false);
});

it.each([
  { policyVersion: 'unknown-policy' },
  { currency: 'EUR' },
  { paymentMethod: 'CreditCard' },
  { exactAmountMinor: 334 },
  { adjustmentMinor: 1 },
  { dueAmountMinor: 340, adjustmentMinor: 7 },
  { exactAmountMinor: Number.MAX_SAFE_INTEGER + 1 },
  { dueAmountMinor: 0 },
  { actorRole: 'Admin' },
])('holds malformed or mismatched frozen terms: %j', (change) => {
  const current = { ...operation, cashSettlement: { ...settlement, ...change } } as AccountPaymentOperation;
  expect(readAccountCashEvidence(current).status).toBe('invalid');
  expect(canCollectReviewedCash(current, 1000)).toBe(false);
});

it('keeps non-CHF cash and manual card exact', () => {
  const eur = {
    ...operation,
    currency: 'EUR',
    cashSettlement: {
      ...settlement,
      policyVersion: 'exact-v1' as const,
      currency: 'EUR',
      adjustmentMinor: 0,
      dueAmountMinor: 333,
    },
  };
  const card = {
    ...operation,
    paymentMethod: 'CreditCard' as const,
    cashSettlement: {
      ...settlement,
      policyVersion: 'exact-v1' as const,
      paymentMethod: 'CreditCard' as const,
      adjustmentMinor: 0,
      dueAmountMinor: 333,
    },
  };
  expect(readAccountCashEvidence(eur).status).toBe('valid');
  expect(canCollectReviewedCash(eur, 333)).toBe(true);
  expect(readAccountCashEvidence(card).status).toBe('valid');
  expect(canCollectReviewedCash(card, 333)).toBe(false);
});

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
    capturedAt: '2026-10-03T12:02:00Z',
  },
};

it('accepts an attested captured receipt with exact allocation and physical change conserved separately', () => {
  const result = readAccountCashEvidence(captured);
  expect(result.status).toBe('valid');
  if (result.status === 'valid') {
    expect(result.receipt?.exactAmountMinor).toBe(333);
    expect(result.receipt?.dueAmountMinor).toBe(335);
    expect(result.receipt?.receivedMinor).toBe(500);
    expect(result.receipt?.changeMinor).toBe(165);
  }
  expect(canCollectReviewedCash(captured, 500)).toBe(false);
});

it.each([
  { changeMinor: 167 },
  { receivedMinor: 334, changeMinor: 0 },
  { capturedAt: 'invalid-date' },
  { exactAmountMinor: 335 },
  { currency: 'EUR' },
])('holds a corrupt physical receipt: %j', (change) => {
  expect(readAccountCashEvidence({ ...captured, cashReceipt: { ...captured.cashReceipt!, ...change } }).status).toBe(
    'invalid',
  );
});

it('holds new captured cash without its receipt and a receipt returned before capture', () => {
  expect(readAccountCashEvidence({ ...captured, cashReceipt: null }).status).toBe('invalid');
  expect(readAccountCashEvidence({ ...captured, state: 'Reserved' }).status).toBe('invalid');
});
