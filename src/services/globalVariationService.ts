import { apiClient } from '@/utils/apiClient';

const GLOBAL_VARIATIONS_API_URL = '/api/global-variations';

/** Standard backend envelope (`ApiResponse<T>`); `errors[]` carries the 400 reasons. */
interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface GlobalVariationTranslation {
  languageCode: string;
  name: string;
}

/**
 * Mirrors backend `Features/GlobalVariations/Dtos/GlobalVariationDto.cs` (backend #431).
 *
 * **It carries no price, and that is the design.** A variation's money is its `PriceModifier`, and
 * that number is more product-specific than an ingredient's price ever was: +2.00 for a large pizza,
 * +0.50 for a large coffee. So the catalog holds names and translations only, and a pick leaves the
 * money to the product — which is also where the value is, because the sizes repeat across a menu
 * and the prices do not.
 */
export interface GlobalVariationSummary {
  id: string;
  defaultName: string;
  isActive: boolean;
  /** Archived (plan D4): off the shelf, still linked, restorable. Not soft-deleted. */
  isArchived: boolean;
  /** "used on N items" — distinct live products whose variations link to this row. */
  usedOnProductCount: number;
  translations: GlobalVariationTranslation[];
}

export interface CreateGlobalVariationData {
  defaultName: string;
  /**
   * May be empty. The backend command builds `Translations.Select(...)` over whatever arrives, so
   * a row carrying only its `defaultName` is legal — and here it is also the only shape the picker
   * ever creates, because a name typed into the search box has no translations yet.
   */
  translations: GlobalVariationTranslation[];
}

/**
 * The whole library, active rows only, ordered by name — `GetGlobalVariationsQuery`.
 *
 * There is deliberately **no `/search` endpoint** to call instead (backend #431): the ingredient
 * library's was measured unusable — it short-circuits on a blank term so it cannot browse, and it
 * matches `DefaultName` only so it cannot help anyone who does not already know the English word.
 * Reading the list once and filtering it in the browser answers both. The cost is one response per
 * modal open over roughly 50 seeded rows, an order of magnitude smaller than the ingredient
 * library's 654; if either catalog ever needs paging, both do.
 */
export const getGlobalVariations = async () => {
  return await apiClient.get<ApiResponse<GlobalVariationSummary[]>>(GLOBAL_VARIATIONS_API_URL);
};

/**
 * The archived half of the library — `GET /api/global-variations/archived`, admin only.
 *
 * A separate endpoint rather than a flag on the list, because the two lists answer different
 * questions: the browsable one must never show a row that cannot be attached, and the archived one
 * exists only to un-archive from. Every row it returns has `isArchived: true`.
 */
export const getArchivedGlobalVariations = async () => {
  return await apiClient.get<ApiResponse<GlobalVariationSummary[]>>(`${GLOBAL_VARIATIONS_API_URL}/archived`);
};

export const createGlobalVariation = async (data: CreateGlobalVariationData) => {
  return await apiClient.post<ApiResponse<GlobalVariationSummary>>(GLOBAL_VARIATIONS_API_URL, data);
};

/**
 * Retire a library row — `DELETE /api/global-variations/{id}`.
 *
 * Named for what it usually does, not for its verb: the backend ARCHIVES the row when
 * `usedOnProductCount > 0` and soft-deletes it only when nothing uses it (plan D4). Neither branch
 * touches the products that already copied the row, and neither is a hard delete, so nothing on a
 * past order can lose its text.
 */
export const archiveGlobalVariation = async (id: string) => {
  return await apiClient.delete<ApiResponse<string>>(`${GLOBAL_VARIATIONS_API_URL}/${encodeURIComponent(id)}`);
};

/** Un-archive a row so it is browsable and attachable again — admin only. */
export const restoreGlobalVariation = async (id: string) => {
  return await apiClient.post<ApiResponse<GlobalVariationSummary>>(
    `${GLOBAL_VARIATIONS_API_URL}/${encodeURIComponent(id)}/restore`,
  );
};
