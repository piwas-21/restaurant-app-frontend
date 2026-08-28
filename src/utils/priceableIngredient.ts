import type { PriceableIngredient } from './linePrice';

/**
 * The bridge between a sheet's ingredient rows and the ONE price math.
 *
 * `utils/linePrice.ts` is the single source of truth for what a customization costs — a faithful
 * port of the backend `BasketPricingService.CalculateIngredientCustomizationPrice`. It reads five
 * fields. Every sheet in the app holds its ingredients in a slightly different local shape, and the
 * waiter sheet's (`components/server/productCustomizationTypes.ts`) omitted two of the five
 * outright (`isIncludedInBasePrice`, `maxQuantity`) — which is how it came to run its own,
 * disagreeing arithmetic even though `GET /api/Products/{id}` had been sending both all along.
 *
 * Normalising here rather than widening each local type keeps the price math's input contract in
 * ONE place: a sheet that forgets a field gets a compile error, not a quietly cheaper line.
 */

/** What a sheet must be able to say about an ingredient for it to be priced. */
export interface IngredientPricingFields {
  id: string;
  /** Optional on the wire-adjacent shapes; a missing price is free, never a NaN. */
  price?: number;
  isOptional: boolean;
  isActive: boolean;
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
}

/**
 * Project any sheet's ingredient rows onto the price math's input shape.
 *
 * Nothing is filtered out here on purpose: `ingredientCustomizationPrice` already skips required
 * and inactive rows, and a second filter in front of it is a second place for the rule to drift.
 */
export function toPriceableIngredients(
  ingredients: readonly IngredientPricingFields[] | undefined,
): PriceableIngredient[] {
  return (ingredients ?? []).map((ingredient) => ({
    id: ingredient.id,
    price: ingredient.price ?? 0,
    isOptional: ingredient.isOptional,
    isActive: ingredient.isActive,
    isIncludedInBasePrice: ingredient.isIncludedInBasePrice,
    maxQuantity: ingredient.maxQuantity,
  }));
}

/** The quantity a selected ingredient sits at when nothing has stepped it. */
export const DEFAULT_INGREDIENT_QUANTITY = 1;

/**
 * The ceiling a stepper may reach. Mirrors the price math's own `maxQuantity ?? 1` default, so a
 * control can never offer a quantity the price would clamp away (and the server would refuse).
 */
export function maxIngredientQuantity(ingredient: { maxQuantity?: number }): number {
  return ingredient.maxQuantity ?? DEFAULT_INGREDIENT_QUANTITY;
}
