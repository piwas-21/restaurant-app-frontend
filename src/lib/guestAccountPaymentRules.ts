import type { AccountPaymentState } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount } from '@/types/guestAccountPayments';
import { PAYMENT_CHECKOUT_ALLOWED_HOSTS } from '@/lib/config';

const HELD_STATES = new Set<AccountPaymentState>([
  'Reserved',
  'Starting',
  'Processing',
  'CancelRequested',
  'ReconciliationRequired',
]);

export function holdsGuestPaymentScope(state: AccountPaymentState, reconciliationRequired = false): boolean {
  return reconciliationRequired || HELD_STATES.has(state);
}

export function canSafelyReleaseGuestPayment(state: AccountPaymentState, startRequestedAt: number | null): boolean {
  return startRequestedAt === null && (state === 'Quoted' || state === 'Reserved');
}

export function isTerminalGuestPayment(state: AccountPaymentState): boolean {
  return state === 'Captured' || state === 'Released' || state === 'Failed';
}

export function canCreateGuestEqualSharePlan(account: GuestAccountPaymentAccount, shareCount: number): boolean {
  const limits = account.limits.online;
  const total = account.availableMinor;
  if (
    !limits ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    !Number.isSafeInteger(shareCount) ||
    shareCount < 2 ||
    shareCount > account.limits.maximumEqualShares ||
    shareCount > total ||
    limits.currency.toUpperCase() !== account.currency.toUpperCase()
  )
    return false;

  const smallestShare = Math.floor(total / shareCount);
  const largestShare = Math.ceil(total / shareCount);
  return smallestShare >= limits.minimumAmountMinor && largestShare <= limits.maximumAmountMinor;
}

export function safeStripeCheckoutUrl(value: string | null): string | null {
  if (!value) return null;
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch (_error) {
    // Invalid or malformed provider URLs are rejected; callers never navigate to them.
  }
  if (!url) return null;
  return url.protocol === 'https:' &&
    PAYMENT_CHECKOUT_ALLOWED_HOSTS.has(url.hostname) &&
    url.port === '' &&
    !url.username &&
    !url.password
    ? value
    : null;
}

export function createPaymentOperationId(): string | null {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;
  return crypto.randomUUID();
}
