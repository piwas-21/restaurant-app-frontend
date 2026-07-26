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

  // Two effects, not one branching effect: `GetMenuBundlesQuery` takes no `RequestedOrderType` at
  // all (ORDER-TYPE-AVAILABILITY-PLAN §9.2), so keeping the bundles load in an effect that depends
  // on the channel would refetch them — and silently bounce the guest from page 3 back to page 1 —
  // every time the sidebar toggle moved, for a query the channel cannot affect.
  useEffect(() => {
    if (selectedView !== MENU_BUNDLES_KEY) return;
    void fetchMenuBundles(1);
  }, [selectedView, fetchMenuBundles]);

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
        void fetchMenuBundles(page);
      } else {
        void fetchProducts(page, selectedViewRef.current, orderTypeRef.current);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [fetchProducts, fetchMenuBundles],
  );

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
    refetch: () => {
      // Returns the promise so callers (e.g. admin save flows) can `await`
      // a fresh load instead of racing the next render.
      if (selectedViewRef.current === MENU_BUNDLES_KEY) {
        return fetchMenuBundles(currentPage);
      }
      return fetchProducts(currentPage, selectedViewRef.current, orderTypeRef.current);
    },
  } as const;
}
