/**
 * First-paint copy: the text the SERVER renders, and the text the browser renders on its very
 * first pass before hydration.
 *
 * WHY A TWO-PASS RENDER AT ALL. Public locale-prefixed routes know their locale on the server, so
 * their first-paint copy is pinned to that URL. Unlocalized/private callers retain the English
 * fallback while browser language detection waits for hydration. Pinning both branches to the
 * same locale prevents a React hydration mismatch.
 *
 * WHAT THIS REPLACES. The English fallback used to be a string LITERAL typed into the component,
 * which had two defects. It said "Discover Authentic Turkish Flavors" on every tenant's home page —
 * tenant 1's identity, and precisely what a crawler and the first paint see. And where it was not
 * that, it had simply DRIFTED from the bundle: the server rendered "View Menu" and "Visit Us"
 * while the hydrated page said "Explore Our Menu" and "Find Us".
 *
 * HOW IT AVOIDS PAYING FOR THAT IN BYTES. It asks i18next for the key pinned to the route locale via
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

/** English fallback for unlocalized/private callers. Public URLs pass their explicit route locale. */
export const FIRST_PAINT_LOCALE = 'en';

/**
 * The copy function for the FIRST PAINT only: the selected bundle (plus this image's tenant copy
 * pack), pinned so it matches what the server rendered. After hydration the caller uses its own
 * `t` — which is why this takes no `isClient` flag and no `t`.
 *
 * Callers write `const copy = isClient ? t : firstPaintCopy(i18n)` and then ONE `copy('key')` per
 * string, instead of a ternary per string carrying a hand-typed English duplicate. That duplicate
 * was the actual defect (19 of them, several already drifted from the bundle); hiding the single
 * remaining ternary behind a boolean selector bought nothing and cost a reader one indirection —
 * `makeCopy(t, i18n, true)` says nothing at a callsite, and Sonar S2301 flags the shape for the
 * same reason. scripts/check-t-keys.mjs scans `copy(` alongside `t(`, so a key routed through here
 * still cannot go missing from the bundles unnoticed.
 */
export function firstPaintCopy(i18n: FixedLanguageSource, locale: string = FIRST_PAINT_LOCALE): CopyFn {
  return i18n.getFixedT(locale);
}
