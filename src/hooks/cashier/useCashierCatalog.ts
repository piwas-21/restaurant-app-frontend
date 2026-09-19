'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategories } from '@/services/categoryService';
import { getProducts } from '@/services/menuService';
import { mapMenuProducts } from '@/components/catalog/menuProductMapper';
import type { Product } from '@/services/serverService';

/**
 * The counter catalog, read from the SAME data services the guest menu uses — the guest's
 * `getCategories` + `getProducts` pair (cashier POS plan §5.3: no second catalog source, and
 * the till must see what the menu sees). Products only: menu parents are a bundle-parent
 * flow the counter slice deliberately does not open.
 *
 * Like the guest pipeline, one page deliberately holds a whole category (page size above any
 * single category), so the search filters everything that is actually on the shelf.
 */
const PAGE_SIZE = 200;

export interface CashierCatalogCategory {
  id: string;
  name: string;
}

export function useCashierCatalog() {
  const [categories, setCategories] = useState<CashierCatalogCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await getCategories(1, 100);
        if (!active) return;
        const items = response.data?.items ?? [];
        setCategories(
          items.filter((category) => category.isActive).map((category) => ({ id: category.id, name: category.name })),
        );
      } catch (_error) {
        // The catalog stays browsable through "all items" when categories fail, as on /menu.
        if (active) setCategories([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const response = await getProducts(1, PAGE_SIZE, selectedCategoryId);
        if (!active) return;
        if (response.success && response.data?.items) {
          setProducts(mapMenuProducts(response.data.items).filter((product) => product.isActive));
        } else {
          // The server answered, and refused: say so instead of an empty shelf.
          setError(response.message || 'catalog refused');
          setProducts([]);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'catalog failed');
        setProducts([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedCategoryId, reloadToken]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products.filter((product) => product.isAvailable);
    return products.filter(
      (product) =>
        product.isAvailable &&
        (product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query)),
    );
  }, [products, searchQuery]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    categories,
    products: filteredProducts,
    isLoading,
    error,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    retry,
  };
}

export default useCashierCatalog;
