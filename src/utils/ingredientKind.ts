import type { IngredientKind, ProductIngredient } from '@/types/menu';

/**
 * The one place that knows "an ingredient row with no `kind` is an ingredient"
 * (SHARED-MODIFIERS-AND-SAUCES-PLAN D8).
 *
 * `kind` is additive and optional on every wire shape — product ingredients, the global catalog,
 * the create/update bodies — because every row that exists on production today predates it. That
 * makes `?? 'ingredient'` a decision, not a formality, and a decision scattered across call sites
 * is one that will eventually be spelled `=== 'ingredient'` somewhere and quietly hide every legacy
 * row from the Ingredients group it belongs to. So it is written once, here.
 */
export const DEFAULT_INGREDIENT_KIND: IngredientKind = 'ingredient';

/** A row's kind, with the absent/unknown case resolved to `'ingredient'`. */
export function resolveIngredientKind(row: { kind?: string | null } | null | undefined): IngredientKind {
  return row?.kind === 'sauce' ? 'sauce' : DEFAULT_INGREDIENT_KIND;
}

/** The rows of one kind, in the order the product holds them. */
export function ingredientsOfKind(rows: ProductIngredient[], kind: IngredientKind): ProductIngredient[] {
  return rows.filter((row) => resolveIngredientKind(row) === kind);
}

/** Stamp a row with the kind of the group it was added to. */
export function withIngredientKind<T extends { kind?: IngredientKind }>(row: T, kind: IngredientKind): T {
  return { ...row, kind };
}

/**
 * Put one group's rows back into the product's single ingredient array.
 *
 * Ingredients and sauces are two VIEWS over one `detailedIngredients` array, never two states: the
 * payload has one list, the ids inside it are what order history references, and a split state
 * would have to be reconciled on every save. So a group edits its own slice and this merges it
 * back — each untouched row keeps its position and every one of its fields, including the ones no
 * control renders (`isIncludedInBasePrice`, `globalIngredientId`, `content`).
 *
 * Positional, not id-keyed, and deliberately: a group may add a row with no server id yet, remove
 * one, or reorder within itself, and all three are just "the slice now reads like this". Rows of
 * the OTHER kind never move, so a sauce cannot be reordered by an edit made in Ingredients.
 */
export function mergeIngredientGroup(
  all: ProductIngredient[],
  kind: IngredientKind,
  nextGroup: ProductIngredient[],
): ProductIngredient[] {
  const merged: ProductIngredient[] = [];
  let cursor = 0;

  all.forEach((row) => {
    if (resolveIngredientKind(row) !== kind) {
      merged.push(row);
      return;
    }
    // A slot the group no longer fills is a row the admin deleted.
    if (cursor < nextGroup.length) merged.push(nextGroup[cursor++]);
  });

  // Anything the group grew by lands after the rows the product already had.
  return [...merged, ...nextGroup.slice(cursor)];
}
