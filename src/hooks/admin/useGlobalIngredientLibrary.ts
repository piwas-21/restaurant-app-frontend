'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGlobalIngredients, type GlobalIngredientSummary } from '@/services/globalIngredientService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import {
  attachedLibraryKeys,
  hasTranslationFor,
  isAlreadyAttached,
  matchesQuery,
  rankByQuery,
  MAX_VISIBLE_LIBRARY_ROWS,
} from '@/components/admin/product/globalIngredientLibrary';
import type { ProductIngredient } from '@/types/menu';

export type LibraryStatus = 'loading' | 'ready' | 'error';

/**
 * The three filters the DATA can answer, and no more. The approved screen also draws category
 * chips (Vegetables / Cheese / Meat / …) and a "Recently used" one: `GlobalIngredientDto` carries
 * no category and nothing records a use, so those chips could only ever lie. Its "used on N items"
 * column is no longer in that group — the DTO carries `usedOnProductCount` since plan S3.
 */
export type LibraryFilter = 'all' | 'notAdded' | 'translated';

interface UseGlobalIngredientLibraryArgs {
  /** The picker is open. The catalog is fetched on the first open, not on mount. */
  isOpen: boolean;
  /** The product's current ingredients — what "already added" means. */
  attached: ProductIngredient[];
  /** UI language, used by the `translated` filter. */
  languageCode: string;
}

/**
 * Loads the global ingredient library once per open and filters it in the browser.
 *
 * Why not the `/search` endpoint the inline type-ahead uses: it answers an empty query with an
 * empty list, and it matches `DefaultName` only. Neither is browsable, and the whole complaint
 * this slice answers is that you must already know the name before the library can help you.
 */
export function useGlobalIngredientLibrary({ isOpen, attached, languageCode }: UseGlobalIngredientLibraryArgs) {
  const tRef = useStableT();
  const [catalog, setCatalog] = useState<GlobalIngredientSummary[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    const load = async () => {
      try {
        const response = await getGlobalIngredients();
        if (cancelled) return;
        if (!response?.success) {
          setCatalog([]);
          setLoadError(serverMessage(response) ?? tRef.current('ingredient_library_load_failed'));
          setStatus('error');
          return;
        }
        setCatalog(response.data ?? []);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setCatalog([]);
        setLoadError(getErrorMessage(error) ?? tRef.current('ingredient_library_load_failed'));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadToken, tRef]);

  const attachedKeys = useMemo(() => attachedLibraryKeys(attached), [attached]);

  const matching = useMemo(() => {
    const filtered = catalog.filter((ingredient) => {
      // Never offer an archived row (plan D4). `GET /api/global-ingredients` promises to exclude
      // them, but this list is held in memory for the whole time the modal is open, so a row
      // archived from the picker itself must stop being attachable the moment it is archived —
      // not one refetch later. The guard costs one comparison and makes that unconditional.
      if (ingredient.isArchived) return false;
      if (!matchesQuery(ingredient, query)) return false;
      if (filter === 'notAdded') return !isAlreadyAttached(ingredient, attachedKeys);
      if (filter === 'translated') return hasTranslationFor(ingredient, languageCode);
      return true;
    });
    return rankByQuery(filtered, query);
  }, [catalog, query, filter, attachedKeys, languageCode]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * Mark a row archived in the list that is already on screen.
   *
   * Archiving refetches the catalog, but that is one ~650-row response away and the row must stop
   * being offerable immediately — otherwise the admin can tick a row they have just retired. This
   * only pre-empts the refetch; the refetch is still what reconciles the list with the server.
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
      (ingredient: GlobalIngredientSummary) => isAlreadyAttached(ingredient, attachedKeys),
      [attachedKeys],
    ),
  };
}

export default useGlobalIngredientLibrary;
