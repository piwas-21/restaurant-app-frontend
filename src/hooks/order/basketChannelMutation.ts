'use client';

import { useSyncExternalStore } from 'react';
import { setBasketOrderType } from '@/services/basketChannelService';
import type { BasketDto } from '@/types/basket';
import type { BasketChannelSwitch } from '@/types/basketChannel';
import { OrderType } from '@/types/order';
import { getRequestSessionId } from '@/utils/apiClient';

type SyncBasket = (expectedSessionId?: string | null) => Promise<boolean>;
type BasketChannelMutationResult = { result: BasketChannelSwitch; basketRefreshed: boolean };

export class BasketChannelSessionChangedError extends Error {
  constructor() {
    super('The guest session changed during the basket channel update.');
    this.name = 'BasketChannelSessionChangedError';
  }
}

export function isBasketChannelSessionChangedError(error: unknown): error is BasketChannelSessionChangedError {
  return error instanceof BasketChannelSessionChangedError;
}

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

/** Apply the channel change and refresh only the browser session it was initiated for. */
export async function setBasketOrderTypeAndRefresh(
  orderType: OrderType,
  basket: BasketDto | null,
  syncBasket: SyncBasket,
  removeConflicts = false,
): Promise<BasketChannelMutationResult> {
  const expectedSessionId = getRequestSessionId();
  if (basket?.sessionId !== undefined && basket.sessionId !== expectedSessionId) {
    await readBasket(syncBasket, getRequestSessionId());
    throw new BasketChannelSessionChangedError();
  }

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
    if (getRequestSessionId() !== expectedSessionId) {
      basketRefreshed = await readBasket(syncBasket, getRequestSessionId());
      throw new BasketChannelSessionChangedError();
    }

    let result: BasketChannelSwitch;
    try {
      result = await setBasketOrderType(orderType, removeConflicts);
    } catch (error) {
      const sessionBeforeRefresh = getRequestSessionId();
      basketRefreshed = await readBasket(syncBasket, sessionBeforeRefresh);
      if (getRequestSessionId() !== expectedSessionId) throw new BasketChannelSessionChangedError();
      throw error;
    }

    applied = result.applied;
    const sessionBeforeRefresh = getRequestSessionId();
    basketRefreshed = await readBasket(syncBasket, sessionBeforeRefresh);
    if (getRequestSessionId() !== expectedSessionId) {
      applied = false;
      throw new BasketChannelSessionChangedError();
    }
    return { result, basketRefreshed };
  } finally {
    finish(basketRefreshed, applied);
    releaseMutation();
  }
}

function readBasket(syncBasket: SyncBasket, expectedSessionId: string | null): Promise<boolean> {
  return Promise.resolve()
    .then(() => syncBasket(expectedSessionId))
    .catch(() => false);
}
