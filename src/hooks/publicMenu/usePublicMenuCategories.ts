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
    const init = async () => {
      try {
        const response = (await getCategories(1, 100)) as CategoryListResponse;
        if (response.success && Array.isArray(response.data?.items)) {
          setCategories(response.data.items);
        } else {
          setCategories([]);
        }
      } catch (e) {
        console.error('Failed to load categories', e);
        setCategories([]);
      }
    };
    // `init` handles its own errors internally — `void` signals
    // intentional fire-and-forget.
    void init();
  }, []);

  return categories;
}
