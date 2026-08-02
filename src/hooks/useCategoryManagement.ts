'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getCategories, deleteCategory } from '@/services/categoryService';
import { Category } from '@/app/admin/menu-management/interfaces';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * Why this holds a plain `error` string rather than `useApiError` (E9 step 3, #383).
 *
 * `useApiError` returns a memoised object whose identity changes when its message changes, and
 * `fetchCategories` is depended on by a mount effect — so capturing the WHOLE object into this
 * callback's deps would rebuild it, re-fire the effect, refetch, fail, and capture again.
 * (`capture` alone is `useCallback(…, [])` and would be safe; the object is not.)
 * `useSetupChecklist` keeps its read out of `saveError` for the same reason.
 *
 * So the read uses the other half of the E9 fix — `getErrorMessage(e) ?? t(contextual)`.
 *
 * **`t` is read through a ref, not listed as a dependency.** It IS stable across re-renders
 * (react-i18next caches it), but it changes identity on `languageChanged` — and the language
 * switcher sits in the shared admin chrome. Listing it would rebuild this callback on a language
 * switch, re-fire the effect, and refetch AT PAGE 1: an admin on page 4 would silently lose their
 * place. The ref keeps the callback's identity tied to its real inputs.
 *
 * **What the fallback actually covers.** Less than it looks like: `apiClient.request` never lets a
 * message-less `ApiError` out — it manufactures an English sentence for a network failure, a
 * non-JSON body, and a status with no `message`. So `getErrorMessage` almost always returns
 * something and the translated fallback fires only when the server sends a blank message. Fixing
 * that belongs in `apiClient`, not here (frontend #401).
 */
export const useCategoryManagement = () => {
  const { t } = useTranslation();
  // Latest-`t` ref — see the header. Initialised from the first render, so it is never stale.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
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
      const fallback = () => tRef.current('failed_to_load_categories', 'Failed to load categories');
      try {
        const response = await getCategories(page, pageSize);
        if (response.success && response.data?.items) {
          setCategories(response.data.items);
          setTotalCount(response.data.totalCount || 0);
          setTotalPages(response.data.totalPages || 1);
          setCurrentPage(page);
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
        // per-rule detail ("category has products") that `message` flattens away. Blank entries are
        // dropped for the same reason `getErrorMessage` drops them: `['', 'x']` would render ", x".
        const detail = response.errors?.filter((m) => m?.trim()).join(', ');
        const serverMessage = detail || response.message;
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
