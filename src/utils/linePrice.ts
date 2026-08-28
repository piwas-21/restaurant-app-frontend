/**
 * Single source of truth for customer-facing line pricing — a faithful port of the backend
 * `BasketPricingService.CalculateIngredientCustomizationPrice` + the `BasketItemFactory` line/bundle
 * roll-up (menu-bundles redesign #175, slice 6). Replaces the three divergent FE price calculators
 * (`CustomizationModal.totalPrice`, `PriceCalculator`, `ProductCustomizationInBundle`), which drift
 * from the server's rules. Pure functions — no React, no I/O — so a unit test can pin them against
 * the backend semantics and the customization sheet (slice 6 PR2) can reuse them.
 *
 * The server is always authoritative on price (it recomputes on add-to-basket); this exists so the
 * live "Add • CHF X" the customer sees matches what the basket will charge.
 */

import { sauceWaiverAmount } from './sauceGroup';
import type { IngredientKind } from '@/types/menu';

/** The minimal ingredient shape pricing needs — satisfied by both `ProductIngredient` (optional
 *  `isIncludedInBasePrice`/`maxQuantity`) and `DetailedIngredient` (required). */
export interface PriceableIngredient {
  id: string;
  price: number;
  isOptional: boolean;
  isActive: boolean;
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
  /** Sauce rows are priced by the same per-row rule and THEN get the group allowance (S6). */
  kind?: IngredientKind;
  /** Only read to tie-break the free-sauce allowance deterministically (S6). */
  displayOrder?: number;
}

export interface PriceableVariation {
  id?: string;
  priceModifier: number;
}

export interface PriceableSide {
  id: string;
  price: number;
}

export interface SelectedSide {
  id: string;
  quantity: number;
}

const toIdSet = (ids: Iterable<string>): Set<string> => (ids instanceof Set ? ids : new Set(ids));

/**
 * The customization delta for a set of optional ingredients — mirrors the backend
 * `BasketPricingService.CalculateIngredientCustomizationPrice` exactly:
 *  - only `isOptional && isActive` ingredients count;
 *  - included-in-base: deselected → −price; selected with qty>1 → +price·(qty−1); qty 1 → 0;
 *  - not-included: selected → +price·qty;
 *  - quantity is clamped to [0, maxQuantity] (a missing `maxQuantity` defaults to 1) — the lower
 *    bound guards against a tampered negative quantity reducing the price.
 *
 * Then, and only then, the product's free-sauce allowance is taken off (S6 / D10): the per-row rule
 * above runs UNCHANGED for sauce rows too, and `sauceWaiverAmount` removes the `sauceIncludedFree`
 * most expensive charges it produced. `sauceIncludedFree: 0` — every product until an admin sets
 * one — subtracts nothing, so this function's answer is byte-identical to what it was before S6.
 */
export function ingredientCustomizationPrice(
  ingredients: readonly PriceableIngredient[] | undefined,
  selectedIngredientIds: Iterable<string>,
  ingredientQuantities?: Record<string, number>,
  sauceIncludedFree = 0,
): number {
  if (!ingredients) return 0;

  const selected = toIdSet(selectedIngredientIds);
  let delta = 0;

  for (const ingredient of ingredients) {
    if (!ingredient.isOptional || !ingredient.isActive) continue;

    const isSelected = selected.has(ingredient.id);
    const maxQuantity = ingredient.maxQuantity ?? 1;
    const rawQuantity = ingredientQuantities?.[ingredient.id] ?? 1;
    const quantity = Math.max(0, Math.min(maxQuantity, rawQuantity));

    if (ingredient.isIncludedInBasePrice) {
      if (!isSelected) {
        delta -= ingredient.price; // deselected: refund the one included piece
      } else if (quantity > 1) {
        delta += ingredient.price * (quantity - 1); // extra pieces beyond the free one
      }
    } else if (isSelected) {
      delta += ingredient.price * quantity;
    }
  }

  return delta - sauceWaiverAmount(ingredients, selected, ingredientQuantities, sauceIncludedFree);
}

/** Unit price (before the line quantity multiplier) of a single product: base + additive variation
 *  modifier + ingredient customization delta + selected top-level side items. */
export function productLineUnitPrice(params: {
  basePrice: number;
  variations?: readonly PriceableVariation[];
  selectedVariationId?: string | null;
  ingredients?: readonly PriceableIngredient[];
  selectedIngredientIds: Iterable<string>;
  ingredientQuantities?: Record<string, number>;
  /** The product's free-sauce allowance (`ProductDto.sauceIncludedFree`); 0 = today's pricing. */
  sauceIncludedFree?: number;
  sides?: readonly PriceableSide[];
  selectedSides?: readonly SelectedSide[];
}): number {
  const variation =
    params.selectedVariationId && params.variations
      ? params.variations.find((v) => v.id === params.selectedVariationId)
      : undefined;
  const base = params.basePrice + (variation?.priceModifier ?? 0);

  const ingredientDelta = ingredientCustomizationPrice(
    params.ingredients,
    params.selectedIngredientIds,
    params.ingredientQuantities,
    params.sauceIncludedFree ?? 0,
  );

  const sidesCost = (params.selectedSides ?? []).reduce((sum, selected) => {
    const side = params.sides?.find((s) => s.id === selected.id);
    return sum + (side?.price ?? 0) * selected.quantity;
  }, 0);

  return base + ingredientDelta + sidesCost;
}

/** One chosen option inside a bundle section, with its per-option ingredient customization. */
export interface SelectedBundleOption {
  sectionId: string;
  itemId: string;
  quantity: number;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
}

export interface PriceableBundleSectionItem {
  productId: string;
  additionalPrice: number;
  detailedIngredients?: readonly PriceableIngredient[];
  /**
   * The OPTION PRODUCT's own free-sauce allowance (S6 decision, mirrored by the server, which
   * prices a bundle child with `childProduct.SauceIncludedFree`): the option IS that product, and
   * the parent bundle owns no sauce rows for an allowance of its own to apply to.
   */
  sauceIncludedFree?: number;
}

export interface PriceableBundleSection {
  id: string;
  items: readonly PriceableBundleSectionItem[];
}

/** Unit price (before the line quantity multiplier) of a bundle: base + each chosen option's
 *  section additional price + that option's child ingredient customization, each scaled by the
 *  option quantity. Mirrors `BasketItemFactory.BuildMenuItemAsync`'s parent-unit-price roll-up. */
export function bundleLineUnitPrice(params: {
  basePrice: number;
  sections: readonly PriceableBundleSection[];
  selectedOptions: readonly SelectedBundleOption[];
}): number {
  let total = params.basePrice;

  for (const option of params.selectedOptions) {
    const section = params.sections.find((s) => s.id === option.sectionId);
    const item = section?.items.find((i) => i.productId === option.itemId);
    if (!item) continue;

    total += item.additionalPrice * option.quantity;
    total +=
      ingredientCustomizationPrice(
        item.detailedIngredients,
        option.selectedIngredients ?? [],
        option.ingredientQuantities,
        item.sauceIncludedFree ?? 0,
      ) * option.quantity;
  }

  return total;
}

/** Final line total = unit price × line quantity. */
export function lineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}
