/**
 * Admin product CRUD shapes and the detailed product / featured-special responses.
 * Extracted from types/menu.ts (Sprint 4/6 type-file split by domain).
 */

import {
  ProductType,
  ContentData,
  ProductIngredient,
  MenuItemImage,
  DetailedProductVariation,
  SuggestedSideItem,
  KitchenType,
} from './shared';
import { MenuDefinition } from './bundle';
import type { SauceGroupCarrier } from './sauce';
import type { ItemAvailability } from './availability';

export interface CreateProductData {
  name: string;
  basePrice: number;
  type: ProductType;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  categoryIds: string[];
  primaryCategoryId: string;
  description?: string;
  ingredients?: string[];
  allergens?: string[];
  variations: Array<{
    name: string;
    isActive: boolean;
    priceModifier: number;
    displayOrder: number;
    description?: string;
  }>;
  content: ContentData;
}

export interface ProductResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  data: {
    id: string;
  };
}

export interface DetailedProduct extends SauceGroupCarrier {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  /**
   * Whether the product's base row ("order it with no variation") is withheld, so the guest must
   * pick a variation (Track F / F2, backend #399). Optional — a backend that predates it omits it,
   * which reads as `false` and is today's behaviour. Never read it bare: `isBaseRowHidden` in
   * `@/utils/baseProductVisibility` applies the degrade the server also applies.
   */
  hideBaseProduct?: boolean;
  preparationTimeMinutes?: number;
  type: ProductType;
  ingredients: string[]; // Simple ingredient strings for backward compatibility
  detailedIngredients?: ProductIngredient[]; // Detailed ingredients with optional/pricing info
  allergens: string[];
  displayOrder: number;
  content: ContentData;
  images: MenuItemImage[];
  categories: Array<{
    categoryId: string;
    categoryName: string;
    isPrimary: boolean;
    displayOrder: number;
  }>;
  primaryCategory?: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    displayOrder: number;
    productCount: number;
    createdAt: string;
    updatedAt: string;
  };
  variations: DetailedProductVariation[];
  suggestedSideItems: SuggestedSideItem[];
  kitchenType?: KitchenType;
  menuDefinition?: MenuDefinition; // For menu bundle products
  /**
   * Per-order-type verdict, carried in from the browse card via `OpenSheetOptions.availability`
   * rather than fetched — see that field for why one verdict beats two. Absent on the by-id entry
   * points (featured special), which stay unguarded (G7).
   */
  availability?: ItemAvailability;
}

export interface DetailedProductResponse {
  success: boolean;
  message?: string;
  data: DetailedProduct;
  errors?: string[];
}

export interface FeaturedSpecial {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  /**
   * The product's kind (backend #285). Optional because it is additive: a frontend running against
   * an older backend gets `undefined`, and the hero must then treat the kind as UNKNOWN rather than
   * assuming a plain product.
   *
   * A combo is not its own type — it is a `type: 'menu'` product owning a `menuDefinition` — and
   * nothing in `SetFeaturedSpecialCommand` stops one being featured, so this is the only thing that
   * distinguishes the two on this payload. It matters for the admin price control: the two write
   * paths reach the same `BasePrice` column under different validators.
   */
  type?: ProductType;
  featuredDate: string;
  preparationTimeMinutes: number;
  ingredients?: string[];
  allergens?: string[];
  images?: MenuItemImage[];
  variations: DetailedProductVariation[];
  suggestedSideItems: SuggestedSideItem[];
  detailedIngredients: ProductIngredient[];
  content?: ContentData;
  kitchenType?: KitchenType;
  /**
   * Server-resolved per-order-type verdict for the channel the banner asked about (G7 — backend
   * #241 added the field; before it, the hero had nothing to guard on). Optional so a frontend
   * running against an older backend simply shows no notice rather than blocking everything.
   */
  availability?: ItemAvailability;
}

export interface FeaturedSpecialResponse {
  success: boolean;
  message?: string;
  data: FeaturedSpecial | null;
  errors?: string[];
}
