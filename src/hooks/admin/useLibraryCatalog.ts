'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import {
  hasTranslationFor,
  isAlreadyAttached,
  matchesQuery,
  rankByQuery,
  MAX_VISIBLE_LIBRARY_ROWS,
} from '@/components/admin/product/libraryMatching';
import type { LibraryResponse, LibraryStatus } from './useLibraryArchive';

/**
 * The three filters the DATA can answer, and no more — the same three for both catalogs, because
 * `GlobalIngredientDto` and `GlobalVariationDto` carry the same fields.
 *
 * The approved ingredient screen also drew category chips and a "Recently used" one; neither DTO
 * carries a category and nothing records a use, so those chips could only ever lie. There is no
 * "by price" chip on the variation side for the same reason: the catalog carries no price at all
 * (backend #431), because "Large" is +2.00 on a pizza and +0.50 on a coffee.
 */
export type LibraryFilter = 'all' | 'notAdded' | 'translated';

/** Everything the browse rules need from a catalog row. Both summary DTOs satisfy it. */
export interface CatalogRow {
  id: string;
  defaultName: string;
  isArchived: boolean;
  translations: { languageCode: string; name: string }[];
}

interface UseLibraryCatalogArgs<TRow extends CatalogRow> {
  /** The picker is open. The catalog is fetched on the first open, not on mount. */
  isOpen: boolean;
  /** `GET /api/<catalog>` — the whole browsable list. */
  fetchCatalog: () => Promise<LibraryResponse<TRow[]> | undefined>;
  /** The literal translation key this catalog reports an unreadable list with. */
  loadFailedKey: string;
  /** What "already added" means, built by the catalog's own `attached…Keys`. */
  attachedKeys: Set<string>;
  /** UI language, used by the `translated` filter. */
  languageCode: string;
  /**
   * Which rows this picker is FOR (slice G2) — a SECOND dimension, not a fourth chip: the chips are
   * one exclusive choice and "sauces only" and "not yet added" must be answerable together.
   * Optional; the variation picker passes none, having no kind to be outside of.
   */
  scope?: (row: TRow) => boolean;
}

/** What a picker reads off the browsable half of a library. */
export interface LibraryCatalog<TRow extends CatalogRow> {
  status: LibraryStatus;
  loadError: string | null;
  reload: () => void;
  markArchived: (id: string) => void;
  reset: () => void;
  query: string;
  setQuery: (query: string) => void;
  filter: LibraryFilter;
  setFilter: (filter: LibraryFilter) => void;
  /** Whether `scope` is applied — always `false` when none was supplied. */
  isScoped: boolean;
  setScoped: (isScoped: boolean) => void;
  /** How many rows the SCOPE alone hides, so it can never hide one SILENTLY (`LibraryKindScopeNotice`). */
  scopeHiddenCount: number;
  /** Everything that matched, so the count can be honest about what the cap is hiding. */
  matchCount: number;
  visible: TRow[];
  isAttached: (row: TRow) => boolean;
}

/**
 * The browsable half of a library picker: read the catalog once per open, then filter it here.
 *
 * One hook for both catalogs, the twin of `useLibraryArchive`. What differs is one endpoint and one
 * sentence; what does not differ is the part that is easy to get subtly wrong — fetching on open
 * rather than on mount, cancelling an in-flight read, never offering an archived row, and folding
 * accents so a French admin typing "mozzarelle" finds Mozzarella.
 *
 * Neither catalog asks a `/search` endpoint instead, by decision (plan S2, backend #431): the
 * ingredient one answers an empty query with an empty list, so it cannot browse, and it matches the
 * English `DefaultName` only, so it cannot help anyone who does not already know the word. Both are
 * the whole complaint the pickers answer. The cost is one response per open — 654 seeded ingredient
 * rows, ~50 variation rows; if either catalog ever needs paging, both do.
 */
export function useLibraryCatalog<TRow extends CatalogRow>({
  isOpen,
  fetchCatalog,
  loadFailedKey,
  attachedKeys,
  languageCode,
  scope,
}: UseLibraryCatalogArgs<TRow>): LibraryCatalog<TRow> {
  const tRef = useStableT();
  const [catalog, setCatalog] = useState<TRow[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  // ON by default: a Sauces picker opening onto the whole ingredient catalog IS the complaint.
  const [isScopeRequested, setIsScopeRequested] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setStatus('loading');
    setLoadError(null);

    const load = async () => {
      try {
        const response = await fetchCatalog();
        if (cancelled) return;
        if (!response?.success) {
          setCatalog([]);
          setLoadError(serverMessage(response) ?? tRef.current(loadFailedKey));
          setStatus('error');
          return;
        }
        setCatalog(response.data ?? []);
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setCatalog([]);
        setLoadError(getErrorMessage(error) ?? tRef.current(loadFailedKey));
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadToken, tRef, fetchCatalog, loadFailedKey]);

  const withinFilters = useMemo(() => {
    const filtered = catalog.filter((row) => {
      // Never offer an archived row (plan D4). The list endpoints promise to exclude them, but this
      // list is held in memory for the whole time the modal is open, so a row archived from the
      // picker itself must stop being attachable the moment it is archived — not one refetch later.
      if (row.isArchived) return false;
      if (!matchesQuery(row, query)) return false;
      if (filter === 'notAdded') return !isAlreadyAttached(row, attachedKeys);
      if (filter === 'translated') return hasTranslationFor(row, languageCode);
      return true;
    });
    return rankByQuery(filtered, query);
  }, [catalog, query, filter, attachedKeys, languageCode]);

  // Applied LAST, over what the chips and the search box already accepted, so `scopeHiddenCount`
  // counts what the scope ALONE removed; against the raw catalog it would also count rows the search
  // box excluded, and the notice would offer to reveal entries "Show all" does not. Not memoised:
  // the expensive pass is above and `visible` already builds a new array every render.
  const isScoped = Boolean(scope) && isScopeRequested;
  const matching = isScoped && scope ? withinFilters.filter(scope) : withinFilters;

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  /**
   * Mark a row archived in the list that is already on screen, so it stops being offerable the
   * moment it is retired rather than one refetch later — otherwise the admin can tick a row they
   * have just retired. This only pre-empts the refetch; the refetch still reconciles with the
   * server.
   */
  const markArchived = useCallback((id: string) => {
    setCatalog((rows) => rows.map((row) => (row.id === id ? { ...row, isArchived: true } : row)));
  }, []);

  // Scope back ON with the rest: `reset` runs on close, so the next open is a fresh browse.
  const reset = useCallback(() => {
    setQuery('');
    setFilter('all');
    setIsScopeRequested(true);
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
    isScoped,
    setScoped: setIsScopeRequested,
    scopeHiddenCount: withinFilters.length - matching.length,
    matchCount: matching.length,
    visible: matching.slice(0, MAX_VISIBLE_LIBRARY_ROWS),
    isAttached: useCallback((row: TRow) => isAlreadyAttached(row, attachedKeys), [attachedKeys]),
  };
}

export default useLibraryCatalog;
