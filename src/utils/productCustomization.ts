import type { DetailedIngredient } from '@/types/menu';

/**
 * Total price for a bundle product customization: base price plus/minus ingredient adjustments
 * (included-in-base ingredients are deducted when deselected and charged for extra quantity; other
 * selected ingredients are charged per quantity). Extracted from
 * ProductCustomizationInBundle.calculateTotalPrice (Sprint 4/6 god-file decomposition). Bundle-child
 * side items were dropped in the menu-bundles redesign slice 1 (backend #151) — a combo's sides
 * belong in the bundle definition as their own section, not as per-option extras.
 */
export function calculateCustomizationPrice(
  basePrice: number,
  detailedIngredients: DetailedIngredient[],
  selectedIngredients: Set<string>,
  ingredientQuantities: Record<string, number>,
): number {
  let total = basePrice;

  // Add ingredient costs
  detailedIngredients.forEach((ing) => {
    if (ing.isIncludedInBasePrice) {
      // Ingredient price is included in base price for 1 quantity
      const isSelected = selectedIngredients.has(ing.id);
      const quantity = ingredientQuantities[ing.id] || 1;

      if (!isSelected) {
        // Deselected: deduct the included quantity (1)
        total -= ing.price;
      } else if (quantity > 1) {
        // Selected with more than 1: add extra quantities beyond the free one
        total += ing.price * (quantity - 1);
      }
      // quantity == 1: already in base price, no change
    } else if (selectedIngredients.has(ing.id)) {
      // Regular optional ingredient (not included in base) — add price if user selected it
      const quantity = ingredientQuantities[ing.id] || 1;
      total += ing.price * quantity;
    }
  });

  return total;
}

/**
 * Default ingredient selection for a freshly-opened customization: every ingredient selected with
 * quantity 1 (optional ones can then be deselected). Extracted verbatim from the no-initial branch
 * of ProductCustomizationInBundle's init effect.
 */
export function buildDefaultIngredientSelections(detailedIngredients: DetailedIngredient[]): {
  selected: Set<string>;
  quantities: Record<string, number>;
} {
  const selected = new Set<string>();
  const quantities: Record<string, number> = {};

  // Every ingredient starts selected with quantity 1 — non-optional stays that
  // way, optional ones can be deselected in the UI. (Both cases are identical, so
  // no per-ingredient branch is needed.)
  detailedIngredients.forEach((ing) => {
    selected.add(ing.id);
    quantities[ing.id] = 1;
  });

  return { selected, quantities };
}
