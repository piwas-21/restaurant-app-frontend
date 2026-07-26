'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { getCategories, updateCategory } from '@/services/categoryService';
import type { Category } from '@/app/admin/menu-management/interfaces';
import { OrderType } from '@/types/order';
import { maskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';

/**
 * State + actions for the admin "order type availability" matrix (rows = categories, columns =
 * order types). Follows the `useCustomerFormsAdmin` shape: an editable copy alongside a saved
 * snapshot for per-row dirty tracking, and one row saved at a time so an in-progress edit on
 * another row survives.
 */
export function useCategoryChannelsAdmin() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Cast at the call site, as every other getCategories caller does — the service is
        // deliberately untyped because it falls back to mockApiClient's different shape.
        const response = (await getCategories(1, 200)) as { success: boolean; data?: { items?: Category[] } };
        if (cancelled) return;
        const items: Category[] = response?.data?.items ?? [];
        setCategories(items);
        setSaved(items);
      } catch {
        if (!cancelled) {
          enqueueSnackbar(t('failed_to_load_categories', 'Failed to load categories'), { variant: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  /** The order types a row currently permits (decoded from its mask; null = all). */
  const selectedTypes = useCallback(
    (category: Category): OrderType[] => orderTypesFromMask(category.availableOrderTypes),
    [],
  );

  /**
   * Toggle one order type for one category. Deliberately allows clearing every box (mask 0 =
   * available on no channel): it is a legitimate way to take a whole category off sale, and the
   * matrix warns about it rather than silently refusing.
   */
  const toggle = useCallback((categoryId: string, orderType: OrderType) => {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        const current = orderTypesFromMask(category.availableOrderTypes);
        const next = current.includes(orderType)
          ? current.filter((type) => type !== orderType)
          : [...current, orderType];
        return { ...category, availableOrderTypes: maskFromOrderTypes(next) };
      }),
    );
  }, []);

  const isDirty = useCallback(
    (categoryId: string) => {
      const edited = categories.find((c) => c.id === categoryId);
      const original = saved.find((c) => c.id === categoryId);
      if (!edited || !original) return false;
      // Compare normalised masks so "all three ticked" (null) never reads as different from null.
      return (
        maskFromOrderTypes(orderTypesFromMask(edited.availableOrderTypes)) !==
        maskFromOrderTypes(orderTypesFromMask(original.availableOrderTypes))
      );
    },
    [categories, saved],
  );

  const reset = useCallback(
    (categoryId: string) => {
      setCategories((prev) =>
        prev.map((category) => {
          const original = saved.find((c) => c.id === categoryId);
          return category.id === categoryId && original ? { ...original } : category;
        }),
      );
    },
    [saved],
  );

  const save = useCallback(
    async (categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) return;

      setSavingId(categoryId);
      try {
        // The update command reassigns name/description/isActive unconditionally, so they must be
        // echoed back or the save would blank them. displayOrder is accepted but ignored by the
        // handler (ReorderCategoriesCommand owns ordering) — sent for schema completeness only.
        await updateCategory(categoryId, {
          id: categoryId,
          name: category.name,
          description: category.description ?? undefined,
          isActive: category.isActive,
          availableOrderTypes: category.availableOrderTypes ?? null,
        });

        setSaved((prev) => prev.map((c) => (c.id === categoryId ? { ...category } : c)));
        enqueueSnackbar(t('order_types_saved', 'Order type availability saved'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('failed_to_save_order_types', 'Failed to save order type availability'), {
          variant: 'error',
        });
      } finally {
        setSavingId(null);
      }
    },
    [categories, t],
  );

  return { categories, loading, savingId, selectedTypes, toggle, isDirty, reset, save };
}
