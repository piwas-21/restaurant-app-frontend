'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/services/menuService';
import type { Product } from '@/app/admin/menu-management/interfaces';

export function useCustomizationProductOptions(excludedProductId: string, enabled: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setIsLoading(true);
    setHasError(false);
    void loadAllCustomizationProducts()
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
  }, [enabled, excludedProductId]);

  return { products, isLoading, hasError };
}

export async function loadAllCustomizationProducts(): Promise<Product[]> {
  const first = await getProducts(undefined, undefined, null, { includeComponents: true });
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, first.data.totalPages - 1) }, (_, index) =>
      getProducts(index + 2, first.data.pageSize, null, { includeComponents: true }),
    ),
  );
  return [first, ...remaining].flatMap((response) => response.data.items);
}
