'use client';

import { useMemo } from 'react';
import { getGlobalVariations, type GlobalVariationSummary } from '@/services/globalVariationService';
import { attachedVariationKeys } from '@/components/admin/product/globalVariationLibrary';
import { useLibraryCatalog, type LibraryCatalog, type LibraryFilter } from './useLibraryCatalog';
import type { Variation } from '@/components/admin/product/types';

/**
 * The filter set is the shared one — the two catalogs carry the same fields, so they can answer the
 * same three questions. Re-exported under the variation name so existing importers keep their
 * import.
 */
export type VariationLibraryFilter = LibraryFilter;
export type { LibraryStatus } from './useLibraryArchive';

interface UseGlobalVariationLibraryArgs {
  /** The picker is open. The catalog is fetched on the first open, not on mount. */
  isOpen: boolean;
  /** The product's current variations — what "already added" means. */
  attached: Pick<Variation, 'name' | 'globalVariationId'>[];
  /** UI language, used by the `translated` filter. */
  languageCode: string;
}

/**
 * The global variation library, browsable (plan S4).
 *
 * All of the behaviour is `useLibraryCatalog`. What is left here is the one endpoint, the one
 * failure sentence, and the one thing that genuinely differs between the catalogs: which field
 * records provenance, which is what `attachedVariationKeys` reads.
 */
export function useGlobalVariationLibrary({
  isOpen,
  attached,
  languageCode,
}: UseGlobalVariationLibraryArgs): LibraryCatalog<GlobalVariationSummary> {
  const attachedKeys = useMemo(() => attachedVariationKeys(attached), [attached]);

  return useLibraryCatalog<GlobalVariationSummary>({
    isOpen,
    fetchCatalog: getGlobalVariations,
    loadFailedKey: 'variation_library_load_failed',
    attachedKeys,
    languageCode,
  });
}

export default useGlobalVariationLibrary;
