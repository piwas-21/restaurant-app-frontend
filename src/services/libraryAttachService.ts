import { apiClient } from '@/utils/apiClient';
import type { IngredientKind } from '@/types/menu';

/**
 * The two catalog-wide writes of plan slice S8 — "reuse at scale" — and the query their confirm
 * step needs.
 *
 * A file of its own rather than four functions split across `globalIngredientService` and
 * `globalVariationService`, for two reasons. The shapes are SHARED: both catalogs answer with the
 * same usage row and the same itemised receipt, so defining them once is what stops the two drifting
 * while one screen renders both. And both existing services were within a few lines of the 200-line
 * service cap, so the next reader would have had to split something anyway, at a moment when they
 * were not thinking about this slice.
 */

const GLOBAL_INGREDIENTS_API_URL = '/api/global-ingredients';
const GLOBAL_VARIATIONS_API_URL = '/api/global-variations';

/** Standard backend envelope (`ApiResponse<T>`); `errors[]` carries the 400 reasons. */
interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * One product carrying a copy of a library row — backend `CatalogUsageProductDto`.
 *
 * It reports `isActive` because the usage COUNT deliberately includes inactive products: the link is
 * real and archiving the library row still affects them. A screen showing a bare number could not
 * explain why 41 items include one nobody can order.
 */
export interface CatalogUsageProduct {
  productId: string;
  productName: string;
  isActive: boolean;
}

/** One product a bulk attach did not change, and why. */
export interface AttachSkippedProduct {
  productId: string;
  productName: string;
  /** `'alreadyLinked'` or `'notFound'`. A rule violation is never here — it refuses the whole batch. */
  reason: string;
}

/** The itemised receipt for a bulk attach. Nothing is skipped in silence. */
export interface AttachResult {
  attachedProductIds: string[];
  skipped: AttachSkippedProduct[];
}

/**
 * The per-product facts a bulk ingredient attach applies to every target.
 *
 * Plan D1: the CATALOG owns the name and the translations, the PRODUCT row owns price, optionality
 * and max quantity. `price` and `isIncludedInBasePrice` are `required` in the backend DTO and are
 * non-optional here for the same reason — an omitted price binds to 0 server-side and would quietly
 * make the extra free on every product in the batch.
 *
 * `isOptional` may only ever be `true`: the backend refuses a required row on this path, because a
 * required ingredient is reported as REMOVED on every order placed before it existed.
 */
export interface AttachGlobalIngredientBody {
  productIds: string[];
  /**
   * WHICH GROUP the copied rows land in (slice G3). Optional on the wire, and omitting it is not
   * the same as sending `'ingredient'`: the server falls back to the library row's own kind, so a
   * caller that has no group to state keeps the behaviour it had before this field existed. The
   * picker always has a group and always sends one, which is what stopped the two attach paths
   * applying opposite rules to the same decision.
   */
  kind?: IngredientKind;
  isOptional: boolean;
  price: number;
  maxQuantity: number;
  isIncludedInBasePrice: boolean;
}

/** The per-product fact a bulk variation attach applies to every target. */
export interface AttachGlobalVariationBody {
  productIds: string[];
  /**
   * Added to the base price; may be negative. Non-optional because **0 is a legitimate value**, so
   * an omitted field and a deliberate "no surcharge" would otherwise be the same payload.
   */
  priceModifier: number;
}

/**
 * WHICH products carry a copy of this library row — the drill-down behind "used on N items".
 *
 * Plan S3 shipped the COUNT and nothing to spend it on. A blast-radius confirm (plan D6) cannot work
 * from a number: "this will change 38 items" is only true if the screen knows which 2 of the 40 are
 * already covered.
 */
export const getGlobalIngredientProducts = async (id: string) =>
  await apiClient.get<ApiResponse<CatalogUsageProduct[]>>(
    `${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(id)}/products`,
  );

/** The variation twin. */
export const getGlobalVariationProducts = async (id: string) =>
  await apiClient.get<ApiResponse<CatalogUsageProduct[]>>(
    `${GLOBAL_VARIATIONS_API_URL}/${encodeURIComponent(id)}/products`,
  );

/**
 * Copy one library row onto many products at once — the answer to "why must I retype this on 40
 * pizzas".
 *
 * **There is no category target, by design.** "Apply to every pizza" is resolved HERE, in the
 * browser, into the ids this call carries — so the confirm the admin approved and the payload sent
 * are the same list BY CONSTRUCTION. A server-side `categoryId` would be re-resolved at save time,
 * and a product added to that category between the confirm and the save would be changed by an
 * action nobody saw.
 */
export const attachGlobalIngredient = async (id: string, body: AttachGlobalIngredientBody) =>
  await apiClient.post<ApiResponse<AttachResult>>(
    `${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(id)}/attach`,
    body,
  );

/**
 * The variation twin. A NEGATIVE modifier is normal ("Small −1.00") and the server refuses the whole
 * batch, naming the offender, when it would take a product's cheapest sellable price below the value
 * an order is allowed to deduct from it.
 */
export const attachGlobalVariation = async (id: string, body: AttachGlobalVariationBody) =>
  await apiClient.post<ApiResponse<AttachResult>>(
    `${GLOBAL_VARIATIONS_API_URL}/${encodeURIComponent(id)}/attach`,
    body,
  );
