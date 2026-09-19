import type { CustomizationResult, ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';

/**
 * The tap decision for the counter catalog (cashier POS plan §5.3.2): a simple product adds on
 * the tap; a product with ANY choosable row — variation, ingredient, suggested side — opens the
 * shared customization sheet instead. The same three sources the sheet itself reads decide, so
 * the two paths cannot disagree about what "simple" means.
 */

export type TapDecision = { kind: 'sheet' } | { kind: 'simple'; result: CustomizationResult };

export function decideTap(detail: ProductCustomizationDetail): TapDecision {
  const orderableBase = !detail.hideBaseProduct || (detail.variations ?? []).some((variation) => variation.isActive);
  if (!orderableBase) {
    // The sheet explains a product with no orderable option (F2) rather than the tap failing silently.
    return { kind: 'sheet' };
  }
  if (
    (detail.variations?.some((variation) => variation.isActive) ?? false) ||
    (detail.detailedIngredients?.some((ingredient) => ingredient.isActive) ?? false) ||
    (detail.suggestedSideItems?.length ?? 0) > 0
  ) {
    return { kind: 'sheet' };
  }
  return {
    kind: 'simple',
    // Nothing chosen, because the detail fetch above proved there is nothing to choose. The
    // empty `selectedIngredientIds` is the TRUE answer here — the product has no ingredient
    // rows at all — and it makes the server price the line from the catalogue, which is the point.
    result: {
      productId: detail.id,
      addedIngredients: [],
      removedIngredients: [],
      selectedIngredientIds: [],
      ingredientQuantities: {},
      sideItems: [],
      finalPrice: detail.basePrice,
    },
  };
}
