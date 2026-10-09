'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BasketDto } from '@/types/basket';
import { OrderType } from '@/types/order';
import { routeApiError } from '@/utils/apiFormErrors';
import {
  retryBasketChannelSnapshot,
  setBasketOrderTypeAndRefresh,
  useBasketChannelRecoveryRequired,
  useBasketChannelReconciliationPending,
} from './useAssertBasketChannel';

type SyncBasket = (expectedSessionId?: string | null) => Promise<boolean>;

export function useBasketChannelRecovery(
  basket: BasketDto | null,
  orderType: OrderType | null,
  syncBasket: SyncBasket,
) {
  const recoveryRequired = useBasketChannelRecoveryRequired();
  const reconciliationPending = useBasketChannelReconciliationPending(orderType);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const retryingRef = useRef(false);
  const previousOrderTypeRef = useRef(orderType);
  const basketChannelMismatch = Boolean(
    orderType && (basket?.items.length ?? 0) > 0 && basket?.orderType !== orderType,
  );

  useEffect(() => {
    if (previousOrderTypeRef.current === orderType) return;
    previousOrderTypeRef.current = orderType;
    setRetryFailed(false);
    setErrorMessage(null);
  }, [orderType]);

  useEffect(() => {
    if (!recoveryRequired && !basketChannelMismatch && !isRetrying) {
      setRetryFailed(false);
      setErrorMessage(null);
    }
  }, [basketChannelMismatch, isRetrying, recoveryRequired]);

  const retry = useCallback(async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setIsRetrying(true);
    setRetryFailed(false);
    setErrorMessage(null);
    try {
      if (orderType) {
        const { result, basketRefreshed } = await setBasketOrderTypeAndRefresh(orderType, basket, syncBasket);
        if (!result.applied || !basketRefreshed) throw new Error('The basket channel was not confirmed.');
      } else if (!(await retryBasketChannelSnapshot(syncBasket))) {
        throw new Error('The basket snapshot could not be refreshed.');
      }
    } catch (error) {
      setErrorMessage(routeApiError(error).rootMessage);
      setRetryFailed(true);
    } finally {
      retryingRef.current = false;
      setIsRetrying(false);
    }
  }, [basket, orderType, syncBasket]);

  return {
    isPending: reconciliationPending || basketChannelMismatch || isRetrying || retryFailed,
    isVisible: recoveryRequired || retryFailed || (basketChannelMismatch && !reconciliationPending),
    isRetrying,
    errorMessage,
    retry,
  };
}
