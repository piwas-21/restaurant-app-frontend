/**
 * Currency formatting utilities.
 *
 * Single source of truth for monetary value formatting. Use this instead of
 * inlining `new Intl.NumberFormat(...)` per CLAUDE.md §3 (DRY).
 *
 * Both the locale and the currency code are build-time tenant config
 * (`TENANT_LOCALE` / `TENANT_CURRENCY`, resolved in src/lib/config.ts from
 * NEXT_PUBLIC_TENANT_LOCALE / NEXT_PUBLIC_TENANT_CURRENCY, falling back to
 * de-CH / CHF), so the default (RUMI) build renders exactly the strings it
 * always did while a fr-FR/EUR tenant gets `8,00 €` rather than `EUR 8.00`.
 *
 * The locale is the TENANT's, never the viewer's UI language — see the
 * TENANT_LOCALE doc in src/lib/config.ts for why.
 */

import { TENANT_CURRENCY, TENANT_LOCALE } from '@/lib/config';

export { TENANT_CURRENCY, TENANT_LOCALE };

/**
 * Format a numeric amount as a locale-aware currency string.
 *
 * @example
 *   formatCurrency(19.99)                    // "CHF 19.99" (default build)
 *   formatCurrency(1234.5, 'fr-FR', 'EUR')   // "1 234,50 €"
 *   formatCurrency(1234.5, 'de-CH', TENANT_CURRENCY, 0)  // "CHF 1'235"
 *
 * @param amount          Numeric value to format
 * @param locale          BCP-47 locale tag (default: the tenant locale)
 * @param currency        ISO 4217 currency code (default: tenant currency)
 * @param fractionDigits  Fixed fraction digits (sets min+max); omit for the
 *                        currency's Intl default
 */
export function formatCurrency(
  amount: number,
  locale: string = TENANT_LOCALE,
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

/** Intl's code/amount separator, normalised so the default build's strings stay byte-identical. */
const NON_BREAKING_SPACES = /[\u00A0\u202F]/g;

/**
 * The parts of a formatted price that carry the VALUE rather than the currency marker — dropped to
 * render a missing amount, and the anchor the minus sign is placed in front of. `infinity`/`nan`
 * belong here for the anchoring: without them a degenerate `-Infinity` would silently lose its
 * sign, since it produces no numeric part at all.
 */
const NUMERIC_PARTS = new Set(['integer', 'group', 'decimal', 'fraction', 'minusSign', 'infinity', 'nan']);

/**
 * Memoised per fraction-digit count. `formatPlainCurrency` replaced a template literal on hot
 * paths (every price in a menu list), and constructing an `Intl.NumberFormat` per call is orders
 * of magnitude slower. Safe to cache: both tenant constants are baked in at build time.
 */
const plainFormatters = new Map<number, Intl.NumberFormat>();

function plainFormatter(decimals: number): Intl.NumberFormat {
  const cached = plainFormatters.get(decimals);
  if (cached !== undefined) return cached;
  const formatter = new Intl.NumberFormat(TENANT_LOCALE, {
    style: 'currency',
    currency: TENANT_CURRENCY,
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  plainFormatters.set(decimals, formatter);
  return formatter;
}

/**
 * Ungrouped currency string: the amount at fixed decimals, placed and punctuated by the tenant
 * locale. `formatCurrency`'s sibling for the many sites that must NOT show a thousands separator.
 *
 * This replaced hand-written `CHF ${x.toFixed(2)}` template literals, and for the default
 * de-CH/CHF build it still renders those byte-for-byte — `useGrouping: false` keeps
 * "CHF 1234.50" from becoming "CHF 1'234.50". It can no longer be a template literal, though:
 * concatenating a code in front of `toFixed` is only right for locales that PREFIX the code, and
 * a French tenant needs "8,00 €", not "EUR 8.00".
 *
 * Two consequences of formatting through Intl, both deliberate:
 *
 * 1. Intl separates code from amount with U+00A0 (or U+202F). Those are normalised back to a
 *    plain space, so the default build's output is unchanged to the byte — an invisible
 *    substitution across ~70 call sites would otherwise break text selectors and screenshots.
 * 2. Intl rounds half away from zero on the decimal value where `toFixed` rounds the underlying
 *    binary double, so exact half-cent inputs shift: `formatPlainCurrency(1.005)` is now
 *    "CHF 1.01", not "CHF 1.00". That is the conventional money answer AND what `formatCurrency`
 *    has always returned for the same number — the two helpers used to disagree.
 *
 * `null`/`undefined` renders the currency marker alone, keeping the "CHF " (with its trailing
 * space) that `CHF {maybe?.toFixed(2)}` produced in JSX.
 *
 * @example
 *   formatPlainCurrency(19.99)     // "CHF 19.99"  | fr-FR/EUR: "19,99 €"
 *   formatPlainCurrency(1234.5)    // "CHF 1234.50" (no grouping separator)
 *   formatPlainCurrency(0, 0)      // "CHF 0"
 *   formatPlainCurrency(undefined) // "CHF "
 */
export function formatPlainCurrency(amount: number | null | undefined, decimals: number = 2): string {
  const formatter = plainFormatter(decimals);
  const render = (parts: Intl.NumberFormatPart[]) =>
    parts
      .map((part) => part.value)
      .join('')
      .replace(NON_BREAKING_SPACES, ' ');

  if (amount == null) return render(formatter.formatToParts(0).filter((part) => !NUMERIC_PARTS.has(part.type)));

  // Always format the MAGNITUDE and place the sign ourselves. Asking Intl for a negative drops the
  // code/amount separator in code-prefix locales — de-CH yields "CHF-3.50" where every call site
  // this replaced rendered "CHF -3.50" — while suffix locales are unaffected ("-3,50 €").
  const parts = formatter.formatToParts(Math.abs(amount));
  // `NaN` takes the unsigned path deliberately: it is neither >= 0 nor < 0, and the legacy
  // `CHF ${NaN.toFixed(2)}` rendered "CHF NaN" — not "CHF -NaN". `-0` lands here too, as it did.
  if (!(amount < 0)) return render(parts);

  const signed: Intl.NumberFormatPart[] = [];
  let signPlaced = false;
  for (const part of parts) {
    if (!signPlaced && NUMERIC_PARTS.has(part.type)) {
      signed.push({ type: 'minusSign', value: '-' });
      signPlaced = true;
    }
    signed.push(part);
  }
  return render(signed);
}

/**
 * What a catalog card prints for its price: the amount, or `from <amount>` when the card carries a
 * STARTING price rather than the price (Track F / F2 — a product whose base row is hidden is bought
 * at base + its cheapest active variation, so the bare figure is one no guest can pay).
 *
 * Takes `t` rather than calling `useTranslation` so it stays a pure function usable from both the
 * classic and the craft card, whose price rows share nothing else.
 */
export function cardPriceText(
  amount: number | null | undefined,
  isFrom: boolean | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const money = formatPlainCurrency(amount);
  return isFrom === true ? t('price_from', { price: money }) : money;
}
