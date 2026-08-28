/**
 * The shapes the waiter/POS customization sheet works in.
 *
 * Lifted out of `ProductCustomization.tsx` unchanged when that component was split into a hook and
 * a render (frontend §4: the file was 401 LOC against a 250 limit and BASELINED, which is debt, not
 * permission). `ProductCustomization` re-exports every one of them, so the existing importers —
 * `take-order/useTakeOrder.ts`, `take-order/orderItems.ts` — keep their import path.
 */

import type { PriceableIngredientKind } from '@/utils/priceableIngredient';

/** A per-language name/description block, as `ProductDto.Content` sends it. */
export type LocalizedContent = Record<string, { name?: string; description?: string } | undefined>;

export interface DetailedIngredient {
  id: string;
  name: string;
  isActive: boolean;
  isOptional: boolean;
  price?: number;
  /**
   * The two fields the price math reads and this shape used to drop (S7).
   *
   * `ProductIngredientDto` has always sent both, and `GET /api/Products/{id}` is the very same
   * request the guest sheet makes — so the waiter sheet was not missing DATA, it was throwing it
   * away at the type boundary and then charging for an ingredient the base price had already
   * bought. Optional here rather than required because a pre-S7 fixture may omit them, and the
   * defaults (`isIncludedInBasePrice` false, `maxQuantity` 1) are the price math's own.
   */
  isIncludedInBasePrice?: boolean;
  maxQuantity?: number;
  /**
   * The typed option group (backend #426) and the row's position in it. Nothing on this screen
   * reads them yet; they are carried so the sauce free-allowance rule (#596) sees an intact set
   * when it arrives — see the note in `utils/priceableIngredient.ts` for why omitting them fails
   * silently rather than loudly.
   */
  kind?: PriceableIngredientKind;
  displayOrder?: number;
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
  /**
   * What the waiter ADDED on top of the base recipe, with how many of it. `quantity` arrived with
   * S7's stepper; before it the field could only ever have meant 1.
   */
  addedIngredients: Array<{ id: string; name: string; price: number; quantity: number }>;
  /**
   * What the waiter took OFF the base recipe. New in S7 — until the sheet opened on the base
   * recipe there was no way to express "no onion" here at all, which is why this state has no
   * history to be compatible with.
   */
  removedIngredients: Array<{ id: string; name: string; price: number; quantity: number }>;
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
