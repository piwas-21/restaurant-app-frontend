import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { GlobalIngredientSummary } from '@/services/globalIngredientService';
import type { ProductIngredient } from '@/types/menu';

/**
 * Pure library logic behind `GlobalIngredientPickerModal` — matching, ordering, "already added",
 * and the mapping from a catalog row to a product ingredient. Kept out of the component so each
 * rule can be tested without a DOM, and out of `ProductIngredientsManager`, which is baselined and
 * may only shrink.
 */

/** How many rows the picker renders at once. The seeded catalog is 654 entries. */
export const MAX_VISIBLE_LIBRARY_ROWS = 50;

let temporaryIngredientCounter = 0;

/**
 * The client-side id for an ingredient row the server has never issued one for.
 *
 * `temp-` is a CONTRACT: `withoutTemporaryIds` strips it before the payload leaves, because a
 * supplied id means "update the row I already own" to `ProductIngredientSynchronizer` and an id it
 * does not own is skipped with a warning.
 *
 * A counter, not `Math.random()`. Two reasons, and neither is cryptography: the old
 * `Date.now()`-plus-random pair could still collide for two rows added inside one millisecond, and
 * a PRNG in an id is what Sonar S2245 flags — correctly, in the sense that a reader cannot tell
 * from the call site whether the value is load-bearing. A monotonic counter is collision-free
 * within the page, and the id never outlives the page.
 */
export function nextTemporaryIngredientId(): string {
  temporaryIngredientCounter += 1;
  return `temp-${temporaryIngredientCounter}`;
}

/**
 * Case- and accent-insensitive. The catalog is multilingual, so "creme" must find "Crème" —
 * Postgres' `ToLower().Contains()` behind `/search` does not do that, which is one more reason the
 * picker filters the browsed list itself.
 */
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Every name a row answers to: its default name plus all of its translations. */
const searchableNames = (ingredient: GlobalIngredientSummary): string[] => [
  ingredient.defaultName,
  ...ingredient.translations.map((translation) => translation.name),
];

export function matchesQuery(ingredient: GlobalIngredientSummary, query: string): boolean {
  const needle = fold(query);
  if (needle.length === 0) return true;
  return searchableNames(ingredient).some((name) => fold(name).includes(needle));
}

/**
 * Starts-with first, then alphabetical — the same order `SearchGlobalIngredientsQuery` applies
 * server-side, so browsing and searching do not disagree about what is most relevant.
 */
export function rankByQuery(ingredients: GlobalIngredientSummary[], query: string): GlobalIngredientSummary[] {
  const needle = fold(query);
  const startsWith = (ingredient: GlobalIngredientSummary) =>
    needle.length > 0 && searchableNames(ingredient).some((name) => fold(name).startsWith(needle));

  return [...ingredients].sort((a, b) => {
    const byPrefix = Number(startsWith(b)) - Number(startsWith(a));
    return byPrefix !== 0 ? byPrefix : a.defaultName.localeCompare(b.defaultName);
  });
}

/**
 * The keys that say "this product already has that ingredient".
 *
 * Two of them, because provenance is new: a row picked from the library carries
 * `globalIngredientId`, but every ingredient typed before this slice — which is all of them on
 * prod — carries only a name. Matching on the id alone would offer the whole existing recipe back
 * as if it were new.
 */
export function attachedLibraryKeys(ingredients: ProductIngredient[]): Set<string> {
  const keys = new Set<string>();
  ingredients.forEach((ingredient) => {
    if (ingredient.globalIngredientId) keys.add(`id:${ingredient.globalIngredientId}`);
    const name = fold(ingredient.name ?? '');
    if (name.length > 0) keys.add(`name:${name}`);
  });
  return keys;
}

export function isAlreadyAttached(ingredient: GlobalIngredientSummary, attachedKeys: Set<string>): boolean {
  return attachedKeys.has(`id:${ingredient.id}`) || attachedKeys.has(`name:${fold(ingredient.defaultName)}`);
}

/** Whether the row carries a name in the language the admin is reading the UI in. */
export function hasTranslationFor(ingredient: GlobalIngredientSummary, languageCode: string): boolean {
  const primary = languageCode.split('-')[0];
  return ingredient.translations.some((translation) => translation.languageCode.split('-')[0] === primary);
}

/**
 * A catalog row as a product ingredient.
 *
 * `content` is seeded for all ten supported locales, not the seven `handleAddIngredient` hardcodes:
 * the editor renders `LANGUAGE_CODES`, so a shorter list silently offers fewer inputs than the
 * screen has. The translations the catalog carries are copied in — that is the 10-free-text-fields
 * saving this whole slice exists for — and `globalIngredientId` records where they came from.
 *
 * COPY semantics (plan D3): the values are now the product's own. Editing the library row later
 * does not change them.
 */
export function toProductIngredient(ingredient: GlobalIngredientSummary, displayOrder: number): ProductIngredient {
  const content: NonNullable<ProductIngredient['content']> = {};
  LANGUAGE_CODES.forEach((language) => {
    content[language] = { name: '', description: '' };
  });
  ingredient.translations.forEach((translation) => {
    const language = translation.languageCode;
    content[language] = { name: translation.name, description: content[language]?.description ?? '' };
  });

  return {
    id: nextTemporaryIngredientId(),
    name: ingredient.defaultName,
    isOptional: false,
    maxQuantity: 1,
    price: 0,
    isActive: true,
    displayOrder,
    globalIngredientId: ingredient.id,
    content,
  };
}

/**
 * An EXISTING product ingredient re-pointed at a library row: the catalog's name and translations
 * are copied over it, its per-product facts (price, optional, quantity, order) are kept, and
 * `globalIngredientId` records where the text came from.
 *
 * This is the inline type-ahead's half of the same copy semantics the picker applies to new rows.
 * `as any` used to stand where `globalIngredientId` is written, because the field was believed not
 * to exist on the type; it does (`types/menu/shared.ts`).
 */
export function withLibraryProvenance(
  ingredient: ProductIngredient,
  library: GlobalIngredientSummary,
): ProductIngredient {
  // Not `?? {}`: spreading `undefined` already yields an empty object (Sonar S7744).
  const content: NonNullable<ProductIngredient['content']> = { ...ingredient.content };
  library.translations.forEach((translation) => {
    const existing = content[translation.languageCode];
    content[translation.languageCode] = { name: translation.name, description: existing?.description ?? '' };
  });

  return { ...ingredient, name: library.defaultName, globalIngredientId: library.id, content };
}
