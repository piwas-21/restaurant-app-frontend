'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProducts } from '@/services/menuService';
import {
  buildApplyPlan,
  groupProductsByCategory,
  type ApplyTargetProduct,
} from '@/components/admin/product/libraryApplyTargets';
import type { AttachResult, CatalogUsageProduct } from '@/services/libraryAttachService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';

interface Envelope<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

interface UseLibraryApplyToItemsArgs {
  /** The library row being applied. `null` closes the panel and clears everything. */
  rowId: string | null;
  /** Which products already carry this row — `GET /api/global-…/{id}/products`. */
  fetchUsage: (id: string) => Promise<Envelope<CatalogUsageProduct[]> | undefined>;
  /** The catalog-wide write. Receives the ids the plan resolved, never a category. */
  attach: (id: string, productIds: string[]) => Promise<Envelope<AttachResult> | undefined>;
  /** The name of the group holding products no category claims. */
  uncategorisedName: string;
  /** Translation keys for the two failures this hook can report. */
  messages: { loadFailed: string; attachFailed: string };
  /** Called after a successful write, so the catalog's usage count can be refreshed. */
  onAttached?: (result: AttachResult) => void;
}

/**
 * Everything behind "apply this library row to many items" (plan S8) except the arithmetic, which
 * is `libraryApplyTargets` and is pure so its counts can carry an oracle.
 *
 * **Two requests, and BOTH are needed before the panel can tell the truth.** The product list is
 * what the admin picks from; the usage list is what turns "40 selected" into "38 will change, 2
 * already have it" (plan D6). Loading only the first would give a screen that promises a change the
 * server has already decided to skip.
 *
 * The product list is fetched with a large page size ONCE per open, exactly as the two library
 * catalogs are: the live menu is 77 products, and paging a picker whose whole purpose is "select
 * every pizza" would make the catalog-wide action reach only the page on screen.
 */
export function useLibraryApplyToItems({
  rowId,
  fetchUsage,
  attach,
  uncategorisedName,
  messages,
  onAttached,
}: UseLibraryApplyToItemsArgs) {
  const [products, setProducts] = useState<ApplyTargetProduct[]>([]);
  const [alreadyAttachedIds, setAlreadyAttachedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<AttachResult | null>(null);

  useEffect(() => {
    if (!rowId) {
      setStatus('idle');
      setProducts([]);
      setSelectedIds(new Set());
      setAlreadyAttachedIds(new Set());
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const [list, usage] = await Promise.all([getProducts(1, PRODUCT_PAGE_SIZE), fetchUsage(rowId)]);
        if (cancelled) return;
        setProducts((list?.data?.items ?? []) as ApplyTargetProduct[]);
        setAlreadyAttachedIds(new Set((usage?.data ?? []).map((entry) => entry.productId)));
        setStatus('ready');
      } catch (caught) {
        if (cancelled) return;
        setError(getErrorMessage(caught) ?? null);
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [rowId, fetchUsage]);

  const groups = useMemo(() => groupProductsByCategory(products, uncategorisedName), [products, uncategorisedName]);
  const plan = useMemo(
    () => buildApplyPlan(products, selectedIds, alreadyAttachedIds),
    [products, selectedIds, alreadyAttachedIds],
  );

  /**
   * Send the PLAN's ids, not the selection.
   *
   * The plan has already dropped every product that carries the row and de-duplicated the ones
   * offered under two categories, so what is sent is exactly what the confirm sentence counted.
   */
  const save = useCallback(async () => {
    if (!rowId || plan.productIds.length === 0 || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await attach(rowId, plan.productIds);
      if (!response?.success || !response.data) {
        setError(serverMessage(response) ?? null);
        return;
      }
      setResult(response.data);
      onAttached?.(response.data);
    } catch (caught) {
      setError(getErrorMessage(caught) ?? null);
    } finally {
      setIsSaving(false);
    }
  }, [rowId, plan.productIds, isSaving, attach, onAttached]);

  return {
    status,
    /** A server or network message, already unwrapped from `errors[]`. Null means use `messages`. */
    error,
    errorKey: status === 'error' ? messages.loadFailed : messages.attachFailed,
    groups,
    products,
    selectedIds,
    setSelectedIds,
    alreadyAttachedIds,
    plan,
    isSaving,
    result,
    save,
  };
}

/**
 * One page, large enough to hold the whole menu.
 *
 * 77 products live today. This is the same trade the library pickers make — read it all once and
 * work in the browser — and it is more load-bearing here: a paged list would silently narrow
 * "select every pizza" to the pizzas on the current page, which is a wrong answer that looks right.
 */
const PRODUCT_PAGE_SIZE = 500;

export default useLibraryApplyToItems;
