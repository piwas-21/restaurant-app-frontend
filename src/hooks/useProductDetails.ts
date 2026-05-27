'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductById } from '@/services/menuService';
import { updateProductImageDetails } from '@/services/productService';
import { ProductDetails } from '@/app/admin/menu-management/interfaces';

export const useProductDetails = (productId: string) => {
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request-id guard: rapid `productId` changes can race two in-flight fetches.
  // We bump this counter on every fetch start, capture the local id, and only
  // commit state if our local id is still the latest after each await. Same
  // idiom as `usePublicMenuData`. This replaces the previous `cancelledRef`,
  // which had a race where the second effect would reset the shared flag to
  // `false` before the first fetch resolved, letting stale data overwrite the
  // fresh state.
  const requestIdRef = useRef(0);

  const fetchProductData = useCallback(async () => {
    if (!productId) return;

    const localId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const productResponse = (await getProductById(productId)) as { success: boolean; data?: any; message?: string };
      if (localId !== requestIdRef.current) return; // stale — newer fetch in flight
      if (productResponse.success && productResponse.data) {
        let productData = productResponse.data;
        // If there's only one image, ensure it's primary and has a sort order of 1
        if (productData.images && productData.images.length === 1) {
          const image = productData.images[0];
          if (!image.isPrimary || image.sortOrder !== 1) {
            await updateProductImageDetails(productId, image.id, { ...image, isPrimary: true, sortOrder: 1 });
            if (localId !== requestIdRef.current) return;
            // Refetch to get the updated data
            const updatedResponse = (await getProductById(productId)) as { success: boolean; data?: any };
            if (localId !== requestIdRef.current) return;
            if (updatedResponse.success && updatedResponse.data) {
              productData = updatedResponse.data;
            }
          }
        }
        setProduct(productData);
      } else {
        setError(productResponse.message || 'Failed to fetch product details.');
      }
    } catch {
      if (localId !== requestIdRef.current) return;
      setError('An unexpected error occurred.');
    } finally {
      if (localId === requestIdRef.current) setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // fetchProductData has its own try/catch (sets error state); fire-and-forget.
    // No cleanup needed: the requestIdRef guard inside fetchProductData ensures
    // any in-flight fetch from a previous `productId` is treated as stale once
    // the next effect run bumps the counter.
    void fetchProductData();
  }, [fetchProductData]);

  return { product, isLoading, error, fetchProductData };
};
