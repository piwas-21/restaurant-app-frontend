'use client';

import { useCallback, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import type { BasketDto } from '@/types/basket';
import { OrderType } from '@/types/order';
import {
  acknowledgeBasketChannelSelection,
  markBasketChannelSnapshotRefreshed,
  setBasketOrderTypeAndRefresh,
  useBasketChannelReconciliationPending,
} from './basketChannelMutation';

export {
  BasketChannelSessionChangedError,
  acknowledgeBasketChannelSelection,
  isBasketChannelSessionChangedError,
  markBasketChannelSnapshotRefreshed,
  releaseUncommittedBasketChannelSelection,
  setBasketOrderTypeAndRefresh,
  useBasketChannelReconciliationPending,
} from './basketChannelMutation';

type SyncBasket = (expectedSessionId?: string | null) => Promise<boolean>;

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
      .catch((error) => {
        // Keep this target bounded to one attempt until the canonical basket meaningfully changes.
        console.warn('Could not assert the basket order type after the basket appeared:', error);
      });
  }, [basket, channelWritePending, orderType, purchaseFingerprint, serverOrderType, syncedLineCount, syncBasket]);

  return { markAttempted };
}
