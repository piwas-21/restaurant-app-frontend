'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { buildBaseIngredientSelection } from '@/utils/ingredientSelection';
import { toPriceableIngredients } from '@/utils/priceableIngredient';
import { siblingsToDeselect } from '@/utils/exclusionGroup';
import { isSauce } from '@/utils/sauceGroup';
import { stepQuantity } from './waiterSelection';
import type { DetailedIngredient } from './productCustomizationTypes';

interface Selection {
  ids: Set<string>;
  quantities: Record<string, number>;
}

const EMPTY: Selection = { ids: new Set(), quantities: {} };

/**
 * The CHOOSABLE sauce rows on the line — distinct rows, never a quantity, the same count the guest's
 * `SauceGroupSection` keeps. Only optional rows: a required sauce is part of the base recipe, is never
 * offered as a chip, and must never spend the cap — or, under a cap of 1, be swapped OFF the dish.
 */
function selectedSauces(recipe: readonly DetailedIngredient[], ids: ReadonlySet<string>): DetailedIngredient[] {
  return recipe.filter((row) => row.isActive && row.isOptional && isSauce(row) && ids.has(row.id));
}

/**
 * What putting this row ON the line does to the sauce cap (P4). `admit` when it is not a sauce, there
 * is no cap, or there is room. Past the cap: a cap of 1 is the guest sheet's RADIO — choosing another
 * sauce swaps it in rather than dead-ending on "un-tap the first one" — and any larger cap refuses,
 * as the guest's checkbox group does.
 */
function sauceAdmission(
  recipe: readonly DetailedIngredient[],
  cap: number | null,
  ids: ReadonlySet<string>,
  ingredient: DetailedIngredient,
): 'admit' | 'swap' | 'refuse' {
  if (!isSauce(ingredient) || cap === null || ids.has(ingredient.id) || selectedSauces(recipe, ids).length < cap) {
    return 'admit';
  }
  return cap === 1 ? 'swap' : 'refuse';
}

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
  const recipe = useRef<readonly DetailedIngredient[]>([]);
  // The product's sauce cap, remembered beside the recipe it applies to. `null` is "no cap".
  const sauceMax = useRef<number | null>(null);

  /**
   * Open on the BASE RECIPE — every required ingredient, plus every optional one the base price
   * already paid for — which prices the line at exactly the advertised base. The sheet used to open
   * on an empty set, so an included-in-base ingredient looked like a paid extra the moment it was
   * ticked, and could never be taken off at all.
   */
  const seedFromBaseRecipe = useCallback((ingredients: readonly DetailedIngredient[], cap?: number | null) => {
    // The recipe is remembered here, in the one place it already arrives, so `toggleIngredient`
    // can see a row's exclusion-group siblings without every caller having to pass the list back.
    // A ref rather than state: it is read inside an event handler and never rendered, so storing it
    // in state would re-render the sheet on open for nothing.
    recipe.current = ingredients;
    sauceMax.current = cap ?? null;
    const base = buildBaseIngredientSelection(toPriceableIngredients(ingredients));
    setSelection({ ids: new Set(base.selectedIngredients), quantities: base.ingredientQuantities });
  }, []);

  const toggleIngredient = useCallback(
    (ingredient: DetailedIngredient) => {
      setSelection((prev) => {
        const ids = new Set(prev.ids);
        const nextQuantity = ids.delete(ingredient.id) ? 0 : 1;
        if (nextQuantity === 0) {
          return { ids, quantities: { ...prev.quantities, [ingredient.id]: 0 } };
        }

        // The sauce cap (P4), applied HERE and not at submit. The server rejects a fourth sauce with
        // `SauceMaximumExceeded` on the waiter path too, but a waiter standing at a table should not
        // learn the rule from a failed order. Same count as `SauceSelectionRule`: distinct active
        // sauce rows, so a non-sauce extra never spends the allowance and a quantity never does.
        const admission = sauceAdmission(recipe.current, sauceMax.current, prev.ids, ingredient);
        if (admission === 'refuse') return prev;

        // §9, and NOT optional parity work: the till bills what it declares
        // (`OrderItemFactory`, `pricesAreTrusted`), so a waiter sheet that let both members of an
        // exclusion group onto one line would charge for both AND print a contradictory ticket —
        // the same seam S7 closed for the CHF 2 included-in-base defect. A one-sauce cap swaps the
        // same way: the sauce already on the line leaves as this one arrives.
        const dropped = new Set(siblingsToDeselect(recipe.current, ingredient.id, prev.ids));
        if (admission === 'swap') selectedSauces(recipe.current, prev.ids).forEach((row) => dropped.add(row.id));
        dropped.forEach((id) => ids.delete(id));
        ids.add(ingredient.id);

        // A dropped sibling records an explicit 0, exactly as a de-selection does, so the removal
        // reaches the payload rather than merely vanishing from the selection.
        const quantities = { ...prev.quantities, [ingredient.id]: 1 };
        dropped.forEach((id) => {
          quantities[id] = 0;
        });
        return { ids, quantities };
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
        // The same cap, on the other writer of the id set: a plus on an unselected sauce is an add.
        // Today's chips only show a stepper on a SELECTED row, so this guards the hook, not the UI.
        const admission = next > 0 ? sauceAdmission(recipe.current, sauceMax.current, prev.ids, ingredient) : 'admit';
        if (admission === 'refuse') return prev;
        const ids = new Set(prev.ids);
        const quantities = { ...prev.quantities, [ingredient.id]: next };
        if (admission === 'swap') {
          selectedSauces(recipe.current, prev.ids).forEach((row) => {
            ids.delete(row.id);
            quantities[row.id] = 0;
          });
        }
        if (next > 0) ids.add(ingredient.id);
        else ids.delete(ingredient.id);
        return { ids, quantities };
      });
    },
    [setSelection],
  );

  return useMemo(
    () => ({
      selectedIngredients: selection.ids,
      ingredientQuantities: selection.quantities,
      /**
       * True once the cap is spent. Read together with `sauceMax` by the chips: a cap above 1 greys
       * the remaining sauces and says why; a cap of 1 keeps them live, because a tap swaps.
       * Safe to derive from refs inside this memo only because `seedFromBaseRecipe` always follows
       * its ref writes with a fresh `selection` identity — an early return there would stale this.
       */
      isSauceGroupFull:
        sauceMax.current !== null && selectedSauces(recipe.current, selection.ids).length >= sauceMax.current,
      seedFromBaseRecipe,
      toggleIngredient,
      stepIngredient,
    }),
    [selection, seedFromBaseRecipe, toggleIngredient, stepIngredient],
  );
}

export default useWaiterIngredientSelection;
