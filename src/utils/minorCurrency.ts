/** Render exact two-decimal ledger money without converting minor units through floating point. */
export function formatCurrencyMinor(minor: number, currency: string, locale: string): string {
  if (!Number.isSafeInteger(minor) || minor < 0 || !/^[A-Z]{3}$/.test(currency)) {
    throw new RangeError('Provide a nonnegative safe minor amount and a canonical currency.');
  }
  const exact = BigInt(minor);
  const fraction = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(
    Number(exact % BigInt(100)),
  );
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(exact / BigInt(100))
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}
