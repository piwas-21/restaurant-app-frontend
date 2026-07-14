import type { PriceableIngredient } from './linePrice';

/**
 * The single ingredient-default rule for a freshly-opened customization (menu-bundles redesign
 * #175, slice 6). Replaces the three divergent FE rules — "all active" (`CustomizationModal`),
 * "non-optional only" (`ProductDetailsModal`), and "every ingredient" (`buildDefaultIngredientSelections`) —
 * with the backend's truth: preselect the **base recipe**, i.e. what you get at the base price.
 *
 * A default selection therefore starts the line at exactly the base price (customization delta 0):
 *  - required (non-optional) ingredients are always in — they define the dish and can't be removed;
 *  - optional ingredients are in **iff `isIncludedInBasePrice`** — those come free in the base and
 *    can be removed; optional add-ons that cost extra start unselected until the guest opts in.
 *
 * Inactive ingredients are never selected (they aren't offered). All defaults get quantity 1.
 */
export function buildBaseIngredientSelection(ingredients: readonly PriceableIngredient[]): {
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
} {
  const selectedIngredients: string[] = [];
  const ingredientQuantities: Record<string, number> = {};

  for (const ingredient of ingredients) {
    if (!ingredient.isActive) continue;
    const inBaseRecipe = !ingredient.isOptional || ingredient.isIncludedInBasePrice === true;
    if (!inBaseRecipe) continue;

    selectedIngredients.push(ingredient.id);
    ingredientQuantities[ingredient.id] = 1;
  }

  return { selectedIngredients, ingredientQuantities };
}
