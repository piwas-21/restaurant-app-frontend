/**
 * The shapes the waiter/POS customization sheet works in.
 *
 * Lifted out of `ProductCustomization.tsx` unchanged when that component was split into a hook and
 * a render (frontend §4: the file was 401 LOC against a 250 limit and BASELINED, which is debt, not
 * permission). `ProductCustomization` re-exports every one of them, so the existing importers —
 * `take-order/useTakeOrder.ts`, `take-order/orderItems.ts` — keep their import path.
 */

import type { PriceableIngredientKind } from '@/utils/priceableIngredient';
import type { ProductType } from '@/types/menu';

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
  /**
   * Mutual-exclusion group key (plan §9). Carried here and ACTED ON, unlike `kind` above: the
   * waiter sheet enforces the same at-most-one rule as the guest sheet, because a till that lets
   * both members of a doneness group onto one line prints a contradictory kitchen ticket and
   * charges for both. Absent/blank means no group — the degrade lives in `@/utils/exclusionGroup`.
   */
  exclusionGroup?: string | null;
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
  /** Additive P1 field. Missing values remain visible as Accompagnements. */
  type?: ProductType;
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
  /**
   * The WHOLE selection — every ingredient id that is ON the dish — and how many of each, exactly
   * as the guest sheet sends them to `/api/basket/items`. New in S595, and NOT derivable from the
   * two arrays above: an included-in-base ingredient kept at quantity 1 is neither an addition nor
   * a removal, yet leaving its id out tells the server it was taken off and DEDUCTS its price.
   * The diff describes the change for a human; this describes the dish for the server.
   */
  selectedIngredientIds: string[];
  ingredientQuantities: Record<string, number>;
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
  /**
   * How many sauce rows the product includes at no charge (S6, backend #429).
   *
   * Carried here for the same reason `isIncludedInBasePrice` and `maxQuantity` are: this type is a
   * BOUNDARY, and a field it omits is dropped from a payload that already contains it. Dropping this
   * one is not cosmetic — `useLinePrice` reads a missing value as `0`, which is the assertion "this
   * product includes NO free sauces", so the sheet charges for sauces the admin marked included.
   *
   * Absent or `0` is pre-S6 pricing and subtracts nothing, which is why the defect is dormant rather
   * than visible: no production product has an allowance yet.
   */
  sauceIncludedFree?: number;
  variations?: ProductVariation[];
  detailedIngredients?: DetailedIngredient[];
  suggestedSideItems?: SuggestedSideItem[];
  allergens?: string[];
}
