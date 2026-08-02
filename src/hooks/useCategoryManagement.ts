'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getCategories, deleteCategory } from '@/services/categoryService';
import { Category } from '@/app/admin/menu-management/interfaces';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * Why this holds a plain `error` string rather than `useApiError` (E9 step 3, #383).
 *
 * `useApiError` is the right shape for a surface that holds its own error — but its returned object
 * changes identity when its message changes, and `fetchCategories` is depended on by a mount
 * effect. Capturing an error would rebuild the callback, re-fire the effect, refetch, fail, and
 * capture again: an infinite retry loop against a backend that is already down. `useSetupChecklist`
 * keeps its read out of `saveError` for the same reason.
 *
 * So the read uses the other half of the E9 fix — `getErrorMessage(e) ?? t(contextual)` — which
 * surfaces the server's own sentence when it authored one and a TRANSLATED fallback when it did
 * not. That is what E9 is actually about; the hook is one delivery mechanism for it, not the goal.
 */
export const useCategoryManagement = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const fetchCategories = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);
      const fallback = t('failed_to_load_categories', 'Failed to load categories');
      try {
        const response = await getCategories(page, pageSize);
        if (response.success && response.data?.items) {
          setCategories(response.data.items);
          setTotalCount(response.data.totalCount || 0);
          setTotalPages(response.data.totalPages || 1);
          setCurrentPage(page);
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
    // `fetchCategories` handles its own errors internally — `void`
    // signals fire-and-forget. Same below in `handlePageChange`.
    void fetchCategories(1);
  }, [fetchCategories]);

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = (await deleteCategory(categoryId)) as { success: boolean; message?: string; errors?: string[] };
      if (response.success) {
        // If after deletion the current page becomes empty and it's not page 1, go to previous page.
        // Refresh is fire-and-forget — `void` matches the pattern used elsewhere in this hook.
        if (categories.length === 1 && currentPage > 1) {
          void fetchCategories(currentPage - 1);
        } else {
          void fetchCategories(currentPage); // Refresh the current page
        }
        return { success: true, message: t('category_deleted_successfully', 'Category deleted successfully') };
      } else {
        // The server's own sentence when it authored one — `errors[]` first, since it carries the
        // per-rule detail ("category has products") that `message` flattens away.
        const serverMessage = response.errors?.length ? response.errors.join(', ') : response.message;
        return {
          success: false,
          message: serverMessage || t('failed_to_delete_category', 'Failed to delete category'),
        };
      }
    } catch (e) {
      return {
        success: false,
        message: getErrorMessage(e) ?? t('delete_category_error', 'An error occurred while deleting the category'),
      };
    }
  };

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchCategories(page);
    },
    [fetchCategories],
  );

  return {
    categories,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    fetchCategories,
    handleDeleteCategory,
    handlePageChange,
  };
};
