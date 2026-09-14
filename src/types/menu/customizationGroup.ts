import type { ContentData, ProductIngredient } from './shared';

export interface ProductCustomizationIngredientOption {
  id: string;
  productIngredientId: string;
  displayOrder: number;
  isDefault: boolean;
}

export interface ProductCustomizationProductOption {
  id: string;
  optionProductId: string;
  optionProductName: string;
  additionalPrice: number;
  displayOrder: number;
  isDefault: boolean;
}

/** Ordered, server-authored choice group. An empty group list activates the legacy flow. */
export interface ProductCustomizationGroup {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  includedFreeUnits: number;
  isActive: boolean;
  content: ContentData;
  ingredientOptions: ProductCustomizationIngredientOption[];
  productOptions: ProductCustomizationProductOption[];
}

/** Numeric because the backend currently serializes CustomizationOptionKind without a string converter. */
export type CustomizationOptionKind = 0 | 1;

export interface CustomizationOptionSelection {
  kind: CustomizationOptionKind;
  /** Membership id, not the target ingredient/product id. */
  optionId: string;
  quantity: number;
}

export interface CustomizationGroupSelection {
  groupId: string;
  options: CustomizationOptionSelection[];
}

export interface CustomizationGroupCarrier {
  customizationGroups?: ProductCustomizationGroup[];
  detailedIngredients?: ProductIngredient[];
}
