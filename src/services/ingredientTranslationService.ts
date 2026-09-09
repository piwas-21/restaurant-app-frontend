import { apiClient, ApiError } from '@/utils/apiClient';
import { getProductById, getProducts } from './menuService';
import type { ProductTypeQuery } from '@/utils/productTypeFilter';
import type { IngredientCarrierProduct } from '@/utils/ingredientTranslationEntries';
import type { ProductIngredient } from '@/types/menu';

/** The manager reads every carrier, so it opts into BOTH excluded kinds (see `ProductTypeQuery`). */
const ALL_CARRIERS: ProductTypeQuery = { includeMenus: true, includeComponents: true };

/**
 * The API half of the Ingredients & Sauces translations manager.
 *
 * Three calls carry the whole feature: page through the tenant catalog for every product that
 * could carry ingredient copies (bundle options are the OPTION PRODUCT's own rows — the bundle
 * adds no copy of its own, so the product list is the complete carrier census), hydrate each
 * carrier's copies from the by-id endpoint (`fetchAllIngredientCarriers`), then hand ONE
 * ingredient's translations to the bulk-apply endpoint, which writes the library row and every
 * product copy that references it in one transaction.
 */

const GLOBAL_INGREDIENTS_API_URL = '/api/global-ingredients';

const PAGE_SIZE = 100;
/** A runaway total must not loop forever — 50 pages of 100 is 5 000 products, far past any tenant. */
const MAX_PAGES = 50;

/** Standard backend envelope (`ApiResponse<T>`); `errors[]` carries the 400 reasons. */
interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface IngredientTranslationInput {
  languageCode: string;
  name: string;
}

/** What one apply touched — an itemised receipt, like the attach endpoint's. */
export interface IngredientApplyReceipt {
  updatedProductCount: number;
  updatedIngredientCount: number;
  items: { productId: string; productName: string; ingredientId: string }[];
}

/**
 * Every product of the tenant that may carry ingredient copies — items, Menu bundles and the
 * option-only components bundle sections reference — WITH each product's ingredient copies.
 *
 * Two requests per step. The paged LIST (`GET /api/Products`) only enumerates the carriers:
 * `GetProductsQuery` never `.Include`s DetailedIngredients, so every list row ships
 * `detailedIngredients: []` and the list alone would always fold into an empty manager — the
 * shipped #750 defect (page rendered, catalog fetched, "No ingredients found." forever). The
 * copies exist only on the by-id DETAIL query, so after the list walk each carrier is hydrated
 * from `GET /api/Products/{id}`. Bounded concurrency: a full tenant walk is N admin-only GETs on
 * a maintenance surface opened once, not a polling screen — RUMI's 126 products take seconds,
 * and the page holds its loading state for the whole walk.
 *
 * A 404 on a detail fetch is a product deleted between the list and its detail call — its copies
 * are genuinely unreachable, so it reads as carrying none and the walk continues. Any other
 * detail failure throws, so the page shows its load-error banner rather than a silently
 * incomplete inventory.
 */
export async function fetchAllIngredientCarriers(): Promise<IngredientCarrierProduct[]> {
  const carriers = await fetchCarrierList();
  await hydrateCarrierIngredients(carriers);
  return carriers;
}

/** The paged half: every product id/name of the tenant, items + menus + components. */
async function fetchCarrierList(): Promise<IngredientCarrierProduct[]> {
  const carriers: IngredientCarrierProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await getProducts(page, PAGE_SIZE, null, ALL_CARRIERS);
    const items = response.data?.items ?? [];
    carriers.push(...items.map((item) => ({ id: item.id, name: item.name, detailedIngredients: null })));
    const total = response.data?.totalCount ?? 0;
    if (items.length === 0 || carriers.length >= total) return carriers;
  }
  return carriers;
}

/** Detail rows the by-id query returns; only the ingredient copies are read here. */
type ProductDetailResponse = { success?: boolean; data?: { detailedIngredients?: ProductIngredient[] | null } | null };

const DETAIL_CONCURRENCY = 8;

/**
 * Fill every carrier's `detailedIngredients` from the by-id endpoint, DETAIL_CONCURRENCY at a
 * time. Cursor-and-workers rather than N parallel bursts, so one slow product cannot pile up
 * hundreds of in-flight requests behind it.
 */
async function hydrateCarrierIngredients(carriers: IngredientCarrierProduct[]): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, carriers.length) }, async () => {
    while (cursor < carriers.length) {
      const index = cursor;
      cursor += 1;
      const carrier = carriers[index];
      try {
        const detail = (await getProductById(carrier.id)) as ProductDetailResponse;
        // THIS backend answers a missing product with HTTP 200 {success:false,data:null}, not a
        // 404 — an envelope refusal means the carrier is gone (deleted between the list and its
        // detail call), so it reads as carrying none and the walk continues. The 404 branch below
        // stays for a backend that does answer 404.
        if (detail.success === false || detail.data === null || detail.data === undefined) {
          carriers[index] = { ...carrier, detailedIngredients: [] };
          continue;
        }
        carriers[index] = { ...carrier, detailedIngredients: detail.data.detailedIngredients ?? [] };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) continue;
        throw error;
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Apply per-locale names to the library row AND every product copy referencing it
 * (`POST /api/global-ingredients/{id}/apply-translations`, added for this manager). The copy
 * match is the row's provenance id OR — for a legacy copy typed before provenance existed — an
 * exact name match on the library row's default name.
 */
export const applyIngredientTranslations = async (
  globalIngredientId: string,
  translations: IngredientTranslationInput[],
): Promise<ApiResponse<IngredientApplyReceipt>> => {
  // POST — the merged endpoint is `[HttpPost("{id}/apply-translations")]` (backend PR #511),
  // mirroring the attach endpoint beside it. The body IS the list — the backend binds
  // `[FromBody] List<GlobalIngredientTranslationDto>` directly (its
  // GlobalIngredientTranslationDto is { languageCode, name }, this input's shape).
  return await apiClient.post<ApiResponse<IngredientApplyReceipt>>(
    `${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(globalIngredientId)}/apply-translations`,
    translations,
  );
};
