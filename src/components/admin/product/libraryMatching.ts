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

/**
 * Whether a catalog row is already on the product.
 *
 * The two keys are built by each catalog's own `attached…Keys`, which is where the provenance field
 * differs (`globalIngredientId` / `globalVariationId`); the LOOKUP is identical, and was written
 * twice until the variation picker made that a duplicated block. Both keys are needed because
 * provenance is new: every row typed before the pickers shipped carries only a name.
 */
export function isAlreadyAttached(row: { id: string; defaultName: string }, attachedKeys: Set<string>): boolean {
  return attachedKeys.has(`id:${row.id}`) || attachedKeys.has(`name:${fold(row.defaultName)}`);
}

/** Whether the row carries a name in the language the admin is reading the UI in. */
export function hasTranslationFor(row: { translations: { languageCode: string }[] }, languageCode: string): boolean {
  const primary = languageCode.split('-')[0];
  return row.translations.some((translation) => translation.languageCode.split('-')[0] === primary);
}

/**
 * Which rows the picker's BROWSE list admits, before the visible cap.
 *
 * The four rules in one place, because three of them already lived here and the fourth — the
 * tenant's own shelf (backend D14) — is the same kind of thing. It also keeps `useLibraryCatalog` a
 * state machine rather than a state machine plus a rule set; §4 holds that file at 200 lines.
 *
 * Order is load-bearing only for the first two: an ARCHIVED row is never offerable whatever else is
 * asked (plan D4), and the SHELF is a different list rather than a filter over one, so it is applied
 * before the search box so the "showing N of M" count is about the shelf the admin is looking at.
 */
export function admitsRow<
  TRow extends LibraryRow & {
    id: string;
    isArchived: boolean;
    origin?: 'system' | 'custom';
    translations: { languageCode: string; name: string }[];
  },
>(
  row: TRow,
  options: {
    query: string;
    filter: 'all' | 'notAdded' | 'translated';
    attachedKeys: Set<string>;
    languageCode: string;
    tenantOwnedOnly: boolean;
  },
): boolean {
  // The list endpoints promise to exclude archived rows, but this list is held in memory for as long
  // as the modal is open — so a row archived FROM the picker must stop being attachable at once,
  // not one refetch later.
  if (row.isArchived) return false;
  if (options.tenantOwnedOnly && row.origin !== 'custom') return false;
  if (!matchesQuery(row, options.query)) return false;
  if (options.filter === 'notAdded') return !isAlreadyAttached(row, options.attachedKeys);
  if (options.filter === 'translated') return hasTranslationFor(row, options.languageCode);
  return true;
}
