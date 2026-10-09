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
let basketChannelRecoveryRequired = false;
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
  return activeChannelWrites > 0 || snapshotNeedsRefresh || basketChannelRecoveryRequired || targetNotSelected;
}

const getRecoveryRequired = () => activeChannelWrites === 0 && (snapshotNeedsRefresh || basketChannelRecoveryRequired);

function beginChannelWrite(basket: BasketDto | null, targetOrderType: OrderType) {
  if (activeChannelWrites === 0 && snapshotNeedsRefresh && basket !== basketBeforeUnconfirmedWrite) {
    snapshotNeedsRefresh = false;
  }
  if (!snapshotNeedsRefresh) basketBeforeUnconfirmedWrite = basket;
  pendingSelectionTarget = null;
  activeChannelWrites += 1;
  snapshotNeedsRefresh = true;
  publishChannelState();

  return (basketRefreshed: boolean, applied: boolean, operationFailed: boolean) => {
    activeChannelWrites -= 1;
    if (activeChannelWrites === 0 && basketRefreshed) {
      snapshotNeedsRefresh = false;
      basketBeforeUnconfirmedWrite = null;
      pendingSelectionTarget = applied ? targetOrderType : null;
    } else if (activeChannelWrites === 0) {
      pendingSelectionTarget = null;
    }
    if (activeChannelWrites === 0) basketChannelRecoveryRequired = operationFailed || !basketRefreshed;
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

export function useBasketChannelRecoveryRequired() {
  return useSyncExternalStore(subscribeChannelState, getRecoveryRequired, () => false);
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
  let operationFailed = false;
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
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    finish(basketRefreshed, applied, operationFailed);
    releaseMutation();
  }
}

/** Re-read the canonical basket when a failed channel operation left its snapshot unconfirmed. */
export async function retryBasketChannelSnapshot(syncBasket: SyncBasket): Promise<boolean> {
  const previousMutation = channelMutationQueue;
  let releaseMutation!: () => void;
  channelMutationQueue = new Promise((resolve) => {
    releaseMutation = resolve;
  });
  await previousMutation;

  const expectedSessionId = getRequestSessionId();
  try {
    if (activeChannelWrites > 0) return false;
    const basketRefreshed = await readBasket(syncBasket, expectedSessionId);
    if (!basketRefreshed || getRequestSessionId() !== expectedSessionId || activeChannelWrites > 0) {
      basketChannelRecoveryRequired = true;
      publishChannelState();
      return false;
    }

    snapshotNeedsRefresh = false;
    basketBeforeUnconfirmedWrite = null;
    basketChannelRecoveryRequired = false;
    publishChannelState();
    return true;
  } finally {
    releaseMutation();
  }
}

function readBasket(syncBasket: SyncBasket, expectedSessionId: string | null): Promise<boolean> {
  return Promise.resolve()
    .then(() => syncBasket(expectedSessionId))
    .catch(() => false);
}
