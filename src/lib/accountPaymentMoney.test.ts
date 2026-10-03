import { formatAccountPaymentMinor, parseAccountContributionMinor } from './accountPaymentMoney';

describe('exact account contribution input', () => {
  it('parses independently calculated cents with either decimal separator', () => {
    expect(parseAccountContributionMinor('0.29', 'CHF')).toBe(29);
    expect(parseAccountContributionMinor(' 12,34 ', 'EUR')).toBe(1234);
    expect(parseAccountContributionMinor('01.2', 'GBP')).toBe(120);
    expect(parseAccountContributionMinor('0', 'USD')).toBe(0);
  });

  it.each(['1.001', '1,000', '-1', '1e2', '1 000', 'NaN', 'Infinity', '1,2.3', ''])(
    'refuses ambiguous or inexact input %s',
    (input) => {
      expect(parseAccountContributionMinor(input, 'EUR')).toBeNull();
    },
  );

  it('refuses unsupported currency scales and unsafe JSON integers', () => {
    expect(parseAccountContributionMinor('1', 'JPY')).toBeNull();
    expect(parseAccountContributionMinor('1', 'BHD')).toBeNull();
    expect(parseAccountContributionMinor('90071992547409.91', 'CHF')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseAccountContributionMinor('90071992547409.92', 'CHF')).toBeNull();
  });

  it('formats supported exact amounts and rejects values it cannot represent safely', () => {
    expect(formatAccountPaymentMinor(1234, 'EUR', 'en-US')).toBe('€12.34');
    expect(formatAccountPaymentMinor(Number.MAX_SAFE_INTEGER, 'EUR', 'en-US')).toBe('€90,071,992,547,409.91');
    expect(formatAccountPaymentMinor(29, 'EUR', 'de-DE')).toBe('0,29 €');
    expect(formatAccountPaymentMinor(-1, 'CHF', 'en-US')).toBeNull();
    expect(formatAccountPaymentMinor(1.5, 'CHF', 'en-US')).toBeNull();
    expect(formatAccountPaymentMinor(100, 'JPY', 'en-US')).toBeNull();
  });
});
