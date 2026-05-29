/**
 * Shared leaf types for the menu/product domain: content, images, tags, ingredients,
 * variations, side items, and the kitchen/product enums. Extracted from types/menu.ts
 * (Sprint 4/6 type-file split by domain). No dependencies on the other menu modules.
 */

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
 * Detailed ingredient with optional/pricing information
 */
export interface ProductIngredient {
  id: string;
  name: string;
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
  content?: Record<string, { name: string; description?: string }>;
}

export interface DetailedProductVariation {
  id: string;
  name: string;
  description?: string;
  priceModifier: number;
  finalPrice: number;
  isActive: boolean;
  displayOrder: number;
  content?: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
}

// NOTE: SuggestedSideItem is declared TWICE with different bodies. TypeScript
// declaration-merges them into one interface (union of members). This is a
// pre-existing latent bug carried over verbatim — the two are really distinct
// shapes (a side-item product vs. a menu-section side item). Both declarations
// are kept together here so the merged type is byte-identical to before the split;
// a follow-up task tracks splitting them into two named interfaces.
export interface SuggestedSideItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isRequired: boolean;
  displayOrder: number;
  images?: MenuItemImage[];
}

export interface SuggestedSideItem {
  id: string;
  sideItemProductId: string;
  sideItemProductName?: string;
  sideItemBasePrice: number;
  isRequired: boolean;
  displayOrder: number;
}

export type ApiCategory = { id: string; name: string };

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
