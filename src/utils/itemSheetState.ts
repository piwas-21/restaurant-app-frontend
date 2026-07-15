import type { DetailedProduct } from '@/types/menu';
import { buildBaseIngredientSelection } from './ingredientSelection';
import type { SelectedSide } from './linePrice';

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
    selectedVariationId: detail.variations?.[0]?.id ?? null,
  };
}
