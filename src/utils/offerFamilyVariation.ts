import type { ProductDetails, Variation } from '@/app/admin/menu-management/interfaces';

/** Only persisted, active variations can be used as a variation-specific offer parent. */
export const getActiveOfferVariations = (product: ProductDetails): Variation[] =>
  (product.variations ?? []).filter((variation) => Boolean(variation.id) && variation.isActive);

/** A product with any variation cannot create or link a base-only menu version. */
export const requiresOfferVariation = (product: ProductDetails): boolean => (product.variations ?? []).length > 0;
