'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getOrders } from '@/services/orderService';
import { getErrorMessage } from '@/utils/apiClient';
import { OrderDto } from '@/types/order';
import { ACTIVE_STATUSES, PAST_STATUSES } from '@/constants/orderStatus';

export type OrderTab = 'active' | 'past';

const POLL_INTERVAL_MS = 30_000;
const PAST_PAGE_SIZE = 20;

export function useOrders() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [activeOrders, setActiveOrders] = useState<OrderDto[]>([]);
  const [pastOrders, setPastOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<OrderTab>('active');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Pagination for past tab
  const [pastPage, setPastPage] = useState(1);
  // Read by the quiet self-heal, which runs inside a timer created before the current `pastPage`
  // existed — a plain closure there would restore however many pages were loaded when the poll
  // was last scheduled, not now.
  const pastPageRef = useRef(1);
  pastPageRef.current = pastPage;
  const [pastHasMore, setPastHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // These two THROW. They used to swallow, each behind a comment promising the error would be
  // shown "on first load" — and it never was, because `fetchAll` awaits both and its own catch was
  // therefore unreachable. A guest whose first load failed got an empty Active tab, an empty Past
  // tab, no message and no toast: indistinguishable from having placed no orders. Deciding whether
  // a failure is worth showing belongs to the CALLER, and there are three with three answers.
  const fetchActive = useCallback(async () => {
    const result = await getOrders({ descending: true });
    const sorted = result.items
      .filter((o) => (ACTIVE_STATUSES as string[]).includes(o.status))
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    setActiveOrders(sorted);
    setLastUpdated(new Date());
  }, []);

  const fetchPast = useCallback(async (page: number, append: boolean) => {
    try {
      if (append) setIsLoadingMore(true);
      const result = await getOrders({ descending: true, page, pageSize: PAST_PAGE_SIZE });
      const pageItems = result.items
        .filter((o) => (PAST_STATUSES as string[]).includes(o.status))
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      setPastOrders((prev) => (append ? [...prev, ...pageItems] : pageItems));
      // If the filtered page is empty there is nothing more to show regardless
      // of what the backend says about hasNextPage (which reflects unfiltered totals).
      setPastHasMore(result.hasNextPage && pageItems.length > 0);
    } finally {
      if (append) setIsLoadingMore(false);
    }
  }, []);

  /**
   * Caller 1 — a full load of both tabs. `error` renders as a banner above the list
   * (orders/page.tsx), which also suppresses its "No Active Orders — place an order and it will
   * appear here" empty state while the banner is up: an empty list means "you have no orders"
   * only when we actually heard back.
   *
   * `quiet` is the self-heal path, and it exists because that suppression made a stale banner
   * permanent. `error` is cleared only here, so a first load that failed and then a poll that
   * succeeded left a customer looking at yesterday's failure with no empty state and no "Browse
   * Menu" button, forever, until they pressed Refresh. A quiet retry re-runs BOTH fetches — the
   * poll only refreshes the Active tab, so clearing the banner off its success alone would swap
   * one wrong claim for another on the Past tab.
   *
   * It re-fetches every page the reader had already loaded, not just the first. `fetchPast(1,
   * false)` REPLACES the list, and the quiet path is the one load nobody asked for: collapsing a
   * paginated Past tab back to page 1 thirty seconds after a failed refresh would move the page
   * under someone who is reading it. A manual refresh still resets to page 1 — that one the user
   * asked for.
   */
  const load = useCallback(
    async (quiet = false) => {
      const pagesToRestore = quiet ? pastPageRef.current : 1;
      try {
        if (!quiet) setIsLoading(true);
        await Promise.all([fetchActive(), fetchPast(1, false)]);
        for (let page = 2; page <= pagesToRestore; page++) {
          await fetchPast(page, true);
        }
        setPastPage(pagesToRestore);
        // Cleared on SUCCESS, not on entry: blanking the banner before knowing the answer shows a
        // recovered page for as long as the request takes, and a failed retry then re-renders it.
        setError('');
      } catch (err) {
        const msg = getErrorMessage(err) ?? t('failed_to_load_orders', 'Failed to load orders');
        setError(msg);
        // The toast is the second channel for a refresh from an already-populated page, where the
        // stale list stays up and the banner alone reads as decoration. Not on the quiet retry —
        // the user did not ask for that one, and it fires every 30s while the backend is down.
        if (!quiet) {
          enqueueSnackbar(msg, { variant: 'error', anchorOrigin: { vertical: 'bottom', horizontal: 'right' } });
        }
      } finally {
        if (!quiet) setIsLoading(false);
      }
    },
    [fetchActive, fetchPast, t, enqueueSnackbar],
  );

  const fetchAll = useCallback(() => load(), [load]);

  // Caller 2 — the 30s background poll. IGNORED ON PURPOSE, and this is the one place where that
  // is right: the user did not ask for this fetch, the list already on screen stays correct and
  // merely goes stale, and the next tick retries in 30 seconds. Surfacing it would put an error
  // toast on a page the user is reading, twice a minute, for a blip they never noticed. The bare
  // catch is also load-bearing here in a second way — `fetchActive` now throws, and an unhandled
  // rejection inside a `setTimeout` has no caller to reach.
  //
  // When a banner IS up the tick does a quiet full load instead: that is the only thing that can
  // take it back down, since `error` is cleared nowhere else.
  const errorRef = useRef('');
  errorRef.current = error;
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        try {
          await (errorRef.current ? load(true) : fetchActive());
        } catch {
          // IGNORED ON PURPOSE — see above. Stale beats a toast the user cannot act on.
        }
      }
      schedulePoll();
    }, POLL_INTERVAL_MS);
  }, [fetchActive, load]);

  useEffect(() => {
    schedulePoll();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [schedulePoll]);

  // Caller 3 — "load more". The user pressed a button, so a failure needs an answer; but the page
  // already shows the orders loaded so far, and blanking those behind `error` would be a
  // regression. Hence a toast, and `pastPage` is left where it was so the same page is retried.
  const loadMorePast = useCallback(async () => {
    const next = pastPage + 1;
    try {
      await fetchPast(next, true);
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err) ?? t('failed_to_load_orders', 'Failed to load orders'), {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      });
      return;
    }
    setPastPage(next);
  }, [pastPage, fetchPast, t, enqueueSnackbar]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  }, []);

  return {
    activeOrders,
    pastOrders,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    expandedOrderId,
    toggleExpand,
    reorderingOrderId,
    setReorderingOrderId,
    lastUpdated,
    pastHasMore,
    isLoadingMore,
    loadMorePast,
    refresh: fetchAll,
    fetchAll,
  };
}
