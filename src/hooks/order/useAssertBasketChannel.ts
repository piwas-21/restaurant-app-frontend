'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { trackEvent } from '@/lib/analytics';
import { setBasketOrderType } from '@/services/basketChannelService';
import type { BasketDto } from '@/types/basket';
import type { BasketChannelSwitch } from '@/types/basketChannel';
import { OrderType } from '@/types/order';

type SyncBasket = () => Promise<boolean>;

let activeChannelWrites = 0;
let snapshotNeedsRefresh = false;
let basketBeforeUnconfirmedWrite: BasketDto | null = null;
let pendingSelectionTarget: OrderType | null = null;
let channelMutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function publishChannelState() {
  listeners.forEach((listener) => listener());
}

function subscribeChannelState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getChannelState(orderType: OrderType | null) {
  const targetNotSelected = pendingSelectionTarget !== null && pendingSelectionTarget !== orderType;
  return activeChannelWrites > 0 || snapshotNeedsRefresh || targetNotSelected;
}

function beginChannelWrite(basket: BasketDto | null, targetOrderType: OrderType) {
  if (activeChannelWrites === 0 && snapshotNeedsRefresh && basket !== basketBeforeUnconfirmedWrite) {
    snapshotNeedsRefresh = false;
  }
  if (!snapshotNeedsRefresh) basketBeforeUnconfirmedWrite = basket;
  pendingSelectionTarget = null;
  activeChannelWrites += 1;
  snapshotNeedsRefresh = true;
  publishChannelState();

  let finished = false;
  return (basketRefreshed: boolean, applied: boolean) => {
    if (finished) return;
    finished = true;
    activeChannelWrites -= 1;
    if (activeChannelWrites === 0 && basketRefreshed) {
      snapshotNeedsRefresh = false;
      basketBeforeUnconfirmedWrite = null;
      pendingSelectionTarget = applied ? targetOrderType : null;
    } else if (activeChannelWrites === 0) {
      pendingSelectionTarget = null;
    }
    publishChannelState();
  };
}

export function markBasketChannelSnapshotRefreshed(basket: BasketDto | null) {
  if (activeChannelWrites > 0) return;
  let changed = false;
  if (snapshotNeedsRefresh && basket !== basketBeforeUnconfirmedWrite) {
    snapshotNeedsRefresh = false;
    basketBeforeUnconfirmedWrite = null;
    changed = true;
  }
  if (pendingSelectionTarget !== null && basket?.orderType !== pendingSelectionTarget) {
    pendingSelectionTarget = null;
    changed = true;
  }
  if (changed) publishChannelState();
}

export function useBasketChannelReconciliationPending(orderType: OrderType | null) {
  return useSyncExternalStore(
    subscribeChannelState,
    () => getChannelState(orderType),
    () => false,
  );
}

export function acknowledgeBasketChannelSelection(orderType: OrderType | null) {
  if (activeChannelWrites > 0 || !orderType || pendingSelectionTarget !== orderType) return;
  pendingSelectionTarget = null;
  publishChannelState();
}

export function releaseUncommittedBasketChannelSelection(orderType: OrderType | null) {
  if (activeChannelWrites > 0 || pendingSelectionTarget === null || pendingSelectionTarget === orderType) return;
  pendingSelectionTarget = null;
  publishChannelState();
}

type BasketChannelMutationResult = {
  result: BasketChannelSwitch;
  basketRefreshed: boolean;
};

/** Apply the channel mutation and reconcile the CartContext from the canonical GET response. */
export async function setBasketOrderTypeAndRefresh(
  orderType: OrderType,
  basket: BasketDto | null,
  syncBasket: SyncBasket,
  removeConflicts = false,
): Promise<BasketChannelMutationResult> {
  const previousMutation = channelMutationQueue;
  let releaseMutation!: () => void;
  channelMutationQueue = new Promise((resolve) => {
    releaseMutation = resolve;
  });
  const finish = beginChannelWrite(basket, orderType);
  let basketRefreshed = false;
  let applied = false;
  try {
    await previousMutation;
    let result: BasketChannelSwitch;
    try {
      result = await setBasketOrderType(orderType, removeConflicts);
    } catch (error) {
      basketRefreshed = await readBasket(syncBasket);
      throw error;
    }
    applied = result.applied;
    basketRefreshed = await readBasket(syncBasket);
    return { result, basketRefreshed };
  } finally {
    finish(basketRefreshed, applied);
    releaseMutation();
  }
}

function readBasket(syncBasket: SyncBasket): Promise<boolean> {
  return Promise.resolve()
    .then(syncBasket)
    .catch(() => false);
}

export interface AssertBasketChannel {
  markAttempted: (orderType: OrderType | null) => void;
}

export function useAssertBasketChannel(
  basket: BasketDto | null,
  orderType: OrderType | null,
  syncBasket: SyncBasket,
): AssertBasketChannel {
  const channelWritePending = useBasketChannelReconciliationPending(orderType);
  const attemptedRef = useRef<OrderType | null>(null);
  const lastLineCountRef = useRef(basket?.items.length ?? 0);
  const lastFingerprintRef = useRef(basket?.purchaseFingerprint);
  const markAttempted = useCallback((next: OrderType | null) => {
    attemptedRef.current = next;
  }, []);

  const syncedLineCount = basket?.items.length ?? 0;
  const serverOrderType = basket?.orderType ?? null;
  const purchaseFingerprint = basket?.purchaseFingerprint;

  useEffect(() => {
    markBasketChannelSnapshotRefreshed(basket);
    acknowledgeBasketChannelSelection(orderType);
    if (channelWritePending) return;

    if (lastLineCountRef.current !== syncedLineCount || lastFingerprintRef.current !== purchaseFingerprint) {
      lastLineCountRef.current = syncedLineCount;
      lastFingerprintRef.current = purchaseFingerprint;
      attemptedRef.current = null;
    }

    if (syncedLineCount === 0 || !orderType) return;
    if (serverOrderType === orderType) {
      attemptedRef.current = null;
      return;
    }
    if (attemptedRef.current === orderType) return;

    attemptedRef.current = orderType;
    void setBasketOrderTypeAndRefresh(orderType, basket, syncBasket)
      .then(({ result, basketRefreshed }) => {
        if (!result.applied) {
          console.warn('The basket kept its previous channel: some lines are not available on', orderType);
          trackEvent('basket_channel_assert_refused', { orderType, itemCount: syncedLineCount });
        }
        if (!basketRefreshed) {
          console.warn('Could not refresh the basket after asserting its order type.');
        }
      })
      .catch((err) => {
        // Keep this target bounded to one attempt until the canonical basket meaningfully changes.
        console.warn('Could not assert the basket order type after the basket appeared:', err);
      });
  }, [basket, channelWritePending, orderType, purchaseFingerprint, serverOrderType, syncedLineCount, syncBasket]);

  return { markAttempted };
}
