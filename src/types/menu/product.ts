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

export interface DetailedProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
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
}

export interface FeaturedSpecialResponse {
  success: boolean;
  message?: string;
  data: FeaturedSpecial | null;
  errors?: string[];
}
