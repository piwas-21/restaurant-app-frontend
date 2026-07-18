'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getProducts } from '@/services/menuService';
import { getCategories } from '@/services/categoryService';
import { Product, Category } from '@/app/admin/menu-management/interfaces';
import { MenuTypeFilter, toProductTypeQuery } from '@/utils/productTypeFilter';

export const useMenuManagement = (typeFilter: MenuTypeFilter = 'all') => {
  const _router = useRouter();
  const searchParams = useSearchParams();
  const initialCategoryId = searchParams.get('categoryId');
  const typeFilterRef = useRef(typeFilter);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchProducts = useCallback(
    async (page: number = 1) => {
      const requestFilter = typeFilter; // Capture which filter this request is for
      setIsLoading(true);
      setError(null);
      try {
        // One endpoint for all three chips, so paging + the category filter behave
        // identically across them (the old tabs hit two endpoints with independent
        // pagination, which is why "All" was not expressible — backend #189).
        const response = await getProducts(page, pageSize, selectedCategoryId, toProductTypeQuery(typeFilter));

        // Only update state if we're still on the same filter (check against ref)
        if (requestFilter === typeFilterRef.current) {
          if (response.success) {
            setProducts(response.data.items);
            setTotalPages(response.data.totalPages || 1);
            setTotalCount(response.data.totalCount || 0);
            setCurrentPage(page);
          } else {
            setError(response.message || 'Failed to fetch items');
          }
        }
      } catch {
        if (requestFilter === typeFilterRef.current) {
          setError('An unexpected error occurred.');
        }
      } finally {
        if (requestFilter === typeFilterRef.current) {
          setIsLoading(false);
        }
      }
    },
    [typeFilter, selectedCategoryId, pageSize],
  );

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch all categories for dropdown
        const response = (await getCategories(1, 100)) as { success: boolean; data?: { items: any[] } };
        if (response.success && response.data?.items && Array.isArray(response.data.items)) {
          setCategories(response.data.items);
        }
      } catch {
        // Silently fail - categories will remain empty
      }
    };
    // Internal try/catch absorbs errors — `void` for fire-and-forget.
    // Same below for `fetchProducts` calls.
    void fetchCategories();
  }, []);

  // Fetch when the type filter or category changes
  useEffect(() => {
    typeFilterRef.current = typeFilter; // Update ref so a stale in-flight response is dropped
    // Reset to page 1 when the filter OR category changes — the old page number is
    // meaningless against a different result set.
    setCurrentPage(1);
    void fetchProducts(1);
  }, [typeFilter, selectedCategoryId, fetchProducts]);

  // Clear the category when the type chip changes.
  //
  // The old Bundles TAB hid the category select and ignored the param entirely
  // (`MenusController` hardcoded `null` into `GetMenuBundlesQuery`), so bundles were
  // never category-filtered. One endpoint now applies CategoryId to every type, and a
  // bundle's `CategoryIds` is optional — so carrying a category across a chip switch
  // would silently empty the list for uncategorized bundles, with the deep link this
  // page already supports (`?categoryId=`) landing straight in it. Clearing keeps a
  // chip switch showing the chip's contents; the category is then re-applied by choice.
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false; // Honour a ?categoryId= deep link on load
      return;
    }
    setSelectedCategoryId(null);
  }, [typeFilter]);

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = event.target.value;
    setSelectedCategoryId(categoryId === 'all' ? null : categoryId);
    // Removed router.push which was clearing params/state unnecessarily
  };

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchProducts(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [fetchProducts],
  );

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
