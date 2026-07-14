import { useMemo } from 'react';
import {
  productLineUnitPrice,
  bundleLineUnitPrice,
  lineTotal,
  type PriceableIngredient,
  type PriceableVariation,
  type PriceableSide,
  type SelectedSide,
  type PriceableBundleSection,
  type SelectedBundleOption,
} from '@/utils/linePrice';

interface ProductLineArgs {
  kind: 'product';
  basePrice: number;
  quantity: number;
  variations?: readonly PriceableVariation[];
  selectedVariationId?: string | null;
  ingredients?: readonly PriceableIngredient[];
  selectedIngredientIds: Iterable<string>;
  ingredientQuantities?: Record<string, number>;
  sides?: readonly PriceableSide[];
  selectedSides?: readonly SelectedSide[];
}

interface BundleLineArgs {
  kind: 'bundle';
  basePrice: number;
  quantity: number;
  sections: readonly PriceableBundleSection[];
  selectedOptions: readonly SelectedBundleOption[];
}

export type UseLinePriceArgs = ProductLineArgs | BundleLineArgs;

export interface LinePrice {
  /** Price of a single line unit (before the quantity multiplier). */
  unitPrice: number;
  /** unitPrice × quantity — what the line adds to the basket. */
  total: number;
}

/**
 * Live, backend-faithful price for a customization line (menu-bundles redesign #175, slice 6). Thin
 * memoised wrapper over the pure `linePrice` functions so the customization sheet re-prices as the
 * guest toggles ingredients/options without duplicating (or drifting from) the server's rules.
 */
export function useLinePrice(args: UseLinePriceArgs): LinePrice {
  return useMemo(() => {
    const unitPrice =
      args.kind === 'bundle'
        ? bundleLineUnitPrice({
            basePrice: args.basePrice,
            sections: args.sections,
            selectedOptions: args.selectedOptions,
          })
        : productLineUnitPrice({
            basePrice: args.basePrice,
            variations: args.variations,
            selectedVariationId: args.selectedVariationId,
            ingredients: args.ingredients,
            selectedIngredientIds: args.selectedIngredientIds,
            ingredientQuantities: args.ingredientQuantities,
            sides: args.sides,
            selectedSides: args.selectedSides,
          });

    return { unitPrice, total: lineTotal(unitPrice, args.quantity) };
  }, [args]);
}
