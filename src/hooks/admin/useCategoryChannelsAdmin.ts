'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { getCategories, updateCategory } from '@/services/categoryService';
import type { Category } from '@/app/admin/menu-management/interfaces';
import { OrderType } from '@/types/order';
import { isStorableMask, maskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';
import { getErrorMessage } from '@/utils/apiClient';

/**
 * Flip one order type on one category row. Pure and module-level: inlining it left four nested
 * callbacks (useCallback → state updater → map → filter), which is both hard to read and a Sonar
 * S2004. Same shape as `useCustomerFormsAdmin`'s pure state transforms.
 */
function toggleCategoryChannel(categories: Category[], categoryId: string, orderType: OrderType): Category[] {
  return categories.map((category) => {
    if (category.id !== categoryId) return category;
    const current = orderTypesFromMask(category.availableOrderTypes);
    const next = current.includes(orderType) ? current.filter((type) => type !== orderType) : [...current, orderType];
    return { ...category, availableOrderTypes: maskFromOrderTypes(next) };
  });
}

/** Put one row back to its last-saved state, leaving every other row's edits alone. */
function restoreCategory(categories: Category[], saved: Category[], categoryId: string): Category[] {
  const original = saved.find((c) => c.id === categoryId);
  if (!original) return categories;
  return categories.map((category) => (category.id === categoryId ? { ...original } : category));
}

/**
 * State + actions for the admin "order type availability" matrix (rows = categories, columns =
 * order types). Follows the `useCustomerFormsAdmin` shape: an editable copy alongside a saved
 * snapshot for per-row dirty tracking, and one row saved at a time so an in-progress edit on
 * another row survives.
 */
/**
 * One page is fetched; see `truncated` for what happens when a catalogue outgrows it. Exported so
 * the notice can state the real number instead of repeating a literal in ten locale strings.
 */
export const CATEGORY_PAGE_SIZE = 200;

export function useCategoryChannelsAdmin() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  /**
   * True when the server holds more categories than this page fetched (§9.8). The cap is inert for
   * RUMI (~13 categories) but it is SILENT: past it, a restriction would simply be unsettable for
   * the categories that fell off, with nothing on screen to say so. Surfacing it costs one flag.
   */
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Cast at the call site, as every other getCategories caller does — the service is
        // deliberately untyped because it falls back to mockApiClient's different shape.
        const response = (await getCategories(1, CATEGORY_PAGE_SIZE)) as {
          success: boolean;
          data?: { items?: Category[]; totalCount?: number };
        };
        if (cancelled) return;
        const items: Category[] = response?.data?.items ?? [];
        setCategories(items);
        setSaved(items);
        // Compare against the server's own count rather than `items.length === PAGE_SIZE`: a
        // catalogue of exactly CATEGORY_PAGE_SIZE is complete, and warning there would cry wolf.
        setTruncated((response?.data?.totalCount ?? items.length) > items.length);
      } catch (err) {
        if (!cancelled) {
          enqueueSnackbar(getErrorMessage(err) ?? t('failed_to_load_categories', 'Failed to load categories'), {
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // MOUNT-ONLY, deliberately. `t` must NOT be a dependency: react-i18next hands back a new `t`
    // identity on a language switch (and test doubles do so on every render), which would re-run
    // this fetch and overwrite the admin's unsaved edits with server state — silently discarding
    // their work. Pinned by the "failed save leaves the row dirty" test, which caught exactly that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The order types a row currently permits (decoded from its mask; null = all). */
  const selectedTypes = useCallback(
    (category: Category): OrderType[] => orderTypesFromMask(category.availableOrderTypes),
    [],
  );

  /**
   * Toggle one order type for one category. Clearing every box is allowed as an intermediate state
   * — an admin swapping "dine-in only" for "delivery only" passes through it — but it is NOT
   * savable: the API rejects mask 0, because an item allowed on no channel renders as
   * "Available for: ." with no stateable reason. `canSave` gates the commit and the matrix says
   * why; taking a category off sale entirely is what its Active toggle is for.
   */
  const toggle = useCallback((categoryId: string, orderType: OrderType) => {
    setCategories((prev) => toggleCategoryChannel(prev, categoryId, orderType));
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

  /** Dirty AND storable — an empty selection would be rejected by the API, so Save stays disabled. */
  const canSave = useCallback(
    (categoryId: string) => {
      if (!isDirty(categoryId)) return false;
      const edited = categories.find((c) => c.id === categoryId);
      return !!edited && isStorableMask(edited.availableOrderTypes);
    },
    [categories, isDirty],
  );

  const reset = useCallback(
    (categoryId: string) => {
      setCategories((prev) => restoreCategory(prev, saved, categoryId));
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
        // echoed back or the save would blank them. displayOrder is deliberately NOT sent: the
        // handler never assigns it (ReorderCategoriesCommand owns ordering), so omitting it is
        // safe here in a way that omitting the three above — or availableOrderTypes — is not.
        await updateCategory(categoryId, {
          id: categoryId,
          name: category.name,
          description: category.description ?? undefined,
          isActive: category.isActive,
          availableOrderTypes: category.availableOrderTypes ?? null,
        });

        setSaved((prev) => prev.map((c) => (c.id === categoryId ? { ...category } : c)));
        enqueueSnackbar(t('order_types_saved', 'Order type availability saved'), { variant: 'success' });
      } catch (err) {
        enqueueSnackbar(
          getErrorMessage(err) ?? t('failed_to_save_order_types', 'Failed to save order type availability'),
          {
            variant: 'error',
          },
        );
      } finally {
        setSavingId(null);
      }
    },
    [categories, t],
  );

  return { categories, loading, savingId, truncated, selectedTypes, toggle, isDirty, canSave, reset, save };
}
