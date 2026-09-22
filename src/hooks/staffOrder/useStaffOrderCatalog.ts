'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapMenuProducts } from '@/components/catalog/menuProductMapper';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';
import type { Product } from '@/services/serverService';
import type { OrderType } from '@/types/order';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export interface StaffOrderCategory {
  readonly id: string;
  readonly name: string;
}

interface StaffOrderCatalogOptions {
  readonly orderType: OrderType;
  readonly includeMenus: boolean;
  readonly errorKey: string;
  readonly filterProduct?: (product: Product) => boolean;
  readonly showUnavailable?: boolean;
}

async function loadProducts(categoryId: string | null, options: StaffOrderCatalogOptions): Promise<Product[]> {
  const byId = new Map<string, Product>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= MAX_PAGES) {
    const filters = options.includeMenus ? { includeMenus: true } : undefined;
    const response = await getProducts(page, PAGE_SIZE, categoryId, filters, options.orderType);
    if (!response.success || !response.data?.items) throw new Error(response.message || 'catalog refused');
    mapMenuProducts(response.data.items).forEach((product) => byId.set(product.id, product));
    totalPages = Math.max(page, response.data.totalPages || Math.ceil(response.data.totalCount / PAGE_SIZE) || 1);
    if (totalPages > MAX_PAGES) throw new Error('catalog exceeds supported page limit');
    page += 1;
  }
  return [...byId.values()];
}

export function useStaffOrderCatalog(options: StaffOrderCatalogOptions) {
  const [categories, setCategories] = useState<StaffOrderCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    void getCategories(1, PAGE_SIZE)
      .then((response) => {
        if (!active) return;
        setCategories(
          (response.data?.items ?? [])
            .filter((category) => category.isActive)
            .map((category) => ({ id: category.id, name: category.name })),
        );
      })
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void loadProducts(selectedCategoryId, options)
      .then((loaded) => {
        if (active)
          setProducts(loaded.filter((product) => product.isActive && (options.filterProduct?.(product) ?? true)));
      })
      .catch(() => {
        if (active) {
          setProducts([]);
          setError(options.errorKey);
        }
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [options, reloadToken, selectedCategoryId]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter(
      (product) =>
        product.isAvailable &&
        (options.showUnavailable || product.availability?.canOrder !== false) &&
        (!query || product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query)),
    );
  }, [options.showUnavailable, products, searchQuery]);

  return {
    categories,
    products: filteredProducts,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry: useCallback(() => setReloadToken((token) => token + 1), []),
  };
}
