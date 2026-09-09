import { useCallback, useMemo, useState } from 'react';
import { fold } from '@/utils/nameFold';
import type { IngredientEntry } from '@/utils/ingredientTranslationEntries';

/** Which kind of entry the manager shows — mirrors the kind chips already on the page. */
export type KindFilter = 'all' | 'sauce' | 'ingredient';

/** Where an entry comes from: linked to the global library, or the tenant's own. */
export type OriginFilter = 'all' | 'library' | 'custom';

/** The page sizes the manager offers. The whole catalog is already in memory — this only slices it. */
export const INGREDIENT_TRANSLATIONS_PAGE_SIZES: readonly number[] = [25, 50, 100];

const DEFAULT_PAGE_SIZE = 25;

/**
 * View state of the Ingredients & Sauces translations manager: the search box, the kind and
 * origin chips, and the client-side pagination over the ALREADY-LOADED catalog (the page loads
 * every carrier on mount — paging is a slice of `entries`, never a refetch).
 *
 * Every filter change resets the page to 1, and the page is clamped to the filtered total, so a
 * narrowed search can never leave the table on an empty page. Pure view state: it holds no
 * entries of its own and never talks to the API.
 */
export function useIngredientTranslationsView(entries: readonly IngredientEntry[]) {
  const [query, setQueryState] = useState('');
  const [kind, setKindState] = useState<KindFilter>('all');
  const [origin, setOriginState] = useState<OriginFilter>('all');
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPageState(1);
  }, []);

  const setKind = useCallback((value: KindFilter) => {
    setKindState(value);
    setPageState(1);
  }, []);

  const setOrigin = useCallback((value: OriginFilter) => {
    setOriginState(value);
    setPageState(1);
  }, []);

  const setPageSize = useCallback((value: number) => {
    setPageSizeState(value);
    setPageState(1);
  }, []);

  const filtered = useMemo(() => {
    const needle = fold(query);
    return entries.filter((entry) => {
      if (kind !== 'all' && (entry.isSauce ? kind !== 'sauce' : kind !== 'ingredient')) return false;
      // Origin is provenance: an entry is library-linked when ANY of its copies carries the
      // global id — the same marker the save-time reconciliation stamps. Everything else was
      // authored by the tenant and is not linked to the library.
      if (origin === 'library' && !entry.globalIngredientId) return false;
      if (origin === 'custom' && entry.globalIngredientId) return false;
      return needle.length === 0 || fold(entry.defaultName).includes(needle);
    });
  }, [entries, query, kind, origin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  return {
    query,
    setQuery,
    kind,
    setKind,
    origin,
    setOrigin,
    page: safePage,
    setPage: setPageState,
    pageSize,
    setPageSize,
    filteredCount: filtered.length,
    totalPages,
    paged,
  };
}
