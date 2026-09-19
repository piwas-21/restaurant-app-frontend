import { cashSuggestions, formatOrderCurrency, orderCurrency } from './cashierMoney';
import { TENANT_CURRENCY, TENANT_LOCALE } from '@/utils/currency';

describe('cashier money helpers', () => {
  it('uses a valid order currency and ignores malformed wire values', () => {
    expect(orderCurrency({ currency: 'EUR' })).toBe('EUR');
    expect(orderCurrency({ currency: ' eur ' })).toBe('EUR');
    expect(orderCurrency({ currency: 'not-a-code' })).toBe(TENANT_CURRENCY);
    expect(orderCurrency({ currency: null })).toBe(TENANT_CURRENCY);
  });

  it('formats the order currency with tenant locale rather than the browser locale', () => {
    const expected = new Intl.NumberFormat(TENANT_LOCALE, { style: 'currency', currency: 'EUR' }).format(18.5);
    expect(formatOrderCurrency(18.5, { currency: 'EUR' })).toBe(expected);
  });

  it('offers exact due and the next two common cash denominations', () => {
    expect(cashSuggestions(18.5)).toEqual([18.5, 20, 50]);
    expect(cashSuggestions(5)).toEqual([5, 10, 20]);
    expect(cashSuggestions(0)).toEqual([]);
    expect(cashSuggestions(Number.NaN)).toEqual([]);
  });
});
