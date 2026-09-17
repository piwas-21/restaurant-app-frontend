import type { ItemAvailability, MenuBundleItem, MenuItem } from '@/types/menu';
import type { CatalogItem } from './catalogItem';

/** The public catalogue presentation mode stored on RestaurantInfo. */
export type BundlePresentationMode = 'legacySeparate' | 'categoryOffers';

/** The compact target summary returned by the catalogue aggregate. */
export interface CatalogOfferTarget {
  productId: string;
  kind: 'product' | 'bundle';
  parentVariationId?: string | null;
  variationName?: string | null;
  name: string;
  description?: string;
  content?: Partial<Record<string, { name: string; description?: string }>>;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  availability?: ItemAvailability;
  /** False when the linked menu is outside its configured day/time window. */
  scheduleAvailable?: boolean;
  allergens?: string[];
  /** A summary endpoint may include the detail for a bundle; usually it is fetched on open. */
  bundle?: MenuBundleItem;
  /** A summary endpoint may include the detail for a product; usually it is fetched on open. */
  product?: MenuItem;
}

/** One commercial card with one or more orderable purchase modes. */
export interface CatalogOfferFamily {
  id: string;
  anchor: CatalogItem;
  menuOffers: CatalogOfferTarget[];
  categoryIds: string[];
  startingPrice: number;
  variationOptions?: CatalogOfferVariation[];
}

export interface CatalogOfferVariation {
  id: string;
  name: string;
  price?: number;
}

/** Provisional wire shape for the additive GET /api/Catalog aggregate. */
export interface CatalogOfferFamilyDto {
  id?: string;
  anchor?: CatalogOfferSummaryDto;
  menuOffers?: CatalogOfferTargetDto[];
  categoryIds?: string[];
  startingPrice?: number | string;
}

export interface CatalogOfferSummaryDto {
  productId?: string;
  id?: string;
  kind?: 'product' | 'bundle' | string;
  name?: string;
  description?: string;
  content?: Record<string, { name?: string; description?: string }>;
  imageUrl?: string;
  price?: number | string;
  /** ProductSummaryDto calls this field BasePrice; price is accepted for early contract drafts. */
  basePrice?: number | string;
  isActive?: boolean;
  isAvailable?: boolean;
  isSpecial?: boolean;
  allergens?: string[] | null;
  availability?: ItemAvailability;
  variations?: Array<{
    id?: string;
    name?: string;
    finalPrice?: number | string;
    priceModifier?: number | string;
    isActive?: boolean;
  }>;
  isBundle?: boolean;
}

export interface CatalogOfferTargetDto extends CatalogOfferSummaryDto {
  productId: string;
  parentVariationId?: string | null;
  variationName?: string | null;
  /** Menu-offer rows are bundle targets and intentionally carry no duplicated display name. */
  scheduleAvailable?: boolean;
}

export interface CatalogOfferFamilyPageDto {
  items?: CatalogOfferFamilyDto[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface CatalogOfferFamilyResponse {
  success?: boolean;
  message?: string;
  data?: CatalogOfferFamilyPageDto | CatalogOfferFamilyDto[];
  items?: CatalogOfferFamilyDto[];
  totalCount?: number;
  errors?: unknown;
}
