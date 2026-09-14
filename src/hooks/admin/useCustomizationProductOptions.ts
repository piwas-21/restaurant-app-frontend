'use client';

import { useEffect, useState } from 'react';
import { searchProducts } from '@/services/productService';
import type { Product } from '@/app/admin/menu-management/interfaces';

export function useCustomizationProductOptions(excludedProductId: string, enabled: boolean, query: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setIsLoading(true);
    setHasError(false);
    void loadCustomizationProducts(query)
      .then((loaded) => {
        if (active) setProducts(loaded.filter((product) => product.id !== excludedProductId));
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, excludedProductId, query]);

  return { products, isLoading, hasError };
}

export async function loadCustomizationProducts(query: string): Promise<Product[]> {
  const response = await searchProducts(query, { includeComponents: true });
  if (!response.success) throw new Error(response.message || 'Product search failed');
  return response.data?.items ?? [];
}
