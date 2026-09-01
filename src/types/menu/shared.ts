/**
 * Shared leaf types for the menu/product domain: content, images, tags, ingredients,
 * variations, side items, and the kitchen/product enums. Extracted from types/menu.ts
 * (Sprint 4/6 type-file split by domain). No dependencies on the other menu modules.
 */

import type { OrderType } from '@/types/order';

export interface MenuItemContent {
  name: string;
  description: string;
  ingredient: string;
}

export type DietaryTag = 'vegan' | 'halal' | 'gluten-free' | 'vegetarian' | string;

export interface MenuItemImage {
  url: string;
  alt: string;
}

/**
 * A sauce is an ingredient row carrying a discriminator, not a second entity (plan D7/D8) — the one
 * shape with zero impact on the `Guid` keys frozen in `OrderItem.IngredientQuantitiesJson`. Absent
 * means `'ingredient'`: resolve it with `resolveIngredientKind` (`@/utils/ingredientKind`). */
export type IngredientKind = 'ingredient' | 'sauce';

/** Detailed ingredient with optional/pricing information */
export interface ProductIngredient {
  id: string;
  name: string;
  kind?: IngredientKind;
  isOptional: boolean;
  maxQuantity?: number; // Maximum quantity allowed for this ingredient (default 1)
  price: number;
  isIncludedInBasePrice?: boolean; // If true, price is included in base and deducted when deselected
  isActive: boolean;
  displayOrder: number;
  // Multilingual support
  content?: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
  globalIngredientId?: string;
  /** Mutual-exclusion group (§9); absent/blank = no group. Read via `@/utils/exclusionGroup`. */
  exclusionGroup?: string | null;
}

export interface DetailedIngredient {
  id: string;
  name: string;
  isOptional: boolean;
  price: number;
  isIncludedInBasePrice: boolean;
  isActive: boolean;
  displayOrder: number;
  maxQuantity: number;
  kind?: IngredientKind; // Ingredient or sauce (S5), `MenuBundleIngredientDto.kind`; absent = ingredient
  exclusionGroup?: string | null; // Mutual-exclusion group (§9); absent = no group. See @/utils/exclusionGroup
  content?: Record<string, { name: string; description?: string }>;
}

export interface DetailedProductVariation {
  id: string;
  name: string;
  description?: string;
  /** Which global variation row this was copied from — provenance only (plan S4, backend #431). */
  globalVariationId?: string;
  priceModifier: number;
  finalPrice: number;
  isActive: boolean;
  displayOrder: number;
  content?: Record<string, { name: string; description?: string }>;
}

/**
 * A suggested side-item *product* offered alongside a product, featured special,
 * or customer-facing menu item — carries the product's own name/price/images.
 * Mirrors backend Products `SideItemDto`
 * (RestaurantSystem.Api/Features/Products/Dtos/SideItemDto.cs).
 */
export interface SuggestedSideItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isRequired: boolean;
  displayOrder: number;
  images?: MenuItemImage[];
  type?: ProductType; // Additive P1 field; missing values stay compatible during rollout.
}

/**
 * A suggested side item attached to a *menu-section* item (the menu-bundle join
 * row) — references the side-item product by id and carries its base price.
 * Mirrors backend Menus `SuggestedSideItemDto`
 * (RestaurantSystem.Api/Features/Menus/Dtos/MenuBundleDto.cs).
 */
export interface MenuSectionSuggestedSideItem {
  id: string;
  sideItemProductId: string;
  sideItemProductName?: string;
  sideItemBasePrice: number;
  isRequired: boolean;
  displayOrder: number;
}

export type ApiCategory = {
  id: string;
  name: string;
  /**
   * The tenant's blurb for the category, rendered under the menu's section heading. `CategoryDto`
   * has always sent it; nothing read it until the heading gained a paragraph. Empty string on every
   * RUMI category, which is why the render site checks for content rather than for presence.
   */
  description?: string;
  /**
   * The order types this category permits, **already decoded by the server** (`CategoryDto`
   * computes it from the stored `OrderChannels` mask precisely so no client decodes one — the bits
   * are 1/2/4 while `OrderType` is 1/2/3). Optional: a backend predating the feature omits it, and
   * an absent list means unrestricted, never blocked.
   */
  allowedOrderTypes?: OrderType[];
};

export type ProductType = 'mainItem' | 'sideItem' | 'beverage' | 'dessert' | 'sauce' | 'addOn' | 'menu';

/**
 * Kitchen type enum for product kitchen designation
 */
export type KitchenType = 'None' | 'FrontKitchen' | 'BackKitchen';

export const KITCHEN_TYPES: Record<KitchenType, { label: string; value: KitchenType }> = {
  None: { label: 'Not Assigned', value: 'None' },
  FrontKitchen: { label: 'Front Kitchen', value: 'FrontKitchen' },
  BackKitchen: { label: 'Back Kitchen', value: 'BackKitchen' },
};

export type ContentData = Record<
  string,
  {
    name: string;
    description?: string;
    ingredient?: string;
  }
>;
