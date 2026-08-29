'use client';

import { useMemo } from 'react';
import { getGlobalIngredients, type GlobalIngredientSummary } from '@/services/globalIngredientService';
import { attachedLibraryKeys } from '@/components/admin/product/globalIngredientLibrary';
import { resolveIngredientKind } from '@/utils/ingredientKind';
import { useLibraryCatalog, type LibraryCatalog } from './useLibraryCatalog';
import type { IngredientKind, ProductIngredient } from '@/types/menu';

/**
 * Both moved to the shared modules they are now defined by — the status to `useLibraryArchive` with
 * the archive drawer it is also the status of, the filter set to `useLibraryCatalog` — and
 * re-exported here so every existing importer keeps its import.
 */
export type { LibraryStatus } from './useLibraryArchive';
export type { LibraryFilter } from './useLibraryCatalog';

interface UseGlobalIngredientLibraryArgs {
  /** The picker is open. The catalog is fetched on the first open, not on mount. */
  isOpen: boolean;
  /** The product's current ingredients — what "already added" means. */
  attached: ProductIngredient[];
  /** UI language, used by the `translated` filter. */
  languageCode: string;
  /**
   * The GROUP the picker was opened from. The catalog is narrowed to it by default (slice G2), so a
   * Sauces picker does not open onto the whole ingredient shelf. Optional and absent means no
   * narrowing at all — never "narrow to ingredients", which would hide every sauce from a caller
   * that simply did not say.
   */
  kind?: IngredientKind;
}

/**
 * The global ingredient library, browsable (plan S2).
 *
 * The behaviour moved to `useLibraryCatalog` unchanged when the variation picker (plan S4) needed
 * the identical browse; what is left is the one endpoint, the one failure sentence, and the
 * provenance field `attachedLibraryKeys` reads.
 */
export function useGlobalIngredientLibrary({
  isOpen,
  attached,
  languageCode,
  kind,
}: UseGlobalIngredientLibraryArgs): LibraryCatalog<GlobalIngredientSummary> {
  const attachedKeys = useMemo(() => attachedLibraryKeys(attached), [attached]);

  /**
   * Through `resolveIngredientKind`, so a seeded row that predates the discriminator and carries no
   * `kind` at all reads as an ingredient here exactly as it does everywhere else. Comparing
   * `row.kind === kind` directly would drop all 654 of them out of BOTH groups.
   *
   * Memoised: an inline arrow is a new function on every render, and the catalog re-derives its
   * whole filtered list whenever this identity changes.
   */
  const scope = useMemo(
    () => (kind ? (row: GlobalIngredientSummary) => resolveIngredientKind(row) === kind : undefined),
    [kind],
  );

  return useLibraryCatalog<GlobalIngredientSummary>({
    isOpen,
    fetchCatalog: getGlobalIngredients,
    loadFailedKey: 'ingredient_library_load_failed',
    attachedKeys,
    languageCode,
    scope,
  });
}

export default useGlobalIngredientLibrary;
