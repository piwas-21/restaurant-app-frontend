'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getSpecialProducts,
  setFeaturedSpecial as setFeaturedSpecialAPI,
  unsetFeaturedSpecial as unsetFeaturedSpecialAPI,
} from '@/services/productService';

export interface SpecialProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  isFeaturedSpecial: boolean;
  featuredDate?: string;
  displayOrder: number;
}

export interface FeaturedSpecial {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  featuredDate: string;
}

export const useSpecialsManagement = () => {
  const [specialProducts, setSpecialProducts] = useState<SpecialProduct[]>([]);
  const [featuredSpecial, setFeaturedSpecial] = useState<SpecialProduct | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const fetchSpecialProducts = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = (await getSpecialProducts(page, pageSize)) as {
          success: boolean;
          data?: { items: any[]; totalCount: number };
          message?: string;
        };
        if (response.success && response.data) {
          setSpecialProducts(response.data.items || []);
          setTotalCount(response.data.totalCount || 0);
          setCurrentPage(page);

          // Find the featured special from the list
          const featured = response.data.items?.find((p: SpecialProduct) => p.isFeaturedSpecial);
          setFeaturedSpecial(featured || null);
        } else {
          setError(response.message || 'Failed to fetch special products');
        }
      } catch {
        setError('An unexpected error occurred while fetching special products');
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    fetchSpecialProducts(1);
  }, [fetchSpecialProducts]);

  const handleSetFeaturedSpecial = async (productId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = (await setFeaturedSpecialAPI(productId)) as { success: boolean; message?: string };
      if (response.success) {
        // Refresh the list to update the featured status
        await fetchSpecialProducts(currentPage);
        return { success: true, message: response.message || 'Featured special set successfully' };
      } else {
        return { success: false, message: response.message || 'Failed to set featured special' };
      }
    } catch {
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const handleUnsetFeaturedSpecial = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = (await unsetFeaturedSpecialAPI()) as { success: boolean; message?: string };
      if (response.success) {
        // Refresh the list to update the featured status
        await fetchSpecialProducts(currentPage);
        return { success: true, message: response.message || 'Featured special removed successfully' };
      } else {
        return { success: false, message: response.message || 'Failed to remove featured special' };
      }
    } catch {
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  return {
    specialProducts,
    featuredSpecial,
    isLoading,
    error,
    totalCount,
    currentPage,
    pageSize,
    fetchSpecialProducts,
    handleSetFeaturedSpecial,
    handleUnsetFeaturedSpecial,
  };
};
