'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCategories, deleteCategory } from '@/services/categoryService';
import { Category } from '@/app/admin/menu-management/interfaces';

export const useCategoryManagement = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCategories() as { success: boolean; data?: { items: any[] }; message?: string };
      if (response.success && response.data?.items) {
        setCategories(response.data.items);
      } else {
        setError(response.message || 'Failed to fetch categories');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const response = await deleteCategory(categoryId) as { success: boolean; message?: string; errors?: string[] };
      if (response.success) {
        fetchCategories(); // Refresh the list
        return { success: true, message: 'category_deleted_successfully' };
      } else {
        const errorMessage = response.errors ? response.errors.join(', ') : response.message;
        return { success: false, message: errorMessage || 'failed_to_delete_category' };
      }
    } catch {
      return { success: false, message: 'delete_category_error' };
    }
  };

  return {
    categories,
    isLoading,
    error,
    fetchCategories,
    handleDeleteCategory,
  };
};
