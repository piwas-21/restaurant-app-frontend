'use client';

import { useEffect, useRef, useState } from 'react';
import { searchProducts } from '@/services/productService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import type { ProductSearchResult, ProductType } from '@/components/admin/product/types';

/**
 * Two in-repo precedents already agree on these numbers — `CustomerSearchInput` and
 * `MenuItemSelector` — so this is not a third opinion.
 */
export const SIDE_ITEM_SEARCH_MIN_LENGTH = 2;
export const SIDE_ITEM_SEARCH_DEBOUNCE_MS = 300;

/**
 * Every state the results area can be in, named — because "no rows" is FIVE different situations
 * and only one of them means "the menu has nothing matching".
 *
 * - `idle` — nothing typed. Say nothing.
 * - `tooShort` — below the minimum. Say nothing; the user is mid-word.
 * - `searching` — a request is in flight, or the debounce window before one is. **No answer exists
 *   yet**, so the empty state must not render.
 * - `results` / `empty` — the server answered.
 * - `error` — the server did not answer; `searchError` carries the reason and SUPPRESSES `empty`.
 */
export type SideItemSearchStatus = 'idle' | 'tooShort' | 'searching' | 'results' | 'empty' | 'error';

/**
 * Debounced, server-side product search for `SuggestedSideItemsPicker` (F8).
 *
 * **What was wrong.** This called `getProducts(1, 20)` — no search term — and filtered that page in
 * the browser. Against RUMI's 76 products the outgoing request was byte-identical whatever you
 * typed, and anything outside the first 20 rows was unfindable. The owner found it on prod with the
 * network tab open.
 *
 * **Three things that must stay true.**
 *
 * 1. `searchProducts` is the ONLY filter. The server also matches LOCALISED names, so a client-side
 *    `p.name.includes(term)` would fetch the Turkish match and then throw it away — the fix would
 *    still fail for exactly the tenant who needs it.
 * 2. The generation counter is not optional. Under a button, an out-of-order response was a rare
 *    edge case; under type-ahead it is the normal one — short queries answer slower than the long
 *    query that replaced them, so without this the list settles on a stale answer. `MenuItemSelector`
 *    has no guard, which is the one thing not to copy from it.
 * 3. `status` is what the panel renders from, never `results.length`. See `SideItemSearchStatus`.
 */
export function useSideItemSearch() {
  // Through a ref, NOT a dependency: listing `t` would re-run the search on every language switch.
  const tRef = useStableT();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [status, setStatus] = useState<SideItemSearchStatus>('idle');
  // Bumped whenever a newer question is asked — including when the input is cleared, so a response
  // to a question the user has taken back never reaches the screen either.
  const generationRef = useRef(0);

  useEffect(() => {
    const term = search.trim();

    if (term.length < SIDE_ITEM_SEARCH_MIN_LENGTH) {
      generationRef.current += 1;
      setResults([]);
      setSearchError(null);
      setStatus(term.length === 0 ? 'idle' : 'tooShort');
      return;
    }

    // `searching` from the KEYSTROKE, not from the request: the debounce window is time in which
    // no answer exists either, and "No side items found" must not appear in it.
    setStatus('searching');
    setSearchError(null);

    const runSearch = async (generation: number) => {
      try {
        const resp = await searchProducts(term);
        // Stale: a newer keystroke has already asked a different question.
        if (generation !== generationRef.current) return;
        if (!resp?.success) {
          setResults([]);
          setSearchError(
            serverMessage(resp) ?? tRef.current('side_items_search_failed', 'Could not search side items'),
          );
          setStatus('error');
          return;
        }
        // NO client-side filter — see the doc comment. Any product type may be a side item.
        const items = (resp.data?.items ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          basePrice: p.basePrice,
          // `Product.type` is declared `string` because it mirrors the backend enum's
          // `[EnumMember]` value (see its note in `menu-management/interfaces.ts`);
          // `ProductSearchResult` narrows the same field to the union.
          type: p.type as ProductType,
        }));
        setResults(items);
        setSearchError(null);
        setStatus(items.length === 0 ? 'empty' : 'results');
      } catch (err) {
        if (generation !== generationRef.current) return;
        setResults([]);
        setSearchError(getErrorMessage(err) ?? tRef.current('side_items_search_failed', 'Could not search side items'));
        setStatus('error');
      }
    };

    const timer = setTimeout(() => {
      // The generation is taken when the request is FIRED, not when it is scheduled: a cancelled
      // timer never asked anything, and numbering it would make the next answer look stale.
      generationRef.current += 1;
      // `runSearch` reports its own failures into `searchError`; fire-and-forget.
      void runSearch(generationRef.current);
    }, SIDE_ITEM_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, tRef]);

  const resetSearch = () => {
    generationRef.current += 1;
    setSearch('');
    setResults([]);
    setSearchError(null);
    setStatus('idle');
  };

  return {
    search,
    setSearch,
    results,
    status,
    resetSearch,
    searchError,
  };
}

export default useSideItemSearch;
