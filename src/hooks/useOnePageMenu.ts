'use client';

import { useCallback, useState } from 'react';
import { usePublicMenuCategories } from '@/hooks/publicMenu/usePublicMenuCategories';
import {
  useOnePageMenuData,
  type OnePageCategoryState,
  type UseOnePageMenuDataReturn,
} from '@/hooks/publicMenu/useOnePageMenuData';
import { ALL_ITEMS_KEY } from '@/hooks/publicMenu/constants';
import type { ApiCategory } from '@/types/menu';
import type { FetcherState } from '@/hooks/publicMenu/pipeline';

/** DOM id of a section's scroll anchor. One spelling, shared by renderer and scroller. */
export function onePageSectionId(view: string): string {
  return `menu-section-${view}`;
}

export interface OnePageSection {
  category: ApiCategory;
  /** That category's product state (items / loading / error). */
  state: OnePageCategoryState;
}

export interface UseOnePageMenuReturn {
  categories: ApiCategory[];
  /** Sections in nav order — the renderer walks this list. */
  sections: OnePageSection[];
  menuBundles: UseOnePageMenuDataReturn['menuBundles'];
  bundlesState: FetcherState;
  refetchCategory: (categoryId: string) => void;
  refetchBundles: () => void;
  /** The nav tab the guest last jumped to (`all` initially) — the nav's active state. */
  activeSectionId: string;
  /** Nav click: record the tab and scroll the section under the sticky bar. */
  selectSection: (view: string) => void;
}

/**
 * The one-page layout's controller: every category's products + the bundles, plus
 * the jump-to-section behaviour for the category bar. The bar keeps its tabs
 * (All, Menu Bundles, one per category — the same `useCategoryTabs` list the tabs
 * layout renders); in this layout a click SCROLLS instead of swapping the view.
 *
 * `All` scrolls to the top of the page — every category is already on it, so "all
 * items" here is the page itself. Any other id scrolls its section under the
 * sticky bar: `scroll-margin-top` on the section (MenuOnePage.module.css) carries
 * the measured header + banner + nav offsets the page root publishes, so the
 * element lands just below the bar without the scroller doing offset arithmetic.
 */
export function useOnePageMenu(enabled: boolean): UseOnePageMenuReturn {
  const categories = usePublicMenuCategories();
  const { byCategory, menuBundles, bundlesState, refetchCategory, refetchBundles } = useOnePageMenuData(
    categories,
    enabled,
  );

  const [activeSectionId, setActiveSectionId] = useState<string>(ALL_ITEMS_KEY);

  const selectSection = useCallback((view: string) => {
    setActiveSectionId(view);
    if (view === ALL_ITEMS_KEY) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(onePageSectionId(view))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const sections: OnePageSection[] = categories.map((category) => ({
    category,
    state: byCategory[category.id] ?? { items: [], isLoading: false, error: null },
  }));

  return {
    categories,
    sections,
    menuBundles,
    bundlesState,
    refetchCategory,
    refetchBundles,
    activeSectionId,
    selectSection,
  };
}
