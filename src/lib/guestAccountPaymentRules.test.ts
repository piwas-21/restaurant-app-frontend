import {
  canCreateGuestEqualSharePlan,
  canSafelyReleaseGuestPayment,
  holdsGuestPaymentScope,
  isTerminalGuestPayment,
  safeStripeCheckoutUrl,
} from './guestAccountPaymentRules';
import type { GuestAccountPaymentAccount } from '@/types/guestAccountPayments';

const account: GuestAccountPaymentAccount = {
  serviceSessionId: '00000000-0000-4000-8000-000000000001',
  status: 'Open',
  accountRevision: 1,
  currency: 'CHF',
  outstandingMinor: 2000,
  reservedMinor: 0,
  availableMinor: 2000,
  capturedAccountPaymentMinor: 0,
  outstandingAllocations: [],
  availableAllocations: [],
  activeEqualSharePlan: null,
  activeAttempts: [],
  limits: {
    maximumSelectedUnits: 100,
    maximumEqualShares: 8,
    online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 1500 },
  },
};

describe('guest account payment guards', () => {
  it.each(['Reserved', 'Starting', 'Processing', 'CancelRequested', 'ReconciliationRequired'] as const)(
    'holds account scope while %s',
    (state) => expect(holdsGuestPaymentScope(state)).toBe(true),
  );

  it('holds a nominally captured state when the server requires reconciliation', () => {
    expect(holdsGuestPaymentScope('Captured', true)).toBe(true);
    expect(isTerminalGuestPayment('Captured')).toBe(true);
  });

  it('allows release only before any checkout start was requested', () => {
    expect(canSafelyReleaseGuestPayment('Quoted', null)).toBe(true);
    expect(canSafelyReleaseGuestPayment('Reserved', null)).toBe(true);
    expect(canSafelyReleaseGuestPayment('Reserved', 123)).toBe(false);
    expect(canSafelyReleaseGuestPayment('Processing', null)).toBe(false);
  });

  it('allows only equal-share plans whose every rounded share fits provider limits', () => {
    expect(canCreateGuestEqualSharePlan(account, 2)).toBe(true);
    expect(canCreateGuestEqualSharePlan({ ...account, availableMinor: 199 }, 2)).toBe(false);
    expect(canCreateGuestEqualSharePlan({ ...account, availableMinor: 3100 }, 2)).toBe(false);
    expect(canCreateGuestEqualSharePlan({ ...account, limits: { ...account.limits, online: null } }, 2)).toBe(false);
    expect(canCreateGuestEqualSharePlan(account, 1)).toBe(false);
    expect(canCreateGuestEqualSharePlan(account, 9)).toBe(false);
  });

  it('accepts only Stripe checkout links without alternate authority or ports', () => {
    expect(safeStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test')).toBe(
      'https://checkout.stripe.com/c/pay/cs_test',
    );
    expect(safeStripeCheckoutUrl('http://checkout.stripe.com/pay')).toBeNull();
    expect(safeStripeCheckoutUrl('https://checkout.stripe.com.evil.example/pay')).toBeNull();
    expect(safeStripeCheckoutUrl('https://checkout.stripe.com:444/pay')).toBeNull();
    expect(safeStripeCheckoutUrl('https://user@checkout.stripe.com/pay')).toBeNull();
    expect(safeStripeCheckoutUrl('javascript:alert(1)')).toBeNull();
  });
});
