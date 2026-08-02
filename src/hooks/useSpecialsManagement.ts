'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

/**
 * The server's own sentence off a `{success:false}` body, or `null` when it authored none.
 * `errors[]` first — it carries the per-rule detail that `message` flattens away — and blanks are
 * dropped, matching `getErrorMessage`'s handling of the thrown shape.
 */
function serverMessage(response: { message?: string; errors?: string[] }): string | null {
  const detail = response.errors?.filter((m) => m?.trim()).join(', ');
  return detail || response.message?.trim() || null;
}

export interface FeaturedSpecial {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  imageUrl?: string;
  featuredDate: string;
}

/**
 * `error` is a plain string and `t` is read through a ref — see `useCategoryManagement`'s header
 * for both, including why listing `t` would refetch page 1 on a language switch.
 */
export const useSpecialsManagement = () => {
  const { t } = useTranslation();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
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
      const fallback = () => tRef.current('failed_to_load_specials', 'Failed to load special items');
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
          setError(response.message || fallback());
        }
      } catch (e) {
        setError(getErrorMessage(e) ?? fallback());
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    // fetchSpecialProducts has its own try/catch (sets error state); fire-and-forget.
    void fetchSpecialProducts(1);
  }, [fetchSpecialProducts]);

  const handleSetFeaturedSpecial = async (productId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = (await setFeaturedSpecialAPI(productId)) as {
        success: boolean;
        message?: string;
        errors?: string[];
      };
      if (response.success) {
        // Refresh the list to update the featured status
        await fetchSpecialProducts(currentPage);
        // The page overrides this on success so it can interpolate the product name
        // (`featured_special_set_success` takes a `{{name}}`). This one deliberately does NOT
        // interpolate: the hook has no name to pass, and a key with an unfilled placeholder is
        // worse than a plainer sentence.
        return { success: true, message: response.message || t('featured_special_updated') };
      } else {
        return {
          success: false,
          message: serverMessage(response) ?? t('failed_to_set_featured_special', 'Failed to set the featured special'),
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
      const response = (await unsetFeaturedSpecialAPI()) as { success: boolean; message?: string; errors?: string[] };
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
          message:
            serverMessage(response) ?? t('failed_to_remove_featured_special', 'Failed to remove the featured special'),
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
