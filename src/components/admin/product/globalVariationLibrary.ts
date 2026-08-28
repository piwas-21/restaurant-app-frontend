import { LANGUAGE_CODES } from '@/config/languageConfig';
import { fold } from './libraryMatching';
import type { GlobalVariationSummary } from '@/services/globalVariationService';
import type { Variation } from './types';

/**
 * Pure library logic behind `GlobalVariationPickerModal` — "already added", and the mapping from a
 * catalog row to a product variation (plan S4). Kept out of the component so each rule can be
 * tested without a DOM. The matching and ranking rules are shared with the ingredient picker in
 * `libraryMatching`.
 */

/**
 * The keys that say "this product already has that variation".
 *
 * Two of them, for the same reason the ingredient picker needs two: a row picked from the library
 * carries `globalVariationId`, but every variation typed before this slice — which is all of them
 * on prod — carries only a name. Matching on the id alone would offer a product's whole existing
 * size ladder back as if it were new.
 */
export function attachedVariationKeys(variations: Pick<Variation, 'name' | 'globalVariationId'>[]): Set<string> {
  const keys = new Set<string>();
  variations.forEach((variation) => {
    if (variation.globalVariationId) keys.add(`id:${variation.globalVariationId}`);
    const name = fold(variation.name ?? '');
    if (name.length > 0) keys.add(`name:${name}`);
  });
  return keys;
}

/** A variation row as react-hook-form stores it: every field optional, because a blank row is real. */
interface StoredVariationRow {
  name?: string;
  globalVariationId?: string;
  displayOrder?: number;
}

/**
 * What the picker needs to know about the product, read from the form STORE at the moment the modal
 * opens.
 *
 * Read via `getValues`, never from `useFieldArray`'s `fields`. Two reasons, and the second one is a
 * correctness bug rather than a preference:
 *
 * 1. `fields` is a SNAPSHOT that no `setValue` refreshes — the very staleness that made S4 delete
 *    the old `Translated in N of 10 languages` readout, which counted the same array and so never
 *    moved as translations were typed.
 * 2. `moveVariation` (#593) RENUMBERS `displayOrder` through `setValue`, so after any reorder the
 *    `displayOrder` values in `fields` are simply wrong. Computing the next order from them would
 *    place a picked row on top of an existing one.
 *
 * `getValues` is non-reactive, so reading it on open costs no subscription and no re-render — which
 * is the whole reason the variations table is uncontrolled in the first place.
 */
export function readVariationRows(rows: StoredVariationRow[] | undefined): {
  attached: Pick<Variation, 'name' | 'globalVariationId'>[];
  nextDisplayOrder: number;
} {
  const list = rows ?? [];
  return {
    attached: list.map((row) => ({ name: row.name ?? '', globalVariationId: row.globalVariationId })),
    nextDisplayOrder: nextVariationDisplayOrder(list),
  };
}

/**
 * One past the highest `displayOrder` in use — NOT the row count.
 *
 * The count would be right only if the column were contiguous, and `useVariationReorder` says in as
 * many words that it is not: nothing wrote `displayOrder` after row creation until #593, so live
 * data "can hold gaps and duplicates", which is why a move re-stamps the whole array. A product
 * whose two rows sit at 2 and 7 has a count of 2, so appending at the count would COLLIDE with the
 * row already at 2 — and `displayOrder` is what every consumer sorts by.
 *
 * Taking the maximum is collision-free whatever the column looks like, and it keeps an appended row
 * at the END, which is where the admin just asked for it. A reorder afterwards repairs the gaps.
 */
export function nextVariationDisplayOrder(rows: StoredVariationRow[] | undefined): number {
  const orders = (rows ?? []).map((row) => row.displayOrder).filter((order): order is number => Number.isFinite(order));
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

export function isAlreadyAttached(variation: GlobalVariationSummary, attachedKeys: Set<string>): boolean {
  return attachedKeys.has(`id:${variation.id}`) || attachedKeys.has(`name:${fold(variation.defaultName)}`);
}

/**
 * A catalog row as a product variation.
 *
 * **`priceModifier` is 0, and that is not a placeholder to be filled in later by this function.**
 * The catalog deliberately carries no price (backend #431): a variation's money is more
 * product-specific than an ingredient's ever was — "Large" is +2.00 on a pizza and +0.50 on a
 * coffee — so the catalog holds the words and the product holds the number. 0 is the neutral
 * modifier, which means a picked row is immediately sellable at the base price rather than at a
 * wrong one, and the admin types the only fact the library could never have known.
 *
 * `content` is seeded for all ten supported locales because the editor renders `LANGUAGE_CODES`; a
 * shorter list silently offers fewer inputs than the screen has. The translations the catalog
 * carries are copied in — that is the nine free-text inputs this slice exists to save — and
 * `globalVariationId` records where they came from.
 *
 * COPY semantics (plan D3): the values are now the product's own. Editing the library row later
 * does not change them.
 *
 * No temporary id is minted, unlike the ingredient picker's `toProductIngredient`. A variation is
 * appended to a react-hook-form field array, which issues its own `field.id` for the React key, and
 * `variations[].id` means "the row the server already owns" to `UpdateProductCommand` — so putting
 * a `temp-` value there would be a claim about the database, not about the list on screen.
 */
export function toProductVariation(variation: GlobalVariationSummary, displayOrder: number): Variation {
  const content: Variation['content'] = {};
  LANGUAGE_CODES.forEach((language) => {
    content[language] = { name: '', description: '' };
  });
  variation.translations.forEach((translation) => {
    const language = translation.languageCode;
    content[language] = { name: translation.name, description: content[language]?.description ?? '' };
  });

  return {
    name: variation.defaultName,
    description: '',
    priceModifier: 0,
    isActive: true,
    displayOrder,
    globalVariationId: variation.id,
    content,
  };
}
