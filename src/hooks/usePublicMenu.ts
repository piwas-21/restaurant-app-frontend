'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Track the latest selectedView without retriggering callbacks. Page
  // changes and refetches read this ref so the pagination handler doesn't
  // need to be rebuilt every time the active view flips.
  const selectedViewRef = useRef(selectedView);
  useEffect(() => {
    selectedViewRef.current = selectedView;
  }, [selectedView]);

  // Reset to page 1 and load when the view changes.
  useEffect(() => {
    if (!selectedView) return;
    if (selectedView === MENU_BUNDLES_KEY) {
      void fetchMenuBundles(1);
    } else {
      void fetchProducts(1, selectedView);
    }
  }, [selectedView, fetchProducts, fetchMenuBundles]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (selectedViewRef.current === MENU_BUNDLES_KEY) {
        void fetchMenuBundles(page);
      } else {
        void fetchProducts(page, selectedViewRef.current);
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
      return fetchProducts(currentPage, selectedViewRef.current);
    },
  } as const;
}
