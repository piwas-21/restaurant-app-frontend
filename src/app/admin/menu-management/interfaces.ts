import { OrderType } from '@/types/order';
// src/interfaces/Product.ts

import { IngredientKind, KitchenType, MenuDefinition } from '@/types/menu';

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

/** Mirrors backend `ProductCategoryDto`. */
export interface ProductCategory {
  /**
   * Was undeclared here, so every read went through an `any` — the edit modal's
   * `product.categories.map((c: any) => c.categoryId)` has always relied on it.
   */
  categoryId: string;
  categoryName: string;
  isPrimary: boolean;
  displayOrder?: number;
}

export interface ProductIngredient {
  id: string;
  name: string;
  /** Absent === `'ingredient'` (plan D8) — resolve it with `@/utils/ingredientKind`. */
  kind?: IngredientKind;
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
  /** Mirrors backend `ProductDto.HideBaseProduct` (#399) — see `@/utils/baseProductVisibility`. */
  hideBaseProduct?: boolean;
  /**
   * Mirrors backend `ProductDto.IsComponent` (#631). An OPTION-ONLY item: it may be referenced by a
   * bundle section and is excluded from `GET /api/Products` unless the caller opts in, so it never
   * reaches the guest menu and cannot be ordered alone. Absent === false.
   */
  isComponent?: boolean;
  preparationTimeMinutes: number;
  displayOrder?: number;
  type: string;
  /** Mirrors backend `ProductDto.KitchenType`. Undeclared until PR2d, so the edit modal read it through `any`. */
  kitchenType?: KitchenType;
  ingredients: string[]; // Legacy field - kept for backward compatibility
  detailedIngredients?: ProductIngredient[];
  allergens: string[];
  categories: ProductCategory[];
  /**
   * Mirrors backend `ProductDto.PrimaryCategory` — an OBJECT, projected from whichever
   * ProductCategory has `IsPrimary`. There is no `primaryCategoryId` field on any response
   * DTO; the edit modal reads one anyway, which is why it always fell back to the first
   * category. See `toEditorDefaults` in `utils/productEditorDefaults.ts`.
   */
  primaryCategory?: { id: string; name: string };
  variations: Variation[];
  images: ProductImage[];
  suggestedSideItems: SideItem[];
  menuDefinition?: MenuDefinition; // For menu bundle products
  /**
   * Mirrors backend `ProductDto.AvailableOrderTypes` — the RAW OrderChannels bitmask stored on the
   * item. `null` means "inherit from the primary category", which is NOT the same as an explicit
   * all-three override, so this must never be round-tripped through `maskFromOrderTypes` (see
   * `exactMaskFromOrderTypes`). Customer surfaces read the decoded `availability` instead.
   */
  availableOrderTypes?: number | null;
  /**
   * The sauce GROUP rules, product-level (plan D9, owner-answered §7 Q3 on 2026-08-27).
   *
   * Three plain numbers, not a min/max-select engine — that stays a separate project. There is no
   * tenant default anywhere in this code: an admin who wants "one free sauce" types it. `sauceMax`
   * is `null` for "no cap", which is NOT `0` — `0` would mean the guest may pick none at all.
   */
  sauceMin?: number;
  sauceMax?: number | null;
  sauceIncludedFree?: number;
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
  /**
   * Raw OrderChannels bitmask; `null` = available on every order type. Admin editors round-trip
   * this via `@/utils/orderChannels`. Customer surfaces should read `allowedOrderTypes` instead.
   */
  availableOrderTypes?: number | null;
  /** Server-decoded order types this category permits — never decode the mask on a customer surface. */
  allowedOrderTypes?: OrderType[];
  /**
   * ISO instant of the last write to the category row (`CategoryDto.UpdatedAt`), or absent when it
   * has never been edited. ANY field of the row bumps it, so read it as "last changed", not as
   * "channels last changed" — `categoryChannelStatus` documents what that costs.
   */
  updatedAt?: string | null;
}
