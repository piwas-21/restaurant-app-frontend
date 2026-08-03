'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/services/menuService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessages } from '@/utils/apiFormErrors';
import { useStableT } from '@/hooks/useStableT';
import type { ProductSearchResult, ProductType } from '@/components/admin/product/types';

export interface SideItemDetails {
  name: string;
  description?: string;
}

/**
 * The two product reads behind `SuggestedSideItemsPicker` (E9 step 3, slice 7).
 *
 * Extracted because both of its `} catch {` blocks swallowed, and giving each one somewhere to
 * report would have pushed the component past the 250-line gate — the failure mode recorded in
 * BUGS-IMPROVEMENTS-PLAN, where explaining a fix is what breaks the file that holds it. A hook is
 * the sanctioned split (CLAUDE.md §5.1) and `use[A-Z]*.ts` under `src/**` is gated at 200, so this
 * does not land somewhere the length checker cannot see.
 *
 * **What each swallow cost, which is not the same thing in the two cases.**
 *
 * - The details read backs the CHIPS for already-selected items. On failure `selectedItemsDetails`
 *   stayed empty and the chip fell through to `` `Item ${id.substring(0, 8)}...` `` — so the admin
 *   saw `Item 3f2a9c11...` where a dish name belongs, with nothing saying the lookup had failed.
 *   That is the last of the sites #400 flagged as "absorbing the newly-propagating error without
 *   telling the user".
 * - The search read is the worse one. Its catch cleared `results`, and the panel renders
 *   "No side items found" from `search && results.length === 0` — so a dead backend answered a
 *   question about the menu that the server never answered. Same shape as `usePublicMenuData` in
 *   #408: where an empty list is read as a fact, an error that empties the list states a falsehood.
 *
 * Both errors are surfaced separately because they appear in different places on screen and one can
 * be live while the other is not.
 *
 * **What this does NOT guard, said rather than implied.** The details effect has a cancellation
 * flag; `runSearch` does not, so two rapid Search clicks can still land out of order and an older
 * result can overwrite a newer one. That is unchanged from the code this replaces and is not what
 * the slice set out to fix — but the guard is on one read and not the other, which is worth knowing
 * before trusting either.
 */
export function useSideItemSearch(selectedSideItemIds: string[]) {
  // Through a ref, NOT a dependency: listing `t` would refetch the details on every language
  // switch. See `useStableT` for why a unit test does not show that.
  const tRef = useStableT();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedItemsDetails, setSelectedItemsDetails] = useState<Map<string, SideItemDetails>>(new Map());

  // Depend on a serialized key so the effect only re-runs when the actual IDs change; the array
  // reference is unstable across parent renders.
  const idKey = selectedSideItemIds.join(',');

  useEffect(() => {
    // Race guard: rapid changes to `selectedSideItemIds` can land an older fetch after a newer
    // one, so we use the cancellation-flag pattern (same idiom as `useGuestProfilePrefill`) to
    // suppress stale state writes — including the error writes below.
    let cancelled = false;

    const fetchSelectedItemsDetails = async () => {
      const ids = idKey ? idKey.split(',') : [];
      if (ids.length === 0) {
        if (!cancelled) {
          setSelectedItemsDetails(new Map());
          setDetailsError(null);
        }
        return;
      }

      try {
        const resp = await getProducts(1, 100, undefined);
        if (cancelled) return;
        if (!resp.success) {
          // A 200-wrapped refusal. `getProducts` returns the envelope rather than throwing, so
          // without this branch a `success: false` read exactly like an empty product list — and
          // `serverMessages` because the reason is in `errors[]`, `message` being "Operation
          // failed" on the one-argument `Failure`. Falling straight to the generic here would be
          // the half-fix the ratchet cannot see.
          setDetailsError(
            serverMessages(resp)[0] ?? tRef.current('side_items_load_failed', 'Could not load the selected side items'),
          );
          return;
        }
        const rows = resp.data.items;
        const detailsMap = new Map<string, SideItemDetails>();
        for (const id of ids) {
          const item = rows.find((p) => p.id === id);
          if (item) detailsMap.set(id, { name: item.name, description: item.description });
        }
        setSelectedItemsDetails(detailsMap);
        setDetailsError(null);
      } catch (err) {
        if (cancelled) return;
        setDetailsError(
          getErrorMessage(err) ?? tRef.current('side_items_load_failed', 'Could not load the selected side items'),
        );
      }
    };

    // `fetchSelectedItemsDetails` reports its own failures into `detailsError`; fire-and-forget.
    void fetchSelectedItemsDetails();

    return () => {
      cancelled = true;
    };
  }, [idKey, tRef]);

  const runSearch = async () => {
    if (!search.trim()) return;

    try {
      setSearchError(null);
      const resp = await getProducts(1, 20, undefined);
      if (!resp.success) {
        setResults([]);
        setSearchError(
          serverMessages(resp)[0] ?? tRef.current('side_items_search_failed', 'Could not search side items'),
        );
        return;
      }
      const needle = search.toLowerCase();
      const filteredItems = resp.data.items
        // Any product type is allowed as a side item.
        .filter((p) => p.name.toLowerCase().includes(needle))
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          basePrice: p.basePrice,
          // `Product.type` is declared `string` because it mirrors the backend enum's
          // `[EnumMember]` value (see its note in `menu-management/interfaces.ts`);
          // `ProductSearchResult` narrows the same field to the union. The old code reached this
          // through `(p: any)`, which erased the mismatch instead of naming it.
          type: p.type as ProductType,
        }));
      setResults(filteredItems);
    } catch (err) {
      setResults([]);
      setSearchError(getErrorMessage(err) ?? tRef.current('side_items_search_failed', 'Could not search side items'));
    }
  };

  const resetSearch = () => {
    setSearch('');
    setResults([]);
    setSearchError(null);
  };

  return {
    search,
    setSearch,
    results,
    runSearch,
    resetSearch,
    searchError,
    detailsError,
    selectedItemsDetails,
  };
}

export default useSideItemSearch;
