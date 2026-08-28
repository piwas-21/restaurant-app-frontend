/**
 * The matching, ranking and cap rules shared by every catalog picker (plan S2 for ingredients,
 * S4 for variations).
 *
 * Extracted rather than written twice. Both libraries are the same shape — a default name plus a
 * list of translated names — and the interesting part is not the shape but the FOLDING: a
 * multilingual catalog has to answer "creme" with "Crème", and Postgres' `ToLower().Contains()`
 * behind the ingredient `/search` endpoint does not. That rule earning a second copy is exactly how
 * two pickers end up disagreeing about what matches.
 *
 * The type is structural on purpose: it names what the rules read, not which catalog a row came
 * from, so neither service has to depend on the other.
 */

/** Everything these rules need from a catalog row. */
export interface LibraryRow {
  defaultName: string;
  translations: { name: string }[];
}

/** How many rows a picker renders at once. The seeded ingredient catalog is 654 entries. */
export const MAX_VISIBLE_LIBRARY_ROWS = 50;

/**
 * Case- and accent-insensitive. The catalog is multilingual, so "creme" must find "Crème" — which
 * is one more reason a picker filters the browsed list itself instead of asking the server.
 */
export const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Every name a row answers to: its default name plus all of its translations. */
export const searchableNames = (row: LibraryRow): string[] => [
  row.defaultName,
  ...row.translations.map((translation) => translation.name),
];

export function matchesQuery(row: LibraryRow, query: string): boolean {
  const needle = fold(query);
  if (needle.length === 0) return true;
  return searchableNames(row).some((name) => fold(name).includes(needle));
}

/**
 * Starts-with first, then alphabetical — the same order `SearchGlobalIngredientsQuery` applies
 * server-side, so browsing and searching do not disagree about what is most relevant.
 */
export function rankByQuery<T extends LibraryRow>(rows: T[], query: string): T[] {
  const needle = fold(query);
  const startsWith = (row: T) =>
    needle.length > 0 && searchableNames(row).some((name) => fold(name).startsWith(needle));

  return [...rows].sort((a, b) => {
    const byPrefix = Number(startsWith(b)) - Number(startsWith(a));
    return byPrefix !== 0 ? byPrefix : a.defaultName.localeCompare(b.defaultName);
  });
}

/** Whether the row carries a name in the language the admin is reading the UI in. */
export function hasTranslationFor(row: { translations: { languageCode: string }[] }, languageCode: string): boolean {
  const primary = languageCode.split('-')[0];
  return row.translations.some((translation) => translation.languageCode.split('-')[0] === primary);
}
