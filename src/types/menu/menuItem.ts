/**
 * Customer-facing menu item.
 * Extracted from types/menu.ts (Sprint 4/6 type-file split by domain).
 */

import {
  MenuItemContent,
  MenuItemImage,
  DietaryTag,
  ProductIngredient,
  SuggestedSideItem,
  KitchenType,
} from './shared';

export interface MenuItem {
  id: string;
  name: string; // Base name from API for fallback
  description?: string; // Base description from API for description fallback
  ingredients?: string[]; // Base ingredients from API for ingredients fallback (simple strings)
  detailedIngredients?: ProductIngredient[]; // Detailed ingredients with optional/pricing info
  content: Partial<Record<string, MenuItemContent>> & {
    en?: MenuItemContent;
  };
  price: number;
  image: string;
  dietaryTags: DietaryTag[];
  allergens?: string[];
  preparationTimeMinutes?: number;
  variations?: Array<{
    name: string;
    isActive: boolean;
    priceModifier: number;
    displayOrder: number;
    description?: string;
    content?: Record<
      string,
      {
        name: string;
        description?: string;
      }
    >;
  }>;
  suggestedSideItems?: SuggestedSideItem[]; // Full side item objects
  categoryKey?: string;
  isSpecial?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
  images?: MenuItemImage[];
  longDescription?: string;
  kitchenType?: KitchenType;
}
