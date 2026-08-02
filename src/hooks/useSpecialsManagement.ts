'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSpecialProducts,
  setFeaturedSpecial as setFeaturedSpecialAPI,
  unsetFeaturedSpecial as unsetFeaturedSpecialAPI,
} from '@/services/productService';
import { getErrorMessage } from '@/utils/apiClient';

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
  const { t } = useTranslation();
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
      // Same reasoning as `useCategoryManagement`: `useApiError` would change identity on capture
      // and re-fire the mount effect that depends on this callback.
      const fallback = t('failed_to_load_specials', 'Failed to load special items');
      try {
        const response = (await getSpecialProducts(page, pageSize)) as {
          success: boolean;
          data?: { items: SpecialProduct[]; totalCount: number };
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
          setError(response.message || fallback);
        }
      } catch (e) {
        setError(getErrorMessage(e) ?? fallback);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, t],
  );

  useEffect(() => {
    // fetchSpecialProducts has its own try/catch (sets error state); fire-and-forget.
    void fetchSpecialProducts(1);
  }, [fetchSpecialProducts]);

  const handleSetFeaturedSpecial = async (productId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = (await setFeaturedSpecialAPI(productId)) as { success: boolean; message?: string };
      if (response.success) {
        // Refresh the list to update the featured status
        await fetchSpecialProducts(currentPage);
        // The page replaces this on success so it can interpolate the product name; the same key is
        // used here so the hook is not a source of untranslated English if it ever stops doing that.
        return { success: true, message: response.message || t('featured_special_set_success', { name: '' }) };
      } else {
        return {
          success: false,
          message: response.message || t('failed_to_set_featured_special', 'Failed to set the featured special'),
        };
      }
    } catch (e) {
      return {
        success: false,
        message: getErrorMessage(e) ?? t('failed_to_set_featured_special', 'Failed to set the featured special'),
      };
    }
  };

  const handleUnsetFeaturedSpecial = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = (await unsetFeaturedSpecialAPI()) as { success: boolean; message?: string };
      if (response.success) {
        // Refresh the list to update the featured status
        await fetchSpecialProducts(currentPage);
        return {
          success: true,
          message: response.message || t('featured_special_removed_success', 'Featured special removed successfully'),
        };
      } else {
        return {
          success: false,
          message: response.message || t('failed_to_remove_featured_special', 'Failed to remove the featured special'),
        };
      }
    } catch (e) {
      return {
        success: false,
        message: getErrorMessage(e) ?? t('failed_to_remove_featured_special', 'Failed to remove the featured special'),
      };
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
