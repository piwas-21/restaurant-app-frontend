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
  // Destructure so the memo depends on the individual fields, not the (usually inline, so
  // per-render fresh) `args` object reference — otherwise the memo would never hit.
  const { kind, basePrice, quantity } = args;
  const variations = args.kind === 'product' ? args.variations : undefined;
  const selectedVariationId = args.kind === 'product' ? args.selectedVariationId : undefined;
  const ingredients = args.kind === 'product' ? args.ingredients : undefined;
  const selectedIngredientIds = args.kind === 'product' ? args.selectedIngredientIds : undefined;
  const ingredientQuantities = args.kind === 'product' ? args.ingredientQuantities : undefined;
  const sides = args.kind === 'product' ? args.sides : undefined;
  const selectedSides = args.kind === 'product' ? args.selectedSides : undefined;
  const sections = args.kind === 'bundle' ? args.sections : undefined;
  const selectedOptions = args.kind === 'bundle' ? args.selectedOptions : undefined;

  return useMemo(() => {
    const unitPrice =
      kind === 'bundle'
        ? bundleLineUnitPrice({ basePrice, sections: sections ?? [], selectedOptions: selectedOptions ?? [] })
        : productLineUnitPrice({
            basePrice,
            variations,
            selectedVariationId,
            ingredients,
            selectedIngredientIds: selectedIngredientIds ?? [],
            ingredientQuantities,
            sides,
            selectedSides,
          });

    return { unitPrice, total: lineTotal(unitPrice, quantity) };
  }, [
    kind,
    basePrice,
    quantity,
    variations,
    selectedVariationId,
    ingredients,
    selectedIngredientIds,
    ingredientQuantities,
    sides,
    selectedSides,
    sections,
    selectedOptions,
  ]);
}
