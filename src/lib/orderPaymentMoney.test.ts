import { amountFromMinor, inputFromMinor, parseOrderTipMinor } from './orderPaymentMoney';

describe('exact cashier gratuity money', () => {
  it('parses supported currency tips into exact minor units', () => {
    expect(parseOrderTipMinor('3.25', 'CHF')).toBe(325);
    expect(parseOrderTipMinor(' 1,20 ', 'EUR')).toBe(120);
  });

  it.each(['-1', '1.001', '1e2', ''])('rejects invalid or inexact tip input %s', (value) => {
    expect(parseOrderTipMinor(value, 'CHF')).toBeNull();
  });

  it('uses the tender ceiling and formats exact minor units without floating-point conversion', () => {
    expect(parseOrderTipMinor('99999999.99', 'CHF')).toBe(9_999_999_999);
    expect(parseOrderTipMinor('100000000.00', 'CHF')).toBeNull();
    expect(inputFromMinor(325)).toBe('3.25');
    expect(amountFromMinor(325)).toBe(3.25);
    expect(amountFromMinor(Number.MAX_SAFE_INTEGER + 1)).toBe(0);
  });
});
