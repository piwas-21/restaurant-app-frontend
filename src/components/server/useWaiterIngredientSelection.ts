'use client';

import { useCallback, useMemo, useState } from 'react';
import { buildBaseIngredientSelection } from '@/utils/ingredientSelection';
import { toPriceableIngredients } from '@/utils/priceableIngredient';
import { stepQuantity } from './waiterSelection';
import type { DetailedIngredient } from './productCustomizationTypes';

interface Selection {
  ids: Set<string>;
  quantities: Record<string, number>;
}

const EMPTY: Selection = { ids: new Set(), quantities: {} };

/**
 * Which ingredients are on the waiter's line, and how many of each.
 *
 * Its own file because `useProductCustomizationSheet` is capped at 200 LOC by the §4 length gate,
 * and because this is the state the guest sheet and the waiter sheet must agree on: the pair
 * (selected ids, quantities) is exactly what `utils/linePrice.ts` prices and what the basket
 * payload carries.
 *
 * The two halves are held in ONE state object on purpose. They are a single fact — an ingredient
 * selected with no quantity, or a quantity on an unselected ingredient, are both states the price
 * math would read and no UI could produce — and two `useState`s let a functional update see a stale
 * copy of the other.
 *
 * The rule worth stating: de-selection records quantity 0, not 1. The backend derives `IsRemoved`
 * from a 0 (issue #150), so a 1 there silently re-adds the ingredient to the kitchen ticket.
 * `OptionalIngredientsSection` on the guest side does the same thing for the same reason.
 */
export function useWaiterIngredientSelection() {
  const [selection, setSelection] = useState<Selection>(EMPTY);

  /**
   * Open on the BASE RECIPE — every required ingredient, plus every optional one the base price
   * already paid for — which prices the line at exactly the advertised base. The sheet used to open
   * on an empty set, so an included-in-base ingredient looked like a paid extra the moment it was
   * ticked, and could never be taken off at all.
   */
  const seedFromBaseRecipe = useCallback((ingredients: readonly DetailedIngredient[]) => {
    const base = buildBaseIngredientSelection(toPriceableIngredients(ingredients));
    setSelection({ ids: new Set(base.selectedIngredients), quantities: base.ingredientQuantities });
  }, []);

  const toggleIngredient = useCallback(
    (ingredient: DetailedIngredient) => {
      setSelection((prev) => {
        const ids = new Set(prev.ids);
        const nextQuantity = ids.delete(ingredient.id) ? 0 : 1;
        if (nextQuantity > 0) ids.add(ingredient.id);
        return { ids, quantities: { ...prev.quantities, [ingredient.id]: nextQuantity } };
      });
    },
    [setSelection],
  );

  /** One press of a stepper; a minus at 1 removes the ingredient rather than dead-ending on it. */
  const stepIngredient = useCallback(
    (ingredient: DetailedIngredient, change: number) => {
      setSelection((prev) => {
        const current = prev.ids.has(ingredient.id) ? (prev.quantities[ingredient.id] ?? 1) : 0;
        const next = stepQuantity(current, change, ingredient);
        const ids = new Set(prev.ids);
        if (next > 0) ids.add(ingredient.id);
        else ids.delete(ingredient.id);
        return { ids, quantities: { ...prev.quantities, [ingredient.id]: next } };
      });
    },
    [setSelection],
  );

  return useMemo(
    () => ({
      selectedIngredients: selection.ids,
      ingredientQuantities: selection.quantities,
      seedFromBaseRecipe,
      toggleIngredient,
      stepIngredient,
    }),
    [selection, seedFromBaseRecipe, toggleIngredient, stepIngredient],
  );
}

export default useWaiterIngredientSelection;
