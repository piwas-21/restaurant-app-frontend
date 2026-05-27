'use client';

import { useCallback, useState } from 'react';
import { getProducts, getPublicMenuBundles } from '@/services/menuService';
import type { MenuBundleItem, MenuItem } from '@/types/menu';
import { ALL_ITEMS_KEY } from './constants';
import { isVisible, mapBundleDtoToMenuBundleItem, mapProductDtoToMenuItem } from './mappers';
import type { MenuBundleListResponse, ProductListResponse } from './types';

const PAGE_SIZE = 10;

/** Extract a human error message from an unknown thrown value. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return fallback;
}

export interface UsePublicMenuDataReturn {
  items: MenuItem[];
  menuBundles: MenuBundleItem[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  fetchProducts: (page: number, categoryId: string | typeof ALL_ITEMS_KEY | null) => Promise<void>;
  fetchMenuBundles: (page: number) => Promise<void>;
}

/**
 * Owns the paginated product + bundle state for the public menu.
 * Mapping is delegated to `./mappers` so this file stays focused on
 * loading orchestration (state + error handling + pagination metadata).
 */
export function usePublicMenuData(): UsePublicMenuDataReturn {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuBundles, setMenuBundles] = useState<MenuBundleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = useCallback(async (page: number, categoryId: string | typeof ALL_ITEMS_KEY | null) => {
    setIsLoading(true);
    setError(null);
    setItems([]);
    try {
      const catId = categoryId === ALL_ITEMS_KEY ? null : categoryId;
      const response = (await getProducts(page, PAGE_SIZE, catId || undefined)) as ProductListResponse;
      if (!response.success) throw new Error(response.message || 'Failed to fetch products');

      setTotalPages(response.data?.totalPages || 1);
      setTotalCount(response.data?.totalCount || 0);
      setCurrentPage(page);

      const mapped = (response.data?.items || []).map((p) => mapProductDtoToMenuItem(p, catId || undefined));
      setItems(mapped.filter(isVisible));
    } catch (e: unknown) {
      console.error('Failed to fetch products', e);
      setError(errorMessage(e, 'Failed to fetch products'));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMenuBundles = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    setMenuBundles([]);
    try {
      const response = (await getPublicMenuBundles(page, PAGE_SIZE)) as MenuBundleListResponse;
      if (!response.success) throw new Error(response.message || 'Failed to fetch menu bundles');

      setTotalPages(response.data?.totalPages || 1);
      setTotalCount(response.data?.totalCount || 0);
      setCurrentPage(page);

      const mapped = (response.data?.items || []).map(mapBundleDtoToMenuBundleItem);
      setMenuBundles(mapped.filter(isVisible));
    } catch (e: unknown) {
      console.error('Failed to fetch menu bundles', e);
      setError(errorMessage(e, 'Failed to fetch menu bundles'));
      setMenuBundles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    items,
    menuBundles,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize: PAGE_SIZE,
    fetchProducts,
    fetchMenuBundles,
  };
}
