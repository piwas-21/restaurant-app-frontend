// src/interfaces/Product.ts

import { MenuDefinition } from '@/types/menu';

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface SideItem {
  id: string;
  name: string;
  description: string;
  price: number;
  isRequired: boolean;
}

export interface Variation {
  id?: string;
  name: string;
  description?: string;
  priceModifier: number;
  finalPrice: number;
  isActive: boolean;
  displayOrder?: number;
}

export interface ProductCategory {
  categoryName: string;
  isPrimary: boolean;
}

export interface ProductIngredient {
  id: string;
  name: string;
  isOptional: boolean;
  price: number;
  isActive: boolean;
  displayOrder: number;
  content?: {
    [languageCode: string]: {
      name: string;
      description?: string;
    };
  };
}

export interface ProductDetails {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial?: boolean;
  preparationTimeMinutes: number;
  displayOrder?: number;
  type: string;
  ingredients: string[]; // Legacy field - kept for backward compatibility
  detailedIngredients?: ProductIngredient[];
  allergens: string[];
  categories: ProductCategory[];
  variations: Variation[];
  images: ProductImage[];
  suggestedSideItems: SideItem[];
  menuDefinition?: MenuDefinition; // For menu bundle products
  content?: any; // To match the full product object for the edit modal
}

/**
 * The fetched detail payload behind the edit modals. Its shape differs per kind
 * (`MenuBundleDto` formats times as strings; `ProductDto` does not), so it stays
 * opaque rather than a union to narrow at every prop. Slice 7 PR2c collapses both
 * modals into one editor and can type this properly.
 */
export type ProductDetailResponse = Record<string, unknown>;

/** An id plus the kind, resolved at click time so the delete path never re-derives it. */
export interface PendingDelete {
  id: string;
  isBundle: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial?: boolean;
  /**
   * Mirrors backend `ProductSummaryDto.Type` (`ProductType` enum, serialized to its
   * `[EnumMember]` value — e.g. 'mainItem', 'menu'). The list has always received this
   * field; it was simply undeclared here, which is why the old code could only branch
   * on it through an `any`. Compare via `isMenuBundle()`, never a bare string literal.
   */
  type: string;
  imageUrl: string | null;
  images: ProductImage[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  displayOrder: number;
  productCount?: number;
}
