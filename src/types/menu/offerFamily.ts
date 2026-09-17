import type { ItemAvailability, MenuBundleItem, MenuItem } from '@/types/menu';
import type { CatalogItem } from './catalogItem';

/** The public catalogue presentation mode stored on RestaurantInfo. */
export type BundlePresentationMode = 'legacySeparate' | 'categoryOffers';

/** Presentation role, deliberately independent of the stored ProductType. */
export type OfferMode = 'item' | 'meal';

/** The compact target summary returned by the catalogue aggregate. */
export interface CatalogOfferTarget {
  productId: string;
  kind: 'product' | 'bundle';
  parentVariationId?: string | null;
  variationName?: string | null;
  name: string;
  description?: string | null;
  content?: Partial<Record<string, { name: string; description?: string }>>;
  price: number;
  imageUrl?: string | null;
  isActive?: boolean;
  isAvailable?: boolean;
  availability?: ItemAvailability;
  isSpecial?: boolean;
  /** False when the linked menu is outside its configured day/time window. */
  scheduleAvailable?: boolean;
  /** The family card uses this to label the target, never `kind` (storage plumbing). */
  offerMode?: OfferMode;
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
  /** Backend verdict for the anchor's own menu schedule, when the anchor is a bundle. */
  anchorScheduleAvailable?: boolean;
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
  /** Additive anchor schedule verdict; omitted means no restriction is known. */
  anchorScheduleAvailable?: boolean;
}

export interface CatalogOfferSummaryDto {
  productId?: string;
  id?: string;
  kind?: 'product' | 'bundle' | string;
  /** ProductSummaryDto's ProductType enum, serialised as `mainItem`/`menu`. */
  type?: string;
  name?: string;
  description?: string | null;
  content?: Record<string, { name?: string; description?: string }>;
  imageUrl?: string | null;
  images?: Array<{
    id?: string;
    url?: string;
    cardUrl?: string | null;
    altText?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
  price?: number | string;
  /** ProductSummaryDto calls this field BasePrice; price is accepted for early contract drafts. */
  basePrice?: number | string;
  isActive?: boolean;
  isAvailable?: boolean;
  isSpecial?: boolean;
  allergens?: string[] | null;
  ingredients?: string[] | null;
  categoryNames?: string[];
  primaryCategoryName?: string | null;
  variationCount?: number;
  suggestedSideItems?: unknown[];
  availableOrderTypes?: number | null;
  hideBaseProduct?: boolean;
  isComponent?: boolean;
  availability?: CatalogOfferAvailabilityDto;
  variations?: Array<{
    id?: string;
    name?: string;
    finalPrice?: number | string;
    priceModifier?: number | string;
    isActive?: boolean;
  }>;
  isBundle?: boolean;
}

/** Wire availability nested in ProductSummaryDto; enum values are JSON strings. */
export interface CatalogOfferAvailabilityDto {
  canOrder?: boolean;
  reason?: string;
  allowedOrderTypes?: string[];
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
