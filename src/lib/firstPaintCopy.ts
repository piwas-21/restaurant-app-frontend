/**
 * First-paint copy: the text the SERVER renders, and the text the browser renders on its very
 * first pass before hydration.
 *
 * WHY A TWO-PASS RENDER AT ALL. The locale is chosen in the BROWSER (i18n.ts detects it from
 * localStorage → navigator), so the server cannot know it and renders `fallbackLng: 'en'`. If the
 * browser's first render used the detected language it would disagree with the server's HTML —
 * a React hydration mismatch. Both home templates therefore render `isClient ? … : …`, where the
 * first branch is the visitor's language and the second must be English.
 *
 * WHAT THIS REPLACES. That English branch used to be a string LITERAL typed into the component,
 * which had two defects. It said "Discover Authentic Turkish Flavors" on every tenant's home page —
 * tenant 1's identity, and precisely what a crawler and the first paint see. And where it was not
 * that, it had simply DRIFTED from the bundle: the server rendered "View Menu" and "Visit Us"
 * while the hydrated page said "Explore Our Menu" and "Find Us".
 *
 * HOW IT AVOIDS PAYING FOR THAT IN BYTES. It asks i18next for the same key pinned to English via
 * `getFixedT`, and it takes the instance from `useTranslation()` — which every caller already
 * holds — rather than importing one. That is load-bearing and was measured: importing `en.json`
 * here put a second copy of it in the home route's own chunk (`/`: 128.7 kB → 168.8 kB, +31%), and
 * importing `src/i18n` pulled in all ten bundles (508.2 kB, +295%). Both tripped
 * scripts/check-bundle-size.mjs. Reading the instance out of the React context costs nothing.
 *
 * Going through i18next also means the tenant copy pack (src/lib/tenantCopy.ts) reaches the
 * server-rendered HTML, and missing keys and interpolation behave exactly as they do after
 * hydration.
 */

/** Interpolation values, matching what the callers pass to `t()`. */
export type CopyVars = Readonly<Record<string, string | number>>;

/** `t()`-shaped: the one call signature both branches of the two-pass render share. */
export type CopyFn = (key: string, vars?: CopyVars) => string;

/** The subset of the i18next instance this needs. `useTranslation().i18n` satisfies it. */
export interface FixedLanguageSource {
  getFixedT(lng: string): CopyFn;
}

/** English, because `fallbackLng: 'en'` is what i18next resolves to on the server. */
export const FIRST_PAINT_LOCALE = 'en';

/**
 * The copy function for a two-pass render: the bundle's English before hydration, the visitor's own
 * language after it. Callers keep ONE `copy('key')` callsite instead of a ternary carrying a
 * hand-typed English duplicate — and scripts/check-t-keys.mjs scans `copy(` alongside `t(`, so such
 * a key still cannot go missing from the bundles unnoticed.
 */
export function makeCopy(translate: CopyFn, i18n: FixedLanguageSource, isClient: boolean): CopyFn {
  return isClient ? translate : i18n.getFixedT(FIRST_PAINT_LOCALE);
}
