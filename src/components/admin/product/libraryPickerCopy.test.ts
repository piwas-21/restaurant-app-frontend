import ar from '@/locales/ar.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import itIT from '@/locales/it.json';
import nl from '@/locales/nl.json';
import ru from '@/locales/ru.json';
import tr from '@/locales/tr.json';
import zh from '@/locales/zh.json';

import { INGREDIENT_LIBRARY_COPY, VARIATION_LIBRARY_COPY } from './libraryPickerCopy';

/**
 * The gate this test stands in for.
 *
 * `scripts/check-t-keys.mjs` reads CALLSITES, and it matches only a quoted literal INSIDE the call:
 * `/\b(?:t|copy|staticText)\(\s*(['"])([^'"]+)\1\s*(,)?/g`. Every key below is still a literal —
 * it lives in `libraryPickerCopy.ts` and is greppable from the word it renders — but the shared
 * picker renders it as `t(copy.title)`, so no literal sits inside the call and the gate can no
 * longer see these keys. i18next renders THE KEY ITSELF when a key resolves to nothing, so a later
 * deletion from `en.json` would put `variation_library_title` on an admin's screen with every gate
 * green.
 *
 * This test is the interim guard for exactly that: it asserts the copy table against the bundles
 * instead of against the callsites. The real fix — teaching the gate to read a literal
 * `satisfies Record<..., string>` table — is a follow-up issue; until it lands, deleting one of
 * these keys turns this file red.
 */
// `it` is jest's test function here, so the Italian bundle is imported under another name.
const BUNDLES = { ar, de, en, es, fr, it: itIT, nl, ru, tr, zh } as const;

/** Resolve exactly as i18next does here: the NESTED path first, then the flat key. */
const resolve = (bundle: Record<string, unknown>, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      bundle,
    ) ?? bundle[key];

const KEYS = [
  ...Object.entries(INGREDIENT_LIBRARY_COPY).map(([slot, key]) => [`ingredient.${slot}`, key] as const),
  ...Object.entries(VARIATION_LIBRARY_COPY).map(([slot, key]) => [`variation.${slot}`, key] as const),
];

describe('libraryPickerCopy', () => {
  it('names a slot for both catalogs and repeats no key between them', () => {
    // Guards the table's own shape: a copy/paste that left one catalog pointing at the other's key
    // would still resolve, so bundle lookup alone cannot catch it.
    expect(Object.keys(INGREDIENT_LIBRARY_COPY)).toEqual(Object.keys(VARIATION_LIBRARY_COPY));
    expect(KEYS.length).toBeGreaterThanOrEqual(2);
    for (const slot of Object.keys(INGREDIENT_LIBRARY_COPY) as (keyof typeof INGREDIENT_LIBRARY_COPY)[]) {
      expect(INGREDIENT_LIBRARY_COPY[slot]).not.toBe(VARIATION_LIBRARY_COPY[slot]);
    }
  });

  it.each(KEYS)('%s renders a translation, not its own key, in every one of the ten bundles', (_slot, key) => {
    for (const [locale, bundle] of Object.entries(BUNDLES)) {
      const value = resolve(bundle as unknown as Record<string, unknown>, key);
      expect(typeof value === 'string' && value.length > 0 ? value : `MISSING in ${locale}: ${key}`).not.toBe(
        `MISSING in ${locale}: ${key}`,
      );
    }
  });
});
