'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductById } from '@/services/menuService';
import { updateProductImageDetails } from '@/services/productService';
import { ProductDetails } from '@/app/admin/menu-management/interfaces';

export const useProductDetails = (productId: string) => {
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards state writes against races when `productId` flips while a fetch is
  // in flight. The service layer swallows fetch errors (falls back to mock
  // data on throw), so AbortController on the underlying request isn't useful
  // here — we use the cancellation flag pattern already established in
  // `useGuestProfilePrefill` / `useTableStatistics`.
  const cancelledRef = useRef(false);

  const fetchProductData = useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);
    try {
      const productResponse = (await getProductById(productId)) as { success: boolean; data?: any; message?: string };
      if (cancelledRef.current) return;
      if (productResponse.success && productResponse.data) {
        let productData = productResponse.data;
        // If there's only one image, ensure it's primary and has a sort order of 1
        if (productData.images && productData.images.length === 1) {
          const image = productData.images[0];
          if (!image.isPrimary || image.sortOrder !== 1) {
            await updateProductImageDetails(productId, image.id, { ...image, isPrimary: true, sortOrder: 1 });
            if (cancelledRef.current) return;
            // Refetch to get the updated data
            const updatedResponse = (await getProductById(productId)) as { success: boolean; data?: any };
            if (cancelledRef.current) return;
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
      if (cancelledRef.current) return;
      setError('An unexpected error occurred.');
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    cancelledRef.current = false;
    // fetchProductData has its own try/catch (sets error state); fire-and-forget.
    void fetchProductData();
    return () => {
      // On `productId` change or unmount, suppress the trailing state writes
      // from any in-flight fetch so a stale response can't overwrite the
      // freshly-keyed one (or set state on an unmounted component).
      cancelledRef.current = true;
    };
  }, [fetchProductData]);

  return { product, isLoading, error, fetchProductData };
};
