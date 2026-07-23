import type { TFunction } from 'i18next';
import { registrationOutcomeErrors } from './registrationOutcome';
import type { GuestCustomerInfoErrors } from '@/components/order/GuestCustomerInfoFields';

const t = ((_key: string, fallback?: string) => fallback ?? _key) as TFunction;

const EMPTY: GuestCustomerInfoErrors = { name: '', email: '', phone: '' };

describe('registrationOutcomeErrors', () => {
  it("returns null for 'ok' (caller proceeds with the commit)", () => {
    expect(registrationOutcomeErrors({ status: 'ok' }, 'Ada Lovelace', EMPTY, t)).toBeNull();
  });

  it("'invalid' + single-token name → full-name guidance on the name field", () => {
    const next = registrationOutcomeErrors({ status: 'invalid' }, 'Ada', EMPTY, t);
    expect(next?.name).toBe('Please enter your full name (first and last)');
    expect(next?.email).toBe('');
  });

  it("'invalid' keeps an existing name error instead of overwriting it", () => {
    const prev: GuestCustomerInfoErrors = { ...EMPTY, name: 'Name is too short' };
    const next = registrationOutcomeErrors({ status: 'invalid' }, 'Ada', prev, t);
    expect(next?.name).toBe('Name is too short');
  });

  it("'invalid' + two-token name → no name guidance (the failure is elsewhere, e.g. passwords)", () => {
    const next = registrationOutcomeErrors({ status: 'invalid' }, 'Ada Lovelace', EMPTY, t);
    expect(next?.name).toBe('');
  });

  it("'duplicate' pins the already-registered error to the email field", () => {
    const prev: GuestCustomerInfoErrors = { ...EMPTY, phone: 'Phone is required' };
    const next = registrationOutcomeErrors({ status: 'duplicate' }, 'Ada Lovelace', prev, t);
    expect(next?.email).toBe('An account with this email already exists. Please log in.');
    // Other fields pass through untouched.
    expect(next?.phone).toBe('Phone is required');
  });
});
