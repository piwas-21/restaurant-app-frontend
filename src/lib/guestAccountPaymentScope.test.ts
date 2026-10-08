import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestPaymentEqualShareSummary } from '@/types/guestAccountPayments';
import { expectedGuestPaymentAllocations } from './guestAccountPaymentScope';

const SESSION_ID = '30000000-0000-4000-8000-000000000001';
const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ITEM_ID = '20000000-0000-4000-8000-000000000001';
const PLAN_ID = '40000000-0000-4000-8000-000000000001';
const planScope: AccountPaymentAllocation[] = [
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 2, unitCount: 1, minorPerUnit: 999, amountMinor: 999 },
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 3, unitCount: 1, minorPerUnit: 1500, amountMinor: 1500 },
];
const remainingScope: AccountPaymentAllocation[] = [
  { orderId: ORDER_ID, orderItemId: ITEM_ID, startOrdinal: 3, unitCount: 1, minorPerUnit: 1249, amountMinor: 1249 },
];

function equalSharePlan(overrides: Partial<GuestPaymentEqualShareSummary> = {}): GuestPaymentEqualShareSummary {
  return {
    planId: PLAN_ID,
    accountRevision: 10,
    totalMinor: 2499,
    shareCount: 2,
    currency: 'CHF',
    isOwnPlan: false,
    slots: [
      { ordinal: 1, amountMinor: 1250, claimState: 'Captured', isAvailable: false },
      { ordinal: 2, amountMinor: 1249, claimState: null, isAvailable: true },
    ],
    scope: planScope,
    ...overrides,
  };
}

function accountWithRemainingShare(
  plan = equalSharePlan(),
  availableAllocations: readonly AccountPaymentAllocation[] = remainingScope,
): GuestAccountPaymentAccount {
  return {
    serviceSessionId: SESSION_ID,
    status: 'Open',
    accountRevision: 14,
    currency: 'CHF',
    outstandingMinor: 1249,
    reservedMinor: 0,
    availableMinor: 1249,
    capturedAccountPaymentMinor: 3251,
    outstandingAllocations: availableAllocations,
    availableAllocations,
    activeEqualSharePlan: plan,
    activeAttempts: [],
    limits: {
      maximumSelectedUnits: 20,
      maximumEqualShares: 8,
      online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
    },
  };
}

const shareTwoQuote = {
  expectedAccountRevision: 14,
  mode: 'Equal' as const,
  paymentMethod: 'OnlinePayment' as const,
  equalSharePlanId: PLAN_ID,
  equalShareOrdinal: 2,
};

describe('expectedGuestPaymentAllocations equal-share revision handling', () => {
  it('uses the remaining frozen share when the account revision advances after the first claim', () => {
    const account = accountWithRemainingShare();

    expect(expectedGuestPaymentAllocations(account, shareTwoQuote)).toEqual(remainingScope);
  });

  it('rejects a plan revision later than the account snapshot', () => {
    const account = accountWithRemainingShare(equalSharePlan({ accountRevision: 15 }));

    expect(expectedGuestPaymentAllocations(account, shareTwoQuote)).toBeNull();
  });

  it('rejects a plan whose currency differs from the account', () => {
    const account = accountWithRemainingShare(equalSharePlan({ currency: 'EUR' }));

    expect(expectedGuestPaymentAllocations(account, shareTwoQuote)).toBeNull();
  });

  it('rejects a claimed share even when its frozen allocation remains in the plan', () => {
    const plan = equalSharePlan({
      slots: [
        { ordinal: 1, amountMinor: 1250, claimState: 'Captured', isAvailable: false },
        { ordinal: 2, amountMinor: 1249, claimState: 'Processing', isAvailable: false },
      ],
    });

    expect(expectedGuestPaymentAllocations(accountWithRemainingShare(plan), shareTwoQuote)).toBeNull();
  });

  it('rejects a frozen share no longer covered by the current available allocations', () => {
    expect(
      expectedGuestPaymentAllocations(accountWithRemainingShare(), { ...shareTwoQuote, equalShareOrdinal: 1 }),
    ).toBeNull();
    expect(expectedGuestPaymentAllocations(accountWithRemainingShare(undefined, []), shareTwoQuote)).toBeNull();
  });
});
