'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getProducts, getMenuBundles } from '@/services/menuService';
import { getCategories } from '@/services/categoryService';
import { Product, Category } from '@/app/admin/menu-management/interfaces';

export const useMenuManagement = (activeTab: 'products' | 'menus' = 'products') => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryId = searchParams.get('categoryId');
  const activeTabRef = useRef(activeTab);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchProducts = useCallback(async (page: number = 1) => {
    const requestTab = activeTab; // Capture which tab this request is for
    setIsLoading(true);
    setError(null);
    try {
      let response: any;
      if (activeTab === 'menus') {
        // Use dedicated endpoint for menu bundles (category-free)
        console.log('[useMenuManagement] Calling getMenuBundles API');
        response = await getMenuBundles(page, pageSize);
        console.log('[useMenuManagement] getMenuBundles response:', response);
      } else {
        // Use generic products endpoint (backend now excludes menus by default)
        console.log('[useMenuManagement] Calling getProducts API');
        response = await getProducts(page, pageSize, selectedCategoryId);
        console.log('[useMenuManagement] getProducts response:', response);
      }

      // Only update state if we're still on the same tab (check against ref)
      if (requestTab === activeTabRef.current) {
        if (response.success) {
          setProducts(response.data.items);
          setTotalPages(response.data.totalPages || 1);
          setTotalCount(response.data.totalCount || 0);
          setCurrentPage(page);
        } else {
          setError(response.message || 'Failed to fetch items');
        }
      } else {
        console.log('[useMenuManagement] Ignoring stale response from', requestTab, 'tab, current tab is', activeTabRef.current);
      }
    } catch {
      if (requestTab === activeTabRef.current) {
        setError('An unexpected error occurred.');
      }
    } finally {
      if (requestTab === activeTabRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeTab, selectedCategoryId, pageSize]); // selectedCategoryId only affects products tab

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch all categories for dropdown
        const response = await getCategories(1, 100) as { success: boolean; data?: { items: any[] } };
        if (response.success && response.data?.items && Array.isArray(response.data.items)) {
          setCategories(response.data.items);
        }
      } catch {
        // Silently fail - categories will remain empty
      }
    };
    fetchCategories();
  }, []);

  // Clear products immediately when tab changes to prevent showing stale data
  useEffect(() => {
    activeTabRef.current = activeTab; // Update ref to current tab
    setProducts([]);
    setCurrentPage(1);
    fetchProducts(1);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = event.target.value;
    setSelectedCategoryId(categoryId === 'all' ? null : categoryId);
    setCurrentPage(1);
    router.push('/admin/menu-management');
  };

  const handlePageChange = (page: number) => {
    fetchProducts(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    products,
    categories,
    selectedCategoryId,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    handleCategoryChange,
    handlePageChange,
    fetchProducts: (page?: number) => fetchProducts(page || currentPage),
  };
};
