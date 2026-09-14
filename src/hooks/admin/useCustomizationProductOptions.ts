'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/services/menuService';
import type { Product } from '@/app/admin/menu-management/interfaces';

export const CUSTOMIZATION_PRODUCT_PAGE_SIZE = 500;

export function useCustomizationProductOptions(excludedProductId: string, enabled: boolean) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setIsLoading(true);
    setHasError(false);
    void getProducts(1, CUSTOMIZATION_PRODUCT_PAGE_SIZE, null, { includeComponents: true })
      .then((response) => {
        if (active) setProducts(response.data.items.filter((product) => product.id !== excludedProductId));
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
