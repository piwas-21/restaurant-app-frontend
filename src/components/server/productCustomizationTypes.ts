/**
 * The shapes the waiter/POS customization sheet works in.
 *
 * Lifted out of `ProductCustomization.tsx` unchanged when that component was split into a hook and
 * a render (frontend §4: the file was 401 LOC against a 250 limit and BASELINED, which is debt, not
 * permission). `ProductCustomization` re-exports every one of them, so the existing importers —
 * `take-order/useTakeOrder.ts`, `take-order/orderItems.ts` — keep their import path.
 */

/** A per-language name/description block, as `ProductDto.Content` sends it. */
export type LocalizedContent = Record<string, { name?: string; description?: string } | undefined>;

export interface DetailedIngredient {
  id: string;
  name: string;
  isActive: boolean;
  isOptional: boolean;
  price?: number;
  content?: LocalizedContent;
}

export interface ProductVariation {
  id: string;
  name: string;
  description?: string;
  priceModifier: number;
  finalPrice: number;
  isActive: boolean;
  displayOrder: number;
  content?: LocalizedContent;
}

export interface SuggestedSideItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isRequired: boolean;
  displayOrder: number;
}

export interface CustomizationResult {
  productId: string;
  variationId?: string;
  variationName?: string;
  addedIngredients: Array<{ id: string; name: string; price: number }>;
  sideItems: Array<{ id: string; name: string; quantity: number; price: number }>;
  specialInstructions?: string;
  finalPrice: number;
}

/**
 * What `GET /api/Products/{id}` adds on top of the list `Product` — the customization payload the
 * sheet exists to render. Typed rather than the `any` this used to be (§5.8): every field below is
 * read by the sheet, and `hideBaseProduct` in particular decides whether a variation-less line is
 * orderable at all (F2).
 */
export interface ProductCustomizationDetail {
  id: string;
  name: string;
  basePrice: number;
  hideBaseProduct?: boolean;
  variations?: ProductVariation[];
  detailedIngredients?: DetailedIngredient[];
  suggestedSideItems?: SuggestedSideItem[];
  allergens?: string[];
}
