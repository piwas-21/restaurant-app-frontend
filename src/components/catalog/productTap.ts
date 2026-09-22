import type { CustomizationResult, ProductCustomizationDetail } from './productCustomizationTypes';

/**
 * The shared tap decision for staff catalogues: genuinely simple products are added immediately;
 * anything with a selectable row opens the existing customization sheet.
 */
export type ProductTapDecision = { kind: 'sheet' } | { kind: 'simple'; result: CustomizationResult };

export function decideProductTap(detail: ProductCustomizationDetail): ProductTapDecision {
  const orderableBase = !detail.hideBaseProduct || (detail.variations ?? []).some((variation) => variation.isActive);
  if (!orderableBase) return { kind: 'sheet' };

  if (
    (detail.variations?.some((variation) => variation.isActive) ?? false) ||
    (detail.detailedIngredients?.some((ingredient) => ingredient.isActive) ?? false) ||
    (detail.suggestedSideItems?.length ?? 0) > 0
  ) {
    return { kind: 'sheet' };
  }

  return {
    kind: 'simple',
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
