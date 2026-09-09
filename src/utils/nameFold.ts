/**
 * Case- and accent-insensitive name folding, shared by every catalog matcher and by the
 * ingredient-translations manager's grouping key.
 *
 * Extracted from `components/admin/product/libraryMatching.ts` when the manager
 * (`utils/ingredientTranslationEntries.ts`) needed the identical folding outside a component:
 * a multilingual catalog has to answer "creme" with "Crème" — and two matchers folding
 * differently is how one says "same ingredient" while the other says "new". `libraryMatching`
 * re-exports this, so every existing picker import keeps working.
 */
export const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
