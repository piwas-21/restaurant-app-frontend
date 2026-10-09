import { formatCurrencyMinor } from '@/utils/minorCurrency';

const ACCOUNT_CURRENCIES = new Set(['CHF', 'EUR', 'GBP', 'USD', 'AED']);
const MINOR_UNITS = BigInt(100);
const FORMAT_CONTROLS = /[\u200e\u200f\u061c\u2066-\u2069]/g;
export const MAX_ACCOUNT_PAYMENT_MINOR = 9_999_999_999;

export function accountContributionInput(minor: number): string | null {
  if (!Number.isSafeInteger(minor) || minor < 0) return null;
  const exact = BigInt(minor);
  return `${exact / MINOR_UNITS}.${(exact % MINOR_UNITS).toString().padStart(2, '0')}`;
}

export function accountPaymentCurrency(currency: string): string | null {
  const normalized = currency.trim().toUpperCase();
  return ACCOUNT_CURRENCIES.has(normalized) ? normalized : null;
}

function localizedDigits(locale: string): Map<string, string> {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 0 });
  return new Map(
    Array.from({ length: 10 }, (_, digit) => [formatter.format(digit).replace(FORMAT_CONTROLS, ''), String(digit)]),
  );
}

function normalizeDigits(value: string, locale: string): string {
  const digits = localizedDigits(locale);
  return Array.from(value, (character) => digits.get(character) ?? character).join('');
}

function groupingPattern(locale: string, group: string): number[] {
  const groups = new Intl.NumberFormat(locale)
    .formatToParts(123456789)
    .filter((part) => part.type === 'integer')
    .map((part) => part.value.length);
  if (
    groups.length < 2 ||
    !new Intl.NumberFormat(locale)
      .formatToParts(123456789)
      .some((part) => part.type === 'group' && part.value === group)
  ) {
    return [3];
  }
  return groups.slice(0, -1).reverse();
}

function validGroupedInteger(value: string, group: string, pattern: number[]): string | null {
  if (!value.includes(group)) return /^\d+$/.test(value) ? value : null;
  const groups = value.split(group);
  if (groups.some((part) => !/^\d+$/.test(part))) return null;
  const fromRight = groups.slice().reverse();
  for (let index = 0; index < fromRight.length; index += 1) {
    const expected = pattern[Math.min(index, pattern.length - 1)];
    const isLeading = index === fromRight.length - 1;
    if (
      isLeading
        ? fromRight[index].length < 1 || fromRight[index].length > expected
        : fromRight[index].length !== expected
    ) {
      return null;
    }
  }
  return groups.join('');
}

function minorFromParts(whole: string, fraction: string | undefined): number | null {
  if (!/^\d+$/.test(whole) || (fraction !== undefined && !/^\d{1,2}$/.test(fraction))) return null;
  const minor = BigInt(whole) * MINOR_UNITS + BigInt((fraction ?? '').padEnd(2, '0'));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

function parseSwissApostropheAmount(normalized: string): number | null {
  const apostrophes = new Set(normalized.match(/[\u0027\u2019]/g) ?? []);
  if (apostrophes.size !== 1) return null;
  const group = [...apostrophes][0];
  const decimals = ['.', ','].filter((separator) => normalized.includes(separator));
  if (decimals.length > 1) return null;
  const parts = decimals.length ? normalized.split(decimals[0]) : [normalized];
  if (parts.length > 2) return null;
  const whole = validGroupedInteger(parts[0], group, [3]);
  return whole === null ? null : minorFromParts(whole, parts[1]);
}

function parseWithDecimal(normalized: string, decimal: string, group: string, pattern: number[]): number | null {
  const parts = normalized.split(decimal);
  if (parts.length > 2) return null;
  const whole = validGroupedInteger(parts[0], group, pattern);
  return whole === null ? null : minorFromParts(whole, parts[1]);
}

function parseLocalizedAmount(normalized: string, decimal: string, group: string, locale: string): number | null {
  const pattern = groupingPattern(locale, group);
  const localized = parseWithDecimal(normalized, decimal, group, pattern);
  if (localized !== null) return localized;

  const alternate = decimal === '.' ? ',' : '.';
  const parts = normalized.split(alternate);
  if (parts.length === 1) {
    const whole = validGroupedInteger(normalized, group, pattern);
    return whole === null ? null : minorFromParts(whole, undefined);
  }
  if (parts.length !== 2 || parts[1].length < 1 || parts[1].length > 2) return null;

  // A correctly grouped integer such as en-CH `1,700` is an integer, never 1.70.
  if (alternate === group) {
    const groupedInteger = validGroupedInteger(normalized, group, pattern);
    if (groupedInteger !== null) return minorFromParts(groupedInteger, undefined);
  }
  const whole = validGroupedInteger(parts[0], group, pattern);
  return whole === null ? null : minorFromParts(whole, parts[1]);
}

function normalizeCurrencyInput(input: string, currency: string, group: string, locale: string): string | null {
  let cleaned = input.trim().replace(FORMAT_CONTROLS, '');
  const aliases = new Set([group]);
  if (/[ \u00a0\u202f]/.test(group)) [' ', '\u00a0', '\u202f'].forEach((value) => aliases.add(value));
  if (currency === 'CHF') ['\u0027', '\u2019'].forEach((value) => aliases.add(value));
  const found = [...aliases].filter((value) => cleaned.includes(value));
  if (found.length > 1 && !(currency === 'CHF' && /[\u0027\u2019]/.test(cleaned))) return null;
  if (/[ \u00a0\u202f]/.test(group)) cleaned = cleaned.replace(/[ \u00a0\u202f]/g, group);
  return normalizeDigits(cleaned, locale);
}

/** Parse a localized fixed-two-decimal amount without restricting the tenant currency. */
export function parseCurrencyAmountMinor(input: string, currency: string, locale = 'en'): number | null {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) return null;
  const formatter = new Intl.NumberFormat(locale);
  const parts = formatter.formatToParts(12345.6);
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  const normalized = normalizeCurrencyInput(input, normalizedCurrency, group, locale);
  if (!normalized) return null;
  if (normalizedCurrency === 'CHF' && /[\u0027\u2019]/.test(normalized)) return parseSwissApostropheAmount(normalized);
  return parseLocalizedAmount(normalized, decimal, group, locale);
}

/** Parse account contributions only for currencies supported by account collection. */
export function parseAccountContributionMinor(input: string, currency: string, locale = 'en'): number | null {
  if (!accountPaymentCurrency(currency)) return null;
  const amount = parseCurrencyAmountMinor(input, currency, locale);
  return amount !== null && amount <= MAX_ACCOUNT_PAYMENT_MINOR ? amount : null;
}

export function formatAccountPaymentMinor(minor: number, currency: string, locale: string): string | null {
  const normalized = accountPaymentCurrency(currency);
  if (!normalized || !Number.isSafeInteger(minor) || minor < 0) return null;
  return formatCurrencyMinor(minor, normalized, locale);
}
