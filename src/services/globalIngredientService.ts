import { apiClient } from '@/utils/apiClient';

const GLOBAL_INGREDIENTS_API_URL = '/api/global-ingredients';

/** Standard backend envelope (`ApiResponse<T>`); `errors[]` carries the 400 reasons. */
interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface GlobalIngredientTranslation {
  languageCode: string;
  name: string;
}

/**
 * Mirrors backend `Features/GlobalIngredients/Dtos/GlobalIngredientDto.cs`. There is no category
 * and no usage count on that DTO — anything the admin UI wants to filter or count by has to come
 * from these fields or from the product being edited.
 */
export interface GlobalIngredientSummary {
  id: string;
  defaultName: string;
  imageUrl?: string;
  isActive: boolean;
  translations: GlobalIngredientTranslation[];
}

export interface CreateGlobalIngredientData {
  defaultName: string;
  imageUrl?: string;
  /**
   * May be empty. The backend command builds `Translations.Select(...)` over whatever arrives, so
   * an empty array is a valid library row carrying only its `defaultName` — which is also the only
   * field the search endpoint matches on.
   */
  translations: GlobalIngredientTranslation[];
}

export const createGlobalIngredient = async (data: CreateGlobalIngredientData) => {
  return await apiClient.post<ApiResponse<GlobalIngredientSummary>>(GLOBAL_INGREDIENTS_API_URL, data);
};

export const searchGlobalIngredients = async (query: string, limit: number = 10) => {
  return await apiClient.get<ApiResponse<GlobalIngredientSummary[]>>(
    `${GLOBAL_INGREDIENTS_API_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
  );
};

/**
 * The whole library, active rows only, ordered by name — `GetGlobalIngredientsQuery`.
 *
 * This is what makes the catalog BROWSABLE. `/search` returns an empty list for an empty query
 * (`SearchGlobalIngredientsQuery` short-circuits on a blank term) and matches `DefaultName` only,
 * never the translations, so it can only help someone who already knows the English name. Reading
 * the list once and filtering it in the browser answers both: an empty search box shows the shelf,
 * and a French admin typing "mozzarelle" finds Mozzarella.
 *
 * The cost is one ~650-row response per modal open (RUMI's seeded library is 654 entries in 9
 * languages). If that catalog ever grows past a few thousand rows this has to become a paged
 * server query.
 */
export const getGlobalIngredients = async () => {
  return await apiClient.get<ApiResponse<GlobalIngredientSummary[]>>(GLOBAL_INGREDIENTS_API_URL);
};
