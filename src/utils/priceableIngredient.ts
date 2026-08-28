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

/**
 * The typed option group a row belongs to (backend #426). Lowercase on the wire, and ABSENT means
 * an ordinary ingredient — declared structurally here rather than imported, because the shared
 * `IngredientKind` alias arrives with the guest sauces slice (#596) and this file must compile
 * before it. The two are the same union, so the alias drops in without a change here.
 */
export type PriceableIngredientKind = 'ingredient' | 'sauce';

/** What a sheet must be able to say about an ingredient for it to be priced. */
export interface IngredientPricingFields {
  id: string;
  /** Optional on the wire-adjacent shapes; a missing price is free, never a NaN. */
  price?: number;
  isOptional: boolean;
  isActive: boolean;
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
  /**
   * The two fields the SAUCE GROUP rule reads (#596). Nothing prices on them yet, and they are
   * carried anyway — because the failure mode if they are not is silent.
   *
   * `kind` is what makes a row eligible for the group's free allowance at all, and `displayOrder`
   * is the deterministic tie-break when two sauces cost the same. Drop them here and every row
   * arriving through this bridge has `kind === undefined`, so the allowance waives nothing, so the
   * waiter sheet charges for a sauce the guest sheet gives away — the exact disagreement S7 exists
   * to end, reappearing through the normaliser instead of through two copies of the arithmetic.
   * No type error, no failing test, just a bigger number. Pinned by
   * `__tests__/priceableIngredient.test.ts`.
   */
  kind?: PriceableIngredientKind;
  displayOrder?: number;
}

/**
 * What the bridge answers with: the price math's input, widened by the group fields it does not
 * read yet. An intersection rather than an edit to `PriceableIngredient`, so #594 and #596 do not
 * both change `linePrice.ts`; once that type carries them itself this is simply redundant.
 */
export type PriceableIngredientRow = PriceableIngredient & Pick<IngredientPricingFields, 'kind' | 'displayOrder'>;

/**
 * Project any sheet's ingredient rows onto the price math's input shape.
 *
 * Nothing is filtered out here on purpose: `ingredientCustomizationPrice` already skips required
 * and inactive rows, and a second filter in front of it is a second place for the rule to drift.
 */
export function toPriceableIngredients(
  ingredients: readonly IngredientPricingFields[] | undefined,
): PriceableIngredientRow[] {
  return (ingredients ?? []).map((ingredient) => ({
    id: ingredient.id,
    price: ingredient.price ?? 0,
    isOptional: ingredient.isOptional,
    isActive: ingredient.isActive,
    isIncludedInBasePrice: ingredient.isIncludedInBasePrice,
    maxQuantity: ingredient.maxQuantity,
    // Pass-through, never defaulted: `undefined` already means "an ordinary ingredient" and "no
    // order", and the rules that read them apply those degrades themselves. Defaulting here would
    // put a second opinion about them in the bridge.
    kind: ingredient.kind,
    displayOrder: ingredient.displayOrder,
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
