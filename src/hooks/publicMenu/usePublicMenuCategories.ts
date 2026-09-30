'use client';

import { useEffect, useState } from 'react';
import { getCategories } from '@/services/categoryService';
import type { ApiCategory } from '@/types/menu';
import { loadVisiblePages, type PublicPagedItems } from './loadVisiblePages';

/**
 * Reuses a complete server snapshot on public routes; client-only callers walk the bounded pages.
 * Failures leave the menu browsable through its "all items" view.
 */
export function usePublicMenuCategories(
  initialCategories?: ApiCategory[],
  initialCategoriesComplete = false,
): ApiCategory[] {
  const [categories, setCategories] = useState<ApiCategory[]>(initialCategories ?? []);

  useEffect(() => {
    if (initialCategoriesComplete) return;
    // StrictMode double-invokes effects in dev; the `active` flag captured in
    // this effect's closure prevents the unmounted/superseded run from
    // committing state. Cleanup sets it false; the async block re-checks it
    // before every setState.
    let active = true;
    const init = async () => {
      try {
        const loaded = await loadVisiblePages(
          (page) => getCategories(page, 100) as unknown as Promise<PublicPagedItems<ApiCategory>>,
          1,
          100,
        );
        if (!active) return;
        setCategories(loaded.allItems);
      } catch (e) {
        if (!active) return;
        console.error('Failed to load categories', e);
        setCategories([]);
      }
    };
    // `init` handles its own errors internally — `void` signals
    // intentional fire-and-forget.
    void init();
    return () => {
      active = false;
    };
  }, [initialCategoriesComplete]);

  return categories;
}
