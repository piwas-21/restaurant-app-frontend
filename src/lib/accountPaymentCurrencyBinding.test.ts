import type { AccountPaymentAccount } from '@/types/accountPaymentAccount';
import type { TableServiceSessionDto } from '@/types/order';
import { accountPaymentCurrencyMatchesSaved, accountPaymentVisitCurrency } from './accountPaymentCurrencyBinding';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const session = {
  serviceSessionId: id,
  currency: 'CHF',
  bill: { serviceSessionId: id, currency: 'CHF' },
} as TableServiceSessionDto;
const account = { serviceSessionId: id, currency: 'CHF' } as AccountPaymentAccount;

it('accepts the explicit visit and bill currency with the matching account', () => {
  expect(accountPaymentVisitCurrency(session, account)).toBe('CHF');
  expect(accountPaymentVisitCurrency(session)).toBe('CHF');
});

it.each(['EUR', 'chf', ' CHF ', '', 'XYZ', null, undefined])(
  'holds a conflicting or absent bill currency %s',
  (currency) => {
    expect(accountPaymentVisitCurrency({ ...session, bill: { ...session.bill, currency } }, account)).toBeNull();
  },
);

it('does not select the first available currency when explicit declarations disagree', () => {
  expect(accountPaymentVisitCurrency({ ...session, currency: 'EUR' }, account)).toBeNull();
  expect(accountPaymentVisitCurrency(session, { ...account, currency: 'EUR' })).toBeNull();
  expect(accountPaymentVisitCurrency({ ...session, currency: null }, account)).toBeNull();
});

it.each(['bill', 'account'])('holds a same-currency response from a different %s visit', (source) => {
  const current = source === 'bill' ? { ...session, bill: { ...session.bill, serviceSessionId: otherId } } : session;
  const loaded = source === 'account' ? { ...account, serviceSessionId: otherId } : account;
  expect(accountPaymentVisitCurrency(current, loaded)).toBeNull();
});

it('rejects malformed visit identities', () => {
  expect(accountPaymentVisitCurrency({ ...session, serviceSessionId: 'visit' }, account)).toBeNull();
  expect(accountPaymentCurrencyMatchesSaved('CHF', 'CHF', { ...session, serviceSessionId: '' })).toBe(false);
});

it('uses saved currency for flag-off recovery without requiring an account read', () => {
  expect(accountPaymentCurrencyMatchesSaved('CHF', 'CHF', session)).toBe(true);
  expect(
    accountPaymentCurrencyMatchesSaved('CHF', 'CHF', {
      ...session,
      currency: undefined,
      bill: { ...session.bill, currency: null },
    }),
  ).toBe(true);
});

it.each([
  ['EUR', 'CHF'],
  ['CHF', 'EUR'],
  ['CHF', undefined],
  ['CHF', 'chf'],
])('holds recovered currency %s against saved currency %s', (currency, saved) => {
  expect(accountPaymentCurrencyMatchesSaved(currency, saved, session)).toBe(false);
});

it('holds a saved retry when the available bill currency or visit changes', () => {
  expect(
    accountPaymentCurrencyMatchesSaved('CHF', 'CHF', { ...session, bill: { ...session.bill, currency: 'EUR' } }),
  ).toBe(false);
  expect(
    accountPaymentCurrencyMatchesSaved('CHF', 'CHF', {
      ...session,
      bill: { ...session.bill, serviceSessionId: otherId },
    }),
  ).toBe(false);
});
