import {
  createGlobalIngredient,
  searchGlobalIngredients,
  type GlobalIngredientTranslation,
} from '@/services/globalIngredientService';
import { resolveIngredientKind } from '@/utils/ingredientKind';
import type { IngredientKind, ProductIngredient } from '@/types/menu';

/**
 * Give every ingredient a `globalIngredientId` before the product payload leaves.
 *
 * Extracted VERBATIM-IN-BEHAVIOUR from the two copies of the same 63-line block that stood in the
 * create and the edit path of `productFormUtils` — one bug fix would otherwise have had to be made
 * twice, which is how the two drifted in the first place.
 *
 * The rule: an ingredient that already carries provenance is left alone (a picked row does, so the
 * picker short-circuits this whole function). Otherwise the library is searched for an exact,
 * case-insensitive name match and its id adopted; failing that, a library row is created.
 *
 * **The fix this slice carries.** The create used to run only `if (translations.length > 0)`, so an
 * ingredient with a name and no translations — which is every ingredient an admin types without
 * opening "Multilingual names" — never got an id, and therefore ran a fresh search on EVERY save,
 * forever. N such ingredients cost N HTTP round trips per save and the link never appeared. There
 * is nothing to guard against: `CreateGlobalIngredientCommand` maps whatever list arrives, and
 * `defaultName` is the only field `/search` matches on, so a row with no translations is a valid
 * and findable library entry.
 *
 * **A known limit of the search branch, stated rather than hidden (slice G1).** The library is
 * searched BY NAME only, and the row it finds is adopted whatever its kind. So typing "Sauce
 * blanche" into the Sauces group, on a library that already holds that name as an ingredient,
 * reuses the existing row: the PRODUCT row is a sauce and the LIBRARY row stays an ingredient.
 * That is deliberate. Promoting it would let one product's edit rewrite a row every other product
 * shares — the propagation plan D3 refuses, and the reason "reuse" here means COPY. Correcting an
 * existing row's kind belongs to the library screen (G4); `PUT /api/global-ingredients/{id}`
 * already accepts a nullable `Kind` for exactly that.
 */

/**
 * What the editor holds. `submitProductForm` types its ingredients as `any[]` (pre-existing debt),
 * so this is the narrowest shape both callers really satisfy — and the one that makes
 * `globalIngredientId` a typed field rather than the `as any` the old block reached for.
 */
type IngredientDraft = ProductIngredient;

const translationsOf = (ingredient: IngredientDraft): GlobalIngredientTranslation[] =>
  Object.entries(ingredient.content ?? {})
    .filter(([, content]) => Boolean(content?.name?.trim()))
    .map(([languageCode, content]) => ({ languageCode, name: content.name }));

const findExistingId = async (name: string): Promise<string | null> => {
  try {
    const response = await searchGlobalIngredients(name);
    if (!response?.success) return null;
    const match = (response.data ?? []).find((entry) => entry.defaultName.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  } catch (error) {
    console.error('Failed to search global ingredient:', error);
    return null;
  }
};

/**
 * `kind` is the row's OWN — which is the group the admin typed it into, because
 * `ProductIngredientsManager` stamps every row it creates with the group it is.
 *
 * Sending it is the whole of slice G1. Without it the backend defaults an absent kind to
 * `ingredient` (`CreateGlobalIngredientCommand`), so a sauce typed into the Sauces group was stored
 * in the shared library AS AN INGREDIENT and its sauce-ness was lost the moment it left the product
 * — measured on a live tenant as 654 library rows, `ingredient` on 654 of them and `sauce` on none.
 * The product row was always right; only the library copy was wrong.
 */
const createLibraryRow = async (
  name: string,
  translations: GlobalIngredientTranslation[],
  kind: IngredientKind,
): Promise<string | null> => {
  try {
    const response = await createGlobalIngredient({ defaultName: name, translations, kind });
    return response?.success ? (response.data?.id ?? null) : null;
  } catch (error) {
    // Continue without an id: the ingredient still saves, it just carries no provenance.
    console.error('Failed to auto-create global ingredient:', error);
    return null;
  }
};

export async function withGlobalIngredientProvenance<T extends IngredientDraft>(ingredients: T[]): Promise<T[]> {
  return Promise.all(
    ingredients.map(async (ingredient) => {
      const name = (ingredient.name ?? '').trim();
      if (ingredient.globalIngredientId || name.length === 0) return ingredient;

      const existingId = await findExistingId(name);
      if (existingId) return { ...ingredient, globalIngredientId: existingId };

      const createdId = await createLibraryRow(name, translationsOf(ingredient), resolveIngredientKind(ingredient));
      return createdId ? { ...ingredient, globalIngredientId: createdId } : ingredient;
    }),
  );
}

/**
 * Strip the `temp-` ids the editor mints for rows the server has never seen. A supplied id means
 * "update this row" to `ProductIngredientSynchronizer`, and an id it does not own is skipped with a
 * warning — so a temp id must never reach the payload.
 */
export function withoutTemporaryIds<T extends IngredientDraft>(ingredients: T[]): T[] {
  return ingredients.map((ingredient) => {
    if (typeof ingredient.id === 'string' && ingredient.id.startsWith('temp-')) {
      const { id: _temporaryId, ...rest } = ingredient;
      return rest as T;
    }
    return ingredient;
  });
}
