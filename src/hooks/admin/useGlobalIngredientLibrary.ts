'use client';

import { useMemo } from 'react';
import { getGlobalIngredients, type GlobalIngredientSummary } from '@/services/globalIngredientService';
import { attachedLibraryKeys } from '@/components/admin/product/globalIngredientLibrary';
import { useLibraryCatalog, type LibraryCatalog } from './useLibraryCatalog';
import type { ProductIngredient } from '@/types/menu';

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
}: UseGlobalIngredientLibraryArgs): LibraryCatalog<GlobalIngredientSummary> {
  const attachedKeys = useMemo(() => attachedLibraryKeys(attached), [attached]);

  return useLibraryCatalog<GlobalIngredientSummary>({
    isOpen,
    fetchCatalog: getGlobalIngredients,
    loadFailedKey: 'ingredient_library_load_failed',
    attachedKeys,
    languageCode,
  });
}

export default useGlobalIngredientLibrary;
