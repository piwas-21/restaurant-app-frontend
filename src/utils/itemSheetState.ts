import type { DetailedProduct } from '@/types/menu';
import { firstActiveVariationId } from './baseProductVisibility';
import { buildBaseIngredientSelection } from './ingredientSelection';
import type { SelectedSide } from './linePrice';
import type { ProductLineInput } from '@/hooks/menu/useLinePrice';

/**
 * The pure open-state rules for the product body of the customization sheet (menu-bundles redesign
 * #175, slice 6) — what a freshly-opened sheet starts with, and whether it is worth opening at all.
 * Lifted out of `useItemCustomizationSheet` so both are unit-testable without React.
 */

/** Whether the product has anything to choose. Nothing to choose → the card adds it directly. */
export function hasCustomizationOptions(detail: DetailedProduct): boolean {
  return (
    (detail.variations?.length ?? 0) > 0 ||
    (detail.detailedIngredients?.length ?? 0) > 0 ||
    (detail.suggestedSideItems?.length ?? 0) > 0
  );
}

export interface InitialSheetState {
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  selectedSideItems: SelectedSide[];
  selectedVariationId: string | null;
}

/**
 * The line a guest sees before touching anything: the base recipe (the one default rule), the
 * restaurant's required sides, and the first variation. Prices at exactly the advertised base.
 */
export function buildInitialSheetState(detail: DetailedProduct): InitialSheetState {
  const base = buildBaseIngredientSelection(detail.detailedIngredients ?? []);

  return {
    selectedIngredients: base.selectedIngredients,
    ingredientQuantities: base.ingredientQuantities,
    selectedSideItems: (detail.suggestedSideItems ?? [])
      .filter((side) => side.isRequired)
      .map((side) => ({ id: side.id, quantity: 1 })),
    // The first radio the guest can SEE, not `variations[0]`: that took the first variation whether
    // or not it was active, so a product whose first variation was off opened on a selection with
    // no visible radio. Load-bearing since Track F / F2 — with the base row hidden, a null start
    // is an add the server refuses.
    selectedVariationId: firstActiveVariationId(detail.variations),
  };
}

/** What the guest has chosen so far — the mutable half of the price input. */
export interface SheetSelection {
  quantity: number;
  selectedVariationId: string | null;
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  selectedSideItems: SelectedSide[];
}

/**
 * The product line's price input, assembled in one place.
 *
 * Lifted out of `useItemCustomizationSheet` so the mapping from a payload to the money-path input
 * is pure and readable next to the seeding rules it mirrors — every field here has a counterpart in
 * `buildInitialSheetState`, and a field added to one and forgotten in the other is exactly how a
 * live total comes to disagree with what the server charges.
 */
export function toLinePriceInput(product: DetailedProduct | null, selection: SheetSelection): ProductLineInput {
  return {
    kind: 'product',
    basePrice: product?.basePrice ?? 0,
    quantity: selection.quantity,
    variations: product?.variations,
    selectedVariationId: selection.selectedVariationId,
    ingredients: product?.detailedIngredients,
    selectedIngredientIds: selection.selectedIngredients,
    ingredientQuantities: selection.ingredientQuantities,
    sauceIncludedFree: product?.sauceIncludedFree ?? 0,
    sides: product?.suggestedSideItems,
    selectedSides: selection.selectedSideItems,
  };
}
