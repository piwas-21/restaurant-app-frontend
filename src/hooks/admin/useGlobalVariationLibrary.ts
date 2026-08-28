'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGlobalVariations, type GlobalVariationSummary } from '@/services/globalVariationService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import {
  hasTranslationFor,
  matchesQuery,
  rankByQuery,
  MAX_VISIBLE_LIBRARY_ROWS,
} from '@/components/admin/product/libraryMatching';
import { attachedVariationKeys, isAlreadyAttached } from '@/components/admin/product/globalVariationLibrary';
import type { LibraryStatus } from './useLibraryArchive';
import type { Variation } from '@/components/admin/product/types';

/**
 * The three filters the DATA can answer, and no more — the same three the ingredient picker
 * offers, because `GlobalVariationDto` carries the same fields.
 *
 * There is deliberately no "by price" filter, which is the one a reader might expect on a size
 * ladder: the catalog carries no price at all (backend #431), because "Large" is +2.00 on a pizza
 * and +0.50 on a coffee. A chip claiming to sort by price could only ever lie.
 */
export type VariationLibraryFilter = 'all' | 'notAdded' | 'translated';

interface UseGlobalVariationLibraryArgs {
  /** The picker is open. The catalog is fetched on the first open, not on mount. */
  isOpen: boolean;
  /** The product's current variations — what "already added" means. */
  attached: Pick<Variation, 'name' | 'globalVariationId'>[];
  /** UI language, used by the `translated` filter. */
  languageCode: string;
}

/**
 * Loads the global variation library once per open and filters it in the browser.
 *
 * There is no `/search` endpoint to call instead, by decision (backend #431): the ingredient one
 * was measured unusable — it answers an empty query with an empty list, so it cannot browse, and it
 * matches the English `DefaultName` only, so it cannot help anyone who does not already know the
 * word. Both are the whole complaint this slice answers. The list is ~50 seeded rows, an order of
 * magnitude smaller than the ingredient library's 654.
 */
export function useGlobalVariationLibrary({ isOpen, attached, languageCode }: UseGlobalVariationLibraryArgs) {
  const tRef = useStableT();
  const [catalog, setCatalog] = useState<GlobalVariationSummary[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VariationLibraryFilter>('all');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    const load = async () => {
      try {
        const response = await getGlobalVariations();
        if (cancelled) return;
        if (!response?.success) {
          setCatalog([]);
          setLoadError(serverMessage(response) ?? tRef.current('variation_library_load_failed'));
          setStatus('error');
          return;
        }
        setCatalog(response.data ?? []);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setCatalog([]);
        setLoadError(getErrorMessage(error) ?? tRef.current('variation_library_load_failed'));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadToken, tRef]);

  const attachedKeys = useMemo(() => attachedVariationKeys(attached), [attached]);

  const matching = useMemo(() => {
    const filtered = catalog.filter((variation) => {
      // Never offer an archived row (plan D4). `GET /api/global-variations` promises to exclude
      // them, but this list is held in memory for the whole time the modal is open, so a row
      // archived from the picker itself must stop being attachable the moment it is archived —
      // not one refetch later.
      if (variation.isArchived) return false;
      if (!matchesQuery(variation, query)) return false;
      if (filter === 'notAdded') return !isAlreadyAttached(variation, attachedKeys);
      if (filter === 'translated') return hasTranslationFor(variation, languageCode);
      return true;
    });
    return rankByQuery(filtered, query);
  }, [catalog, query, filter, attachedKeys, languageCode]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * Mark a row archived in the list that is already on screen, so it stops being offerable the
   * moment it is retired rather than one refetch later. This only pre-empts the refetch; the
   * refetch is still what reconciles the list with the server.
   */
  const markArchived = useCallback((id: string) => {
    setCatalog((rows) => rows.map((row) => (row.id === id ? { ...row, isArchived: true } : row)));
  }, []);

  const reset = useCallback(() => {
    setQuery('');
    setFilter('all');
  }, []);

  return {
    status,
    loadError,
    reload,
    markArchived,
    reset,
    query,
    setQuery,
    filter,
    setFilter,
    /** Everything that matched, so the count can be honest about what the cap is hiding. */
    matchCount: matching.length,
    visible: matching.slice(0, MAX_VISIBLE_LIBRARY_ROWS),
    isAttached: useCallback(
      (variation: GlobalVariationSummary) => isAlreadyAttached(variation, attachedKeys),
      [attachedKeys],
    ),
  };
}

export default useGlobalVariationLibrary;
