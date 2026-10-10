import type { CustomizationGroupSelection } from './customizationGroup';

/** A customer's selected menu option and its nested choices. */
export interface SelectedMenuOption {
  sectionId: string;
  itemId: string;
  /** Stable MenuSectionItem.Id. Product and variation IDs can repeat across bundle choices. */
  menuSectionItemId?: string;
  /** Preserves a variation-aware section item through to SelectedMenuOptionDto. */
  productVariationId?: string | null;
  /** A dynamic variation chosen from the component product, separate from the fixed row variation. */
  componentProductVariationId?: string | null;
  /** Read-side modifier for local line-price preview; basket serialization strips it. */
  productVariationPriceModifier?: number | null;
  /** Read-side dynamic variation modifier; basket serialization strips it. */
  componentProductVariationPriceModifier?: number | null;
  quantity: number;
  specialInstructions?: string;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  customizationSelections?: CustomizationGroupSelection[];
  selectedSideItems?: SelectedBundleSideItem[];
}

export interface SelectedBundleSideItem {
  id: string;
  /** Stable ProductSideItem association row; `id` remains the selected Product.Id. */
  suggestedSideItemId?: string;
  quantity: number;
  productVariationId?: string | null;
}
