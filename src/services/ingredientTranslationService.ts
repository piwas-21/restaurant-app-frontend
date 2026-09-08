import { apiClient } from '@/utils/apiClient';
import { getProducts } from './menuService';
import type { Product } from '@/app/admin/menu-management/interfaces';
import type { ProductTypeQuery } from '@/utils/productTypeFilter';

/** The manager reads every carrier, so it opts into BOTH excluded kinds (see `ProductTypeQuery`). */
const ALL_CARRIERS: ProductTypeQuery = { includeMenus: true, includeComponents: true };

/**
 * The API half of the Ingredients & Sauces translations manager.
 *
 * Two calls carry the whole feature: page through the tenant catalog for every product that
 * carries ingredient copies (bundle options are the OPTION PRODUCT's own rows — the bundle adds
 * no copy of its own, so the product list is the complete carrier census), then hand ONE
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
 * option-only components bundle sections reference. Pages to exhaustion once; the manager is a
 * maintenance surface, not a polling screen, so one full walk on open is the honest cost.
 */
export async function fetchAllIngredientCarriers(): Promise<Product[]> {
  const carriers: Product[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await getProducts(page, PAGE_SIZE, null, ALL_CARRIERS);
    const items = response.data?.items ?? [];
    carriers.push(...items);
    const total = response.data?.totalCount ?? 0;
    if (items.length === 0 || carriers.length >= total) return carriers;
  }
  return carriers;
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
  return await apiClient.put<ApiResponse<IngredientApplyReceipt>>(
    `${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(globalIngredientId)}/apply-translations`,
    { translations },
  );
};
