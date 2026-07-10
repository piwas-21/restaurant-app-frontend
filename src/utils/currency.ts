/**
 * Currency formatting utilities.
 *
 * Single source of truth for monetary value formatting. Use this instead of
 * inlining `new Intl.NumberFormat(...)` per CLAUDE.md §3 (DRY).
 *
 * Default locale: de-CH (Swiss German). The currency code is the build-time
 * tenant currency (`TENANT_CURRENCY`, resolved in src/lib/config.ts from
 * NEXT_PUBLIC_TENANT_CURRENCY with a CHF fallback), so the default (RUMI)
 * build renders exactly the strings it always did.
 */

import { TENANT_CURRENCY } from '@/lib/config';

export { TENANT_CURRENCY };

const DEFAULT_LOCALE = 'de-CH';

/**
 * Format a numeric amount as a locale-aware currency string.
 *
 * @example
 *   formatCurrency(19.99)                    // "CHF 19.99" (default build)
 *   formatCurrency(1234.5, 'fr-FR', 'EUR')   // "1 234,50 €"
 *   formatCurrency(1234.5, 'de-CH', TENANT_CURRENCY, 0)  // "CHF 1'235"
 *
 * @param amount          Numeric value to format
 * @param locale          BCP-47 locale tag (default: de-CH)
 * @param currency        ISO 4217 currency code (default: tenant currency)
 * @param fractionDigits  Fixed fraction digits (sets min+max); omit for the
 *                        currency's Intl default
 */
export function formatCurrency(
  amount: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = TENANT_CURRENCY,
  fractionDigits?: number,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...(fractionDigits === undefined
      ? {}
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
  }).format(amount);
}

/**
 * Plain (non-Intl) currency string: `<CODE> <amount.toFixed(decimals)>`.
 *
 * Exact replacement for the historical `CHF ${x.toFixed(2)}` template
 * literals — deliberately NOT Intl.NumberFormat, which would insert
 * thousands separators ("CHF 1'234.50") and change rendered output.
 * `null`/`undefined` amounts render as the bare code + trailing space,
 * matching the previous `CHF {maybe?.toFixed(2)}` JSX output.
 *
 * @example
 *   formatPlainCurrency(19.99)    // "CHF 19.99"
 *   formatPlainCurrency(1234.5)   // "CHF 1234.50" (no grouping separator)
 *   formatPlainCurrency(0, 0)     // "CHF 0"
 *   formatPlainCurrency(undefined) // "CHF "
 */
export function formatPlainCurrency(amount: number | null | undefined, decimals: number = 2): string {
  return `${TENANT_CURRENCY} ${amount == null ? '' : amount.toFixed(decimals)}`;
}
