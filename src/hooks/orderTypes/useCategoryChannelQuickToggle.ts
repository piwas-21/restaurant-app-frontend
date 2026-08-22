'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCategories, updateCategoryOrderTypes } from '@/services/categoryService';
import type { Category } from '@/app/admin/menu-management/interfaces';
import { OrderType } from '@/types/order';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import { canSetChannel, categoryChannelStatus, maskWithChannel } from '@/utils/categoryChannelStatus';
import type { CategoryChannelStatus } from '@/utils/categoryChannelStatus';
import { getErrorMessage } from '@/utils/apiClient';

/** One page, same cap and same reason as the admin matrix (§9.8). */
export const QUICK_TOGGLE_PAGE_SIZE = 200;

/**
 * The refresh contract, stated once so all three surfaces share it.
 *
 * A waiter closing Dine-In while the till still shows it open is worse than no toggle at all, so
 * the rule is: **never optimistic**. A tap writes, then re-reads, and the switch only moves when
 * the server says it moved. Between taps the other two screens converge by (a) a 30s poll that
 * runs only while the tab is visible — a backgrounded till must not poll all night — and (b) an
 * immediate re-read when the tab becomes visible or the window regains focus, which is what
 * actually happens when someone picks the device up.
 */
export const QUICK_TOGGLE_POLL_MS = 30_000;

interface Snapshot {
  categories: Category[];
  totalCount: number;
  /** When this snapshot was read, used as "now" for every age it renders. */
  fetchedAt: number;
}

const EMPTY: Snapshot = { categories: [], totalCount: 0, fetchedAt: 0 };

export interface CategoryChannelQuickToggle {
  statuses: CategoryChannelStatus[];
  /** Instant the visible snapshot was read — the `now` every age is measured against. */
  fetchedAt: number;
  loading: boolean;
  /** Load failure, already translated. `null` while the last read succeeded. */
  error: string | null;
  /** Id of the category currently being written, or `null`. */
  savingId: string | null;
  /** Active categories the server holds beyond the page that was read. */
  hiddenCount: number;
  /** Whether flipping this channel would leave the category orderable nowhere. */
  canSet: (categoryId: string, orderType: OrderType, next: boolean) => boolean;
  setChannel: (categoryId: string, orderType: OrderType, next: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * The one hook behind the pinned order-type toggle, mounted on the admin, cashier and server
 * screens. `enabled` is false for a viewer who may not write (the API is `[RequireAdmin]`), and
 * then this fetches nothing at all — a cashier's screen must not poll an endpoint on their behalf.
 */
export function useCategoryChannelQuickToggle(enabled: boolean): CategoryChannelQuickToggle {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Every state write goes through here. A poll or a save can still be in flight when the host
   * unmounts — a cashier navigating away mid-write is the ordinary case, not the exotic one — and
   * one guard in one place is the only shape in which a later branch cannot forget it.
   */
  const commit = useCallback((apply: () => void) => {
    if (mounted.current) apply();
  }, []);

  const read = useCallback(async () => {
    const response = await getCategories(1, QUICK_TOGGLE_PAGE_SIZE);
    const items: Category[] = response?.data?.items ?? [];
    // Only ACTIVE categories: an inactive one is not on sale through any channel, so offering to
    // reopen its Dine-In mid-service would be a lie. The count of what was left out is reported
    // rather than dropped, so nothing goes missing silently.
    const active = items.filter((category) => category.isActive !== false);
    commit(() =>
      setSnapshot({
        categories: active,
        totalCount: response?.data?.totalCount ?? items.length,
        fetchedAt: Date.now(),
      }),
    );
  }, [commit]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      await read();
      commit(() => setError(null));
    } catch (err) {
      commit(() => setError(getErrorMessage(err) ?? t('failed_to_load_categories', 'Failed to load categories')));
    } finally {
      commit(() => setLoading(false));
    }
    // `t` is deliberately absent: react-i18next hands back a new identity on every language switch
    // (and on every render under a test double), which would turn this into a refetch loop wired
    // to an interval. The same trap `useCategoryChannelsAdmin` documents on its mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, read, commit]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const reread = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      void refresh();
    };

    void refresh();
    const timer = setInterval(reread, QUICK_TOGGLE_POLL_MS);
    window.addEventListener('focus', reread);
    document.addEventListener('visibilitychange', reread);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', reread);
      document.removeEventListener('visibilitychange', reread);
    };
  }, [enabled, refresh]);

  const statuses = useMemo(
    () =>
      snapshot.categories.map((category) =>
        categoryChannelStatus(category, getCategoryDisplayName(category.name, t), snapshot.fetchedAt),
      ),
    [snapshot, t],
  );

  const canSet = useCallback(
    (categoryId: string, orderType: OrderType, next: boolean) => {
      const category = snapshot.categories.find((c) => c.id === categoryId);
      return !!category && canSetChannel(category.availableOrderTypes, orderType, next);
    },
    [snapshot],
  );

  const setChannel = useCallback(
    async (categoryId: string, orderType: OrderType, next: boolean) => {
      const category = snapshot.categories.find((c) => c.id === categoryId);
      if (!category || !canSetChannel(category.availableOrderTypes, orderType, next)) return;

      setSavingId(categoryId);
      try {
        await updateCategoryOrderTypes(category, maskWithChannel(category.availableOrderTypes, orderType, next));
        // Re-read rather than patch state: the switch has to show SERVER truth, and a snapshot
        // written from the request body would hide a rejected or concurrently-overwritten save.
        await read();
        commit(() => setError(null));
      } catch (err) {
        commit(() =>
          setError(getErrorMessage(err) ?? t('failed_to_save_order_types', 'Failed to save order type availability')),
        );
      } finally {
        commit(() => setSavingId(null));
      }
    },
    [snapshot, read, commit, t],
  );

  return {
    statuses,
    fetchedAt: snapshot.fetchedAt,
    loading,
    error,
    savingId,
    hiddenCount: Math.max(0, snapshot.totalCount - snapshot.categories.length),
    canSet,
    setChannel,
    refresh,
  };
}
