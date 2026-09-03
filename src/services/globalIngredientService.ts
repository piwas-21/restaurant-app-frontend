import { apiClient } from '@/utils/apiClient';
import type { LibraryOrigin } from '@/components/admin/product/libraryOrigin';
import type { IngredientKind } from '@/types/menu';

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
 * Mirrors backend `Features/GlobalIngredients/Dtos/GlobalIngredientDto.cs`. There is still no
 * category on that DTO — the category chips the approved screen draws would have to invent one —
 * but since plan S3 it does carry a usage count and an archived flag.
 */
export interface GlobalIngredientSummary {
  id: string;
  defaultName: string;
  imageUrl?: string;
  isActive: boolean;
  translations: GlobalIngredientTranslation[];
  /**
   * How many distinct non-deleted products link an ingredient to this row (plan D6, "used on N
   * items"). It is also what decides what `archiveGlobalIngredient` DOES, so the picker derives
   * its destructive label from this number rather than guessing.
   */
  usedOnProductCount: number;
  /**
   * Archived rows are kept, never removed (plan D4). They are served only by
   * `getArchivedGlobalIngredients`, and the picker refuses to offer one for attaching whatever
   * the list endpoint sends.
   */
  isArchived: boolean;
  /** Platform seed or this tenant's own — see `LibraryOrigin`. */
  origin?: LibraryOrigin;
  /**
   * `'ingredient'` | `'sauce'` (plan D8). ADDITIVE and optional: every seeded row predates the
   * discriminator and arrives without it, which is why nothing here defaults it — read it through
   * `resolveIngredientKind` (`@/utils/ingredientKind`).
   */
  kind?: IngredientKind;
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
  /** Omitted === `'ingredient'` server-side, so the create path only ever has to send a sauce. */
  kind?: IngredientKind;
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

/**
 * The archived half of the library — `GET /api/global-ingredients/archived`, admin only.
 *
 * A separate endpoint rather than a flag on the list, because the two lists answer different
 * questions: the browsable one must never show a row that cannot be attached, and the archived
 * one exists only to un-archive from. Every row it returns has `isArchived: true`.
 */
export const getArchivedGlobalIngredients = async () => {
  return await apiClient.get<ApiResponse<GlobalIngredientSummary[]>>(`${GLOBAL_INGREDIENTS_API_URL}/archived`);
};

/**
 * Retire a library row — `DELETE /api/global-ingredients/{id}`.
 *
 * Named for what it usually does, not for its verb: the backend ARCHIVES the row when
 * `usedOnProductCount > 0` and soft-deletes it only when nothing uses it (plan D4 — "a catalog row
 * in use is archived, never removed"). Neither branch touches the products that already copied the
 * row, and neither is a hard delete, so nothing on a past order can lose its text.
 *
 * The payload is `ApiResponse<string>`; the caller reads `success`, not `data`.
 */
export const archiveGlobalIngredient = async (id: string) => {
  return await apiClient.delete<ApiResponse<string>>(`${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(id)}`);
};

/** Un-archive a row so it is browsable and attachable again — admin only. */
export const restoreGlobalIngredient = async (id: string) => {
  return await apiClient.post<ApiResponse<GlobalIngredientSummary>>(
    `${GLOBAL_INGREDIENTS_API_URL}/${encodeURIComponent(id)}/restore`,
  );
};
