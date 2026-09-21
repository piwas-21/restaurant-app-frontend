'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';
import { mapMenuProducts } from '@/components/catalog/menuProductMapper';
import { OrderType } from '@/types/order';
import type { Product } from '@/services/serverService';
import { isMenuBundle } from '@/utils/productTypeFilter';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

async function loadTakeawayProducts(categoryId: string | null): Promise<Product[]> {
  const byId = new Map<string, Product>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await getProducts(page, PAGE_SIZE, categoryId, undefined, OrderType.Takeaway);
    if (!response.success || !response.data?.items) throw new Error(response.message || 'catalog refused');
    mapMenuProducts(response.data.items).forEach((product) => byId.set(product.id, product));
    totalPages = Math.max(page, response.data.totalPages || Math.ceil(response.data.totalCount / PAGE_SIZE) || 1);
    if (totalPages > MAX_PAGES) throw new Error('catalog exceeds supported page limit');
    page += 1;
  }

  return [...byId.values()];
}

export interface ServerTakeawayCategory {
  readonly id: string;
  readonly name: string;
}

export function useServerTakeawayCatalog() {
  const [categories, setCategories] = useState<ServerTakeawayCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    void getCategories(1, 100)
      .then((response) => {
        if (!active) return;
        setCategories(
          (response.data?.items ?? [])
            .filter((category) => category.isActive)
            .map((category) => ({ id: category.id, name: category.name })),
        );
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    // Product-only is deliberate for this first Server slice; the UI names the boundary rather
    // than presenting a menu bundle as if its child selections were supported here. The API's
    // unfiltered staff list already excludes menus; keep the local guard as a second boundary.
    void loadTakeawayProducts(selectedCategoryId)
      .then((loadedProducts) => {
        if (!active) return;
        setProducts(loadedProducts.filter((product) => product.isActive && !isMenuBundle(product)));
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setError('server.takeaway.catalog_error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken, selectedCategoryId]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.isAvailable &&
        product.availability?.canOrder !== false &&
        (!query || product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query)),
    );
  }, [products, searchQuery]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    categories,
    products: filteredProducts,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry,
  };
}
