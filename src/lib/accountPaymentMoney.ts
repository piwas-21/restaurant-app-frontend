import { formatCurrencyMinor } from '@/utils/minorCurrency';

const ACCOUNT_CURRENCIES = new Set(['CHF', 'EUR', 'GBP', 'USD', 'AED']);
const MINOR_UNITS = BigInt(100);

export function accountContributionInput(minor: number): string | null {
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  const exact = BigInt(minor);
  return `${exact / MINOR_UNITS}.${(exact % MINOR_UNITS).toString().padStart(2, '0')}`;
}

export function accountPaymentCurrency(currency: string): string | null {
  const normalized = currency.trim().toUpperCase();
  return ACCOUNT_CURRENCIES.has(normalized) ? normalized : null;
}

/** Parse exact two-decimal contributions without binary floating-point multiplication. */
export function parseAccountContributionMinor(input: string, currency: string): number | null {
  if (!accountPaymentCurrency(currency)) return null;
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const minor = BigInt(match[1]) * MINOR_UNITS + BigInt((match[2] ?? '').padEnd(2, '0'));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

export function formatAccountPaymentMinor(minor: number, currency: string, locale: string): string | null {
  const normalized = accountPaymentCurrency(currency);
  if (!normalized || !Number.isSafeInteger(minor) || minor < 0) return null;
  return formatCurrencyMinor(minor, normalized, locale);
}
