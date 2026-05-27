'use client';

import { useEffect, useState } from 'react';
import { getCategories } from '@/services/categoryService';
import type { ApiCategory } from '@/types/menu';
import type { CategoryListResponse } from './types';

/**
 * Loads the full category list once (page 1, size 100) for menu navigation.
 * Failures are swallowed to an empty list — the menu is still browsable via
 * the "all items" view, which doesn't require categories.
 */
export function usePublicMenuCategories(): ApiCategory[] {
  const [categories, setCategories] = useState<ApiCategory[]>([]);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; the `active` flag captured in
    // this effect's closure prevents the unmounted/superseded run from
    // committing state. Cleanup sets it false; the async block re-checks it
    // before every setState.
    let active = true;
    const init = async () => {
      try {
        const response = (await getCategories(1, 100)) as CategoryListResponse;
        if (!active) return;
        if (response.success && Array.isArray(response.data?.items)) {
          setCategories(response.data.items);
        } else {
          setCategories([]);
        }
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
  }, []);

  return categories;
}
