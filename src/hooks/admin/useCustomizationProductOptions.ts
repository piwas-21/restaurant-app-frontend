'use client';

import { useEffect, useState } from 'react';
import { getProducts } from '@/services/menuService';
import type { Product } from '@/app/admin/menu-management/interfaces';

export function useCustomizationProductOptions(excludedProductId: string, enabled: boolean) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getProducts(1, 500, null, { includeComponents: true })
      .then((response) => {
        if (active) setProducts(response.data.items.filter((product) => product.id !== excludedProductId));
      })
      .catch((error: unknown) => console.error('Could not load customization product options', error));
    return () => {
      active = false;
    };
  }, [enabled, excludedProductId]);

  return products;
}
