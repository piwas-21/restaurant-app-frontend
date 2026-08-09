import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every i18n key the menu section's status states name actually exists (S10).
 *
 * Written because one of them did not. `MenuContent.tsx` has always resolved the bundles-view
 * error with `t('error_loading_menu_bundles', { categoryName })` — a key that was absent from **all
 * ten** locale files. The second argument there is an options object, not a fallback, so i18next
 * returned the key: a guest whose Menu Bundles view failed to load was shown the literal string
 * `error_loading_menu_bundles`.
 *
 * Nothing could see it. `scripts/check-locale-parity.mjs` compares the ten locales to each other,
 * and they agreed perfectly — all ten were missing it. The screenshot suite only captures a
 * successful load. Jest never rendered `MenuContent`. And TypeScript cannot type a string literal
 * against a JSON file it does not read. Parity is a claim about the locales; this is the claim
 * about the SOURCE, and only the second one catches a key nobody ever wrote.
 *
 * Deliberately scoped to this one file rather than the tree. Repo-wide the same scan finds SEVEN
 * more fallback-less references to keys that do not exist, across five files — `page_info`
 * (admin orders pagination), `delete_customer_permanent_confirmation_message` (member management),
 * `max_default_items_reached` and `custom_schedule_help` (the two admin menu editors), and
 * `confirm_bulk_action` / `confirm_bulk_cancel` / `export_failed`
 * (`hooks/admin/useAdminReservationMutations.ts`). All real, all user-visible, all a different
 * slice's work.
 *
 * The house idiom for that is a baseline file — `check-file-length.sh --regen-baseline` and
 * `check-locale-parity.mjs`'s own `491 known` untranslated count both do it — so the follow-up is a
 * repo-wide script with a seven-entry baseline, not a wider version of this test. Scoping here is a
 * slice boundary, not a claim that the rest is clean.
 */

const SOURCE = readFileSync(join(__dirname, 'MenuContent.tsx'), 'utf8');
const LOCALES = ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh'] as const;

/**
 * Keys named with NO string fallback — `t('x')` or `t('x', { … })`.
 *
 * The distinction is the whole point: `t('x', 'Some text')` renders "Some text" when `x` is
 * missing, which is untranslated but harmless. Only the fallback-less form puts a raw snake_case
 * identifier in front of a guest, and that is what this asserts against.
 *
 * The scan balances parentheses instead of matching `t('key'` directly, because the defect this
 * file exists for is not written that way — the bundles error is chosen by a nested ternary and the
 * key literal never touches the `t(`. The first version of this regex therefore found **zero** keys
 * and every per-locale assertion below passed vacuously; only the corpus assertion caught it. A
 * gate that reports nothing is not a gate that found nothing.
 *
 * The key pattern allows a SINGLE word (`retry`), which the first version did not: it required an
 * underscore, so every one-word key was invisible — including `retry`, which this very file's
 * subject names. Two evasions remain and are accepted: a key built from a template literal, and a
 * key held in a `const`. Neither appears in `MenuContent.tsx`, and catching them needs a real
 * parser rather than a wider regex.
 */
/**
 * Keys chosen by a LOCAL HELPER — `t(errorKeyFor(view, isBundles), { … })`.
 *
 * Without this the scan sees only the identifier `errorKeyFor` and reports zero keys for the error
 * state, which is exactly the hole that let `error_loading_menu_bundles` ship missing in the first
 * place. It regressed the moment that ternary moved out of the `t(` call to satisfy a
 * cognitive-complexity rule: the gate went green while covering strictly less. That is the failure
 * mode the corpus assertion below exists to catch, and it did.
 */
function keysFromKeyHelpers(source: string): string[] {
  const keys: string[] = [];
  for (const [, helper] of source.matchAll(/\bt\(\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    const at = source.indexOf(`function ${helper}(`);
    if (at === -1) continue;
    const body = source.slice(at, source.indexOf('\n}', at));
    keys.push(...[...body.matchAll(/'([a-z][a-z0-9_]*)'/g)].map(([, key]) => key));
  }
  return keys;
}

function keysWithoutFallback(source: string): string[] {
  const keys: string[] = [];

  keys.push(...keysFromKeyHelpers(source));

  for (const call of source.matchAll(/\bt\(/g)) {
    let depth = 0;
    let end = call.index!;
    // From just INSIDE the opening paren. Starting on it counts it as a nested one, and the call's
    // own `)` then only returns depth to 0 without breaking — which left `end` at the `t`, made
    // every `args` slice empty, and passed ten per-locale assertions on an empty key list.
    for (let i = call.index! + 2; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    const args = source.slice(call.index! + 2, end);

    // A top-level string second argument is a fallback: `t(<key>, 'Some text')`. Anything else —
    // `t(<key>)` or `t(<key>, { … })` — renders the key itself when the key is missing.
    if (/,\s*'[^']*'\s*(?:,|$)/.test(args.replace(/\{[\s\S]*$/, ''))) continue;
    keys.push(...[...args.matchAll(/'([a-z][a-z0-9_]*)'/g)].map(([, key]) => key));
  }

  return [...new Set(keys)];
}

describe('menu section status i18n keys', () => {
  const keys = keysWithoutFallback(SOURCE);

  /** The gate is only as good as its corpus — an empty list would pass every assertion below. */
  it('finds the keys it is supposed to be checking', () => {
    expect(keys).toEqual(expect.arrayContaining(['error_loading_menu_bundles', 'no_bundles_available']));
    // `error_loading_menu_bundles` is now returned by `errorKeyFor` rather than written inside the
    // `t(` call, so this also pins that the helper-following branch above is doing its job.
    expect(keys).toEqual(expect.arrayContaining(['error_loading_all_menu_items', 'error_loading_menu_items']));
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });

  it.each(LOCALES)('%s defines every key MenuContent names without a fallback', (locale) => {
    const bundle: Record<string, string> = JSON.parse(
      readFileSync(join(__dirname, `../../locales/${locale}.json`), 'utf8'),
    );

    expect(keys.filter((key) => !(key in bundle))).toEqual([]);
  });

  /**
   * Fires the defect, so the assertion above is known to be measuring something: a key nobody
   * defined renders as itself, in every locale at once, and locale parity stays green throughout.
   */
  it('records that a missing key renders as its own name, with parity intact', () => {
    const bundles = LOCALES.map((locale) =>
      JSON.parse(readFileSync(join(__dirname, `../../locales/${locale}.json`), 'utf8')),
    );

    expect(bundles.every((b) => !('error_loading_menu_bundles_absent_by_construction' in b))).toBe(true);
    // Parity holds across all ten for a key none of them has — which is why the parity gate was
    // green while the page printed `error_loading_menu_bundles` at a guest.
    expect(new Set(bundles.map((b) => 'error_loading_menu_bundles_absent_by_construction' in b)).size).toBe(1);
  });
});
