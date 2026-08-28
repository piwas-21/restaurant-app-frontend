import type { IngredientKind, ProductIngredient } from '@/types/menu';
import { ingredientsOfKind, mergeIngredientGroup } from './ingredientKind';

/**
 * Row ordering for the recipe groups — frontend **#593**, editor plan slice **S8**.
 *
 * ### Why this is not a one-line array swap
 *
 * `displayOrder` is a real persisted column on `ProductIngredient`, and until now **nothing in the
 * editor ever wrote it after the row was created**: `ProductIngredientsManager.addRow` stamps
 * `displayOrder: ingredients.length` once and no control has changed it since. So live data can
 * hold duplicates (two rows added while a third was being deleted), gaps, and values that disagree
 * with the array's own order. A "move" that only swapped two array entries would leave the column
 * saying something different from the screen, and the column is what a consumer sorts by.
 *
 * Every move therefore RENUMBERS. `withNormalisedDisplayOrder` is exported and applied on its own
 * so the repair is available without a move, and so its effect is testable in isolation.
 *
 * ### One numbering space for both kinds
 *
 * Ingredients and sauces are two views over ONE array (`ingredientKind.ts`), and `addRow` already
 * numbers across both — *"two rows of different kinds must not claim one position"*. Renumbering
 * keeps that invariant: positions are assigned over the merged array, not per group. A move inside
 * Ingredients therefore renumbers the sauces too, and does not move them: their relative order and
 * their array positions are untouched, which is exactly what `mergeIngredientGroup` guarantees.
 */

/** Positions 0..n-1 over the product's single array, replacing whatever was there. */
export function withNormalisedDisplayOrder(all: ProductIngredient[]): ProductIngredient[] {
  return all.map((row, position) => (row.displayOrder === position ? row : { ...row, displayOrder: position }));
}

/**
 * Move the row at `index` within its group by `delta` (-1 up, +1 down), and renumber.
 *
 * Returns the array UNCHANGED (same reference) when the move is impossible — off either end, or a
 * group with fewer than two rows. The caller can therefore commit unconditionally, and a disabled
 * button that is somehow clicked cannot produce a spurious dirty state.
 */
export function moveIngredientInGroup(
  all: ProductIngredient[],
  kind: IngredientKind,
  index: number,
  delta: -1 | 1,
): ProductIngredient[] {
  const group = ingredientsOfKind(all, kind);
  const target = index + delta;
  if (index < 0 || index >= group.length || target < 0 || target >= group.length) return all;

  const reordered = [...group];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  return withNormalisedDisplayOrder(mergeIngredientGroup(all, kind, reordered));
}

/*
 * There is deliberately no `canMove` helper here. The buttons' `disabled` is decided by the group
 * component, which already holds the group's own rows — `index > 0` and `index < rows.length - 1`
 * are exact there, and a helper that re-filters the whole array to answer the same question would
 * be a second source of truth for the ends of a list. This slice retires dead controls; it should
 * not ship a dead export.
 */
