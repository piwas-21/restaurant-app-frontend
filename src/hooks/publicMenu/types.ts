import type { ApiCategory, MenuDefinition, MenuItem, ProductIngredient, SuggestedSideItem } from '@/types/menu';

type ProductVariationDto = NonNullable<MenuItem['variations']>[number];

/**
 * Wire-level DTOs returned by the backend public-menu endpoints.
 *
 * These mirror `RestaurantSystem.Api/Features/Products/Dtos/ProductDto.cs` and
 * `Features/Menus/Dtos/MenuBundleDto.cs`. We type every field as the wire
 * actually delivers it (often optional / loosely-shaped) so the mappers can
 * normalise into the strict `MenuItem` / `MenuBundleItem` view types without
 * any `any` casts.
 */
export interface ProductImageDto {
  url: string;
  altText?: string;
}

export interface ProductContentEntryDto {
  name?: string;
  description?: string;
  ingredient?: string;
}

export type ProductContentDto = Record<string, ProductContentEntryDto | undefined>;

export interface ProductDto {
  id: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  images?: ProductImageDto[];
  ingredients?: string[];
  detailedIngredients?: ProductIngredient[];
  allergens?: string[];
  content?: ProductContentDto;
  basePrice?: number | string;
  preparationTimeMinutes?: number;
  variations?: ProductVariationDto[];
  suggestedSideItems?: SuggestedSideItem[];
  isSpecial?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface MenuBundleDto {
  id: string;
  name?: string;
  description?: string;
  basePrice?: number | string;
  content?: Record<string, { name: string; description: string }>;
  menuDefinition?: MenuDefinition;
  images?: ProductImageDto[];
  isActive?: boolean;
  isAvailable?: boolean;
  isSpecial?: boolean;
  preparationTimeMinutes?: number;
  displayOrder?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data?: {
    items?: T[];
    totalPages?: number;
    totalCount?: number;
  };
}

export type ProductListResponse = PaginatedResponse<ProductDto>;
export type MenuBundleListResponse = PaginatedResponse<MenuBundleDto>;
export type CategoryListResponse = PaginatedResponse<ApiCategory>;
