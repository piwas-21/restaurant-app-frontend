import enBundle from './en.json';
import deBundle from './de.json';
import trBundle from './tr.json';
import itBundle from './it.json';
import arBundle from './ar.json';
import frBundle from './fr.json';
import nlBundle from './nl.json';
import esBundle from './es.json';
import ruBundle from './ru.json';
import zhBundle from './zh.json';

const LOCALES: Record<string, Record<string, unknown>> = {
  en: enBundle,
  de: deBundle,
  tr: trBundle,
  it: itBundle,
  ar: arBundle,
  fr: frBundle,
  nl: nlBundle,
  es: esBundle,
  ru: ruBundle,
  zh: zhBundle,
};

/**
 * Every `t()` key the E9 sweep's fallbacks reach, checked against the REAL locale files.
 *
 * This exists because of a mistake worth not repeating. The sweep's recipe is
 * `getErrorMessage(err) ?? t('contextual')`, and swapping `||` for `??` makes fallbacks reachable
 * that were previously dead — `response.message` was never empty, so `t('deletion_failed')` had
 * never once rendered. `deletion_failed` was in NONE of the ten locales, and every unit test in
 * this slice stubs `t` (`(key) => key` or `(key, fallback) => fallback`), so not one of them could
 * see it. i18next has no missing-key handler configured here, so a miss renders the raw key or an
 * inline English default — in a Turkish or Arabic customer's error message.
 *
 * The check itself has to resolve keys the way i18next does, which is the second half of the
 * lesson: a first attempt at this looked only inside the nested `cashier` object and reported two
 * keys missing that were present all along as FLAT dotted keys (`"cashier.refresh_failed": …`).
 * i18next resolves the nested path first and falls back to the literal flat key
 * (`ignoreJSONStructure`), so "missing" is only true when BOTH forms are absent — and adding a
 * nested key beside an existing flat one silently shadows it.
 */
const resolve = (bundle: Record<string, unknown>, key: string): unknown => {
  const nested = key.split('.').reduce<unknown>((node, part) => {
    if (typeof node !== 'object' || node === null) return undefined;
    return (node as Record<string, unknown>)[part];
  }, bundle);
  return nested ?? bundle[key];
};

/**
 * Keys reached by a `?? t(…)` or `|| t(…)` fallback in code this sweep touched.
 *
 * Hand-maintained, and the repo-wide version it used to say was impossible now EXISTS:
 * `scripts/check-t-keys.mjs` (#417) reads every `t('literal')` callsite in `src/**`, resolves it the
 * same way, and fails on any that would render its own key. The backlog that blocked it — keys
 * missing from all ten bundles but called WITH an inline English default — is baselined there and
 * may not grow. So this file is no longer the only thing standing between a fallback and a raw key
 * on screen; it is the narrower check that these fourteen are TRANSLATED, not merely present.
 *
 * One gap that remains here and is covered there: renaming a key in a component passes both this
 * and the component's own test (which stubs `t`), because neither reads the callsite.
 *
 * `fidelity_balance_unavailable` is the one entry that matters most — it is the only site in the
 * sweep calling `t()` with no inline default, so a miss there is a raw key on a checkout screen.
 */
const FALLBACK_KEYS = [
  'unexpected_error',
  'deletion_failed',
  'delete_account_request_failed',
  'failed_to_load_orders',
  'product_not_found',
  'error_loading_rules',
  'error_deleting_rule',
  'failed_load_customer_discounts',
  'failed_delete_discount',
  'failed_load_fidelity_analytics',
  'cashier.zreport.error',
  'cashier.orders_refreshed',
  'fidelity_balance_unavailable',
  'tax',
];

describe('E9 fallback keys resolve in every locale', () => {
  it('in all ten', () => {
    const missing: string[] = [];
    for (const [locale, bundle] of Object.entries(LOCALES)) {
      for (const key of FALLBACK_KEYS) {
        const value = resolve(bundle, key);
        if (typeof value !== 'string' || value.trim() === '') missing.push(`${locale}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('none of them is defined twice, where the nested copy would shadow the flat one', () => {
    const shadowed: string[] = [];
    for (const [locale, bundle] of Object.entries(LOCALES)) {
      for (const key of FALLBACK_KEYS.filter((k) => k.includes('.'))) {
        const nested = key.split('.').reduce<unknown>((node, part) => {
          if (typeof node !== 'object' || node === null) return undefined;
          return (node as Record<string, unknown>)[part];
        }, bundle);
        if (nested !== undefined && bundle[key] !== undefined) shadowed.push(`${locale}:${key}`);
      }
    }
    expect(shadowed).toEqual([]);
  });
});
