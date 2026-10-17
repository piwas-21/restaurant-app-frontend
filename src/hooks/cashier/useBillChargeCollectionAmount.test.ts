import { renderHook } from '@testing-library/react';
import { makeOrder } from '@/utils/__fixtures__/bundleOrderFixture';
import { useBillChargeCollectionAmount } from './useBillChargeCollectionAmount';

it.each([
  ['CHF', 'fr-CH', '18,50'],
  ['EUR', 'de', '18,50'],
  ['JPY', 'en', '18.50'],
  ['KWD', 'ar-KW', '١٨٫٥٠'],
])('follows a saved fee using %s ledger balances and %s input', (currency, locale, input) => {
  // The existing payment API uses two-decimal ledger units for every ISO currency.
  const prior = { ...makeOrder([]), currency, remainingAmount: 18.5, billChargeAmount: 0 };
  const setAmount = jest.fn();
  const setReceived = jest.fn();
  const clearTransient = jest.fn();
  const { rerender } = renderHook(
    ({ order }) =>
      useBillChargeCollectionAmount({
        order,
        disabled: false,
        amount: input,
        received: input,
        tip: '',
        method: 'Cash',
        locale,
        setAmount,
        setReceived,
        clearTransient,
      }),
    { initialProps: { order: prior } },
  );
  rerender({ order: { ...prior, remainingAmount: 23.5, billChargeAmount: 5 } });
  expect(setAmount).toHaveBeenCalledWith('23.50');
  expect(setReceived).toHaveBeenCalledWith('23.50');
  expect(clearTransient).toHaveBeenCalledTimes(1);
});

it('does not round a malformed wire balance into an editable payment amount', () => {
  const prior = { ...makeOrder([]), currency: 'CHF', remainingAmount: 18.5, billChargeAmount: 0 };
  const setAmount = jest.fn();
  const setReceived = jest.fn();
  const clearTransient = jest.fn();
  const { rerender } = renderHook(
    ({ order }) =>
      useBillChargeCollectionAmount({
        order,
        disabled: false,
        amount: '18.50',
        received: '18.50',
        tip: '',
        method: 'Cash',
        locale: 'en',
        setAmount,
        setReceived,
        clearTransient,
      }),
    { initialProps: { order: prior } },
  );
  rerender({ order: { ...prior, remainingAmount: 23.501, billChargeAmount: 5 } });
  expect(setAmount).not.toHaveBeenCalled();
  expect(setReceived).not.toHaveBeenCalled();
  expect(clearTransient).toHaveBeenCalledTimes(1);
});
