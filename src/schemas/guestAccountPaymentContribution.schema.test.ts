import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';
import { createGuestAccountPaymentContributionSchema } from './guestAccountPaymentContribution.schema';

const orderId = '10000000-0000-4000-8000-000000000001';
const itemId = '20000000-0000-4000-8000-000000000001';
const secondItemId = '20000000-0000-4000-8000-000000000002';
const allocations: AccountPaymentAllocation[] = [
  { orderId, orderItemId: itemId, startOrdinal: 1, unitCount: 2, minorPerUnit: 150, amountMinor: 300 },
  { orderId, orderItemId: secondItemId, startOrdinal: 1, unitCount: 1, minorPerUnit: 1000, amountMinor: 1000 },
];
const account: GuestAccountPaymentAccount = {
  serviceSessionId: '30000000-0000-4000-8000-000000000001',
  status: 'Open',
  accountRevision: 2,
  currency: 'CHF',
  outstandingMinor: 1200,
  reservedMinor: 0,
  availableMinor: 1200,
  capturedAccountPaymentMinor: 0,
  outstandingAllocations: allocations,
  availableAllocations: allocations,
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 5,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 2000 },
  },
};
const plan: GuestPaymentEqualShareSummary = {
  planId: '40000000-0000-4000-8000-000000000001',
  accountRevision: 2,
  totalMinor: 1200,
  shareCount: 3,
  currency: 'CHF',
  isOwnPlan: true,
  slots: [
    { ordinal: 1, amountMinor: 400, claimState: null, isAvailable: true },
    { ordinal: 2, amountMinor: 99, claimState: null, isAvailable: true },
    { ordinal: 3, amountMinor: 400, claimState: 'Reserved', isAvailable: false },
  ],
  scope: allocations,
};

describe('guest account payment contribution schema', () => {
  it('parses an exact positive localized minor amount into the online quote shape', () => {
    expect(parse({ mode: 'Amount', amountInput: '1,25' }).data).toEqual({
      mode: 'Amount',
      paymentMethod: 'OnlinePayment',
      amountMinor: 125,
    });
  });

  it.each(['0', '1.001', 'not-money'])('rejects non-positive or inexact amount input %s', (amountInput) => {
    expect(error({ mode: 'Amount', amountInput })).toBe('invalid_amount');
  });

  it('rejects amounts below minimum, above provider maximum, or above available balance', () => {
    expect(error({ mode: 'Amount', amountInput: '0.99' })).toBe('minimum');
    expect(error({ mode: 'Amount', amountInput: '20.01' })).toBe('maximum');
    expect(error({ mode: 'Amount', amountInput: '12.01' })).toBe('maximum');
  });

  it('accepts only a selected set of distinct available item units within the allowed value', () => {
    expect(
      parse({
        mode: 'Items',
        quantities: { [`${orderId}:${itemId}:1`]: 2 },
      }).data,
    ).toEqual({
      mode: 'Items',
      paymentMethod: 'OnlinePayment',
      selectedUnits: [
        { orderId, orderItemId: itemId, ordinal: 1 },
        { orderId, orderItemId: itemId, ordinal: 2 },
      ],
    });
    expect(error({ mode: 'Items', quantities: {} })).toBe('select_units');
    expect(error({ mode: 'Items', quantities: { [`${orderId}:${itemId}:1`]: 6 } })).toBe('select_units');
    expect(error({ mode: 'Items', quantities: { [`${orderId}:${itemId}:99`]: 1 } })).toBe('select_units');
  });

  it('checks the item scope against the provider maximum and current account balance', () => {
    const selected = {
      [`${orderId}:${itemId}:1`]: 2,
      [`${orderId}:${secondItemId}:1`]: 1,
    };
    expect(error({ mode: 'Items', quantities: selected })).toBe('maximum');
    const limitedAccount = {
      ...account,
      limits: { ...account.limits, online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 250 } },
    };
    expect(error({ mode: 'Items', quantities: { [`${orderId}:${itemId}:1`]: 2 } }, null, limitedAccount)).toBe(
      'maximum',
    );
  });

  it('requires an available equal-share slot that meets minimum and balance limits', () => {
    expect(parse({ mode: 'Equal', shareOrdinal: 1 }, plan).data).toEqual({
      mode: 'Equal',
      paymentMethod: 'OnlinePayment',
      equalSharePlanId: plan.planId,
      equalShareOrdinal: 1,
    });
    expect(error({ mode: 'Equal', shareOrdinal: null }, plan)).toBe('select_share');
    expect(error({ mode: 'Equal', shareOrdinal: 3 }, plan)).toBe('select_share');
    expect(error({ mode: 'Equal', shareOrdinal: 2 }, plan)).toBe('minimum');
    const tooLargePlan = {
      ...plan,
      slots: [...plan.slots, { ordinal: 4, amountMinor: 1300, claimState: null, isAvailable: true }],
    };
    expect(error({ mode: 'Equal', shareOrdinal: 4 }, tooLargePlan)).toBe('maximum');
  });
});

function parse(value: unknown, activePlan: GuestPaymentEqualShareSummary | null = null, currentAccount = account) {
  const defaults = { mode: 'Amount', amountInput: '1.00', quantities: {}, shareOrdinal: null };
  return createGuestAccountPaymentContributionSchema(currentAccount, activePlan).safeParse({
    ...defaults,
    ...(typeof value === 'object' && value !== null ? value : {}),
  });
}

function error(
  value: unknown,
  activePlan: GuestPaymentEqualShareSummary | null = null,
  currentAccount = account,
): string | undefined {
  const result = parse(value, activePlan, currentAccount);
  return result.success ? undefined : result.error.issues[0]?.message;
}
