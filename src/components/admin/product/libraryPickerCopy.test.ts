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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * THE GATE NOW READS THIS TABLE (#611): `check-t-keys.mjs` collects the value literals of any object
 * marked `@t-keys-table`, so deleting one of these keys from `en.json` fails CI on its own.
 *
 * This file is deliberately KEPT rather than reduced, because it checks something the gate does not
 * and cannot: the gate resolves against `en.json` ONLY — that is all a missing-key gate needs, since
 * i18next falls back to English — while this asserts every key in ALL TEN bundles. The two answer
 * different questions and the cheap one is not the strict one.
 *
 * It also pins the MARKER itself. The marker is the whole of the gate's opt-in, so deleting that one
 * comment would silently shrink the gate back to where #611 found it; here that is a red test.
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

  /*
   * The gate's opt-in, pinned (#611). `check-t-keys.mjs` only reads a table that carries this marker,
   * so the comment is not documentation — it is the whole of the coupling between this file and the
   * gate. Deleting it takes ~26 keys back out of CI's sight with every check still green, which is
   * the state #611 was filed to end.
   *
   * Asserted on the module SOURCE rather than on anything importable, because a marker in a comment
   * is invisible at runtime: there is nothing else to read it from.
   */
  it('carries the @t-keys-table marker that check-t-keys.mjs opts in on', () => {
    const source = readFileSync(join(__dirname, 'libraryPickerCopy.ts'), 'utf8');

    expect(source).toContain('@t-keys-table');
    // Above the table, not merely somewhere in the file: the scanner reads the first object literal
    // AFTER the marker, so a marker that trails the table would opt in and collect nothing.
    expect(source.indexOf('@t-keys-table')).toBeLessThan(source.indexOf('const COPY = {'));
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
