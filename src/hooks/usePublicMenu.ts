'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY, type PublicMenuView } from './publicMenu/constants';
import { usePublicMenuCategories } from './publicMenu/usePublicMenuCategories';
import { usePublicMenuData } from './publicMenu/usePublicMenuData';

export { ALL_ITEMS_KEY, MENU_BUNDLES_KEY };
export type { PublicMenuView };

/**
 * Public menu view hook. Composed from:
 *   - `usePublicMenuCategories` — loads the category list once on mount
 *   - `usePublicMenuData` — owns paginated products + bundles state
 *
 * This file orchestrates view-selection: which sub-fetcher to call when
 * the selected view or page changes, and exposes a stable `refetch` that
 * targets the active view. The public return shape is identical to the
 * pre-split hook — callers (`src/app/menu/page.tsx`,
 * `src/components/menu/MenuContent.tsx`) need no changes.
 */
export function usePublicMenu() {
  const categories = usePublicMenuCategories();
  const {
    items,
    menuBundles,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    fetchProducts,
    fetchMenuBundles,
  } = usePublicMenuData();

  const [selectedView, setSelectedView] = useState<PublicMenuView>(ALL_ITEMS_KEY);

  // The channel the guest is ordering through. The server does not FILTER on it — it resolves each
  // row's `availability` so the card can say "takeaway & delivery only" instead of leaving a hole.
  const { state: orderTypeState, hydrated: orderTypeHydrated } = useOrderType();
  const orderType = orderTypeState.orderType;

  // Track the latest selectedView + order type without retriggering callbacks. Page
  // changes and refetches read these refs so the pagination handler doesn't
  // need to be rebuilt every time the active view flips.
  const selectedViewRef = useRef(selectedView);
  useEffect(() => {
    selectedViewRef.current = selectedView;
  }, [selectedView]);

  const orderTypeRef = useRef(orderType);
  useEffect(() => {
    orderTypeRef.current = orderType;
  }, [orderType]);

  // Bundles depend on the channel too, since §9.2 wired `GetMenuBundlesQuery` to resolve each row's
  // verdict. Kept as its own effect rather than folded into the products one: they are different
  // fetchers with different pagination, and one branching effect would re-run on a view change that
  // the other branch does not care about. Waits for `orderTypeHydrated` for the same reason products
  // do — before that, "no channel chosen" and "not read back from localStorage yet" look identical,
  // and fetching on the guess costs a second request plus an undimmed→dimmed flash.
  useEffect(() => {
    if (selectedView !== MENU_BUNDLES_KEY || !orderTypeHydrated) return;
    void fetchMenuBundles(1, orderType);
  }, [selectedView, orderType, orderTypeHydrated, fetchMenuBundles]);

  // Products DO depend on the channel: it decides each row's `availability`, so a switch must
  // re-resolve the list (which resets to page 1 — the verdicts on other pages are stale too).
  //
  // `orderType` is a plain string|null, so it is a VALUE dependency, not an identity one; the
  // fetcher takes the channel as an argument and keeps its `useCallback` identity stable. It also
  // waits for `orderTypeHydrated`: before that, "no channel chosen" and "not yet read back from
  // localStorage" look identical, and fetching on the guess costs a second request plus a visible
  // undimmed→dimmed flash on every restricted card.
  useEffect(() => {
    if (!selectedView || selectedView === MENU_BUNDLES_KEY || !orderTypeHydrated) return;
    void fetchProducts(1, selectedView, orderType);
  }, [selectedView, orderType, orderTypeHydrated, fetchProducts]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (selectedViewRef.current === MENU_BUNDLES_KEY) {
        void fetchMenuBundles(page, orderTypeRef.current);
      } else {
        void fetchProducts(page, selectedViewRef.current, orderTypeRef.current);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [fetchProducts, fetchMenuBundles],
  );

  /**
   * Reload the active view.
   *
   * `useCallback` since S10, when this stopped being unused. Until then it was a fresh arrow on
   * every render and nothing consumed it.
   *
   * Reference hygiene rather than a measured fix, and worth saying plainly: nothing in the chain it
   * now travels — `MenuContent`, `MenuSectionStatus`, `MenuList`, `Pagination` — is wrapped in
   * `memo`, so today an unstable identity would cost nothing either. What it buys is that the first
   * `memo` anyone adds along that path works, instead of being silently defeated by a prop from
   * three components up. (`page.tsx` still passes `onBrowseFullMenu` as an inline arrow for the
   * same reason in reverse: there is no memo to protect and the page is at its §4 line ceiling.)
   *
   * `currentPage` is the only reactive dependency — the view and the order type are already read
   * from refs, which is what makes this safe to hand out.
   */
  const refetch = useCallback(() => {
    // Returns the promise so callers (e.g. admin save flows) can `await`
    // a fresh load instead of racing the next render.
    if (selectedViewRef.current === MENU_BUNDLES_KEY) {
      return fetchMenuBundles(currentPage, orderTypeRef.current);
    }
    return fetchProducts(currentPage, selectedViewRef.current, orderTypeRef.current);
  }, [currentPage, fetchMenuBundles, fetchProducts]);

  return {
    categories,
    selectedView,
    setSelectedView,
    items,
    menuBundles,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange: handlePageChange,
    refetch,
  } as const;
}
