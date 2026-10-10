'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useSmartCheckoutRouter } from '@/hooks/checkout/useSmartCheckoutRouter';
import type { OrderType } from '@/types/order';

interface CheckoutIntent {
  basketId: string | undefined;
  orderType: OrderType;
  source: string;
  revision: number;
}

/** Page-owned intent survives the basket yielding to a details modal. Confirmation routes only
 * after React has committed the contact/address state; cancellation never submits or navigates.
 */
export function useOrderTypeCheckoutContinuation() {
  const { state: cart } = useCart();
  const { state: orderType } = useOrderType();
  const { proceedToCheckout } = useSmartCheckoutRouter();
  const intent = useRef<CheckoutIntent | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  const current = useRef({ cart, orderType });
  current.current = { cart, orderType };
  const [confirmed, setConfirmed] = useState<CheckoutIntent | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current += 1;
    };
  }, []);

  const cancel = useCallback(() => {
    revision.current += 1;
    intent.current = null;
    setConfirmed(null);
  }, []);

  const request = useCallback(
    (type: OrderType, source: string, next?: 'checkout') => {
      cancel();
      if (next === 'checkout') {
        intent.current = {
          basketId: current.current.cart.basket?.id,
          orderType: type,
          source,
          revision: revision.current,
        };
      }
    },
    [cancel],
  );

  const confirm = useCallback(() => {
    const pending = intent.current;
    intent.current = null;
    if (pending) setConfirmed(pending);
  }, []);

  useEffect(() => {
    if (!confirmed) return;
    const isCurrent = () =>
      mounted.current &&
      revision.current === confirmed.revision &&
      current.current.cart.items.length > 0 &&
      current.current.cart.basket?.id === confirmed.basketId &&
      current.current.orderType.orderType === confirmed.orderType;
    setConfirmed(null);
    if (!isCurrent()) return;
    // The router checks the same guard again after resolving a logged-in profile. A cancelled or
    // replaced basket cannot navigate on a late network response.
    void proceedToCheckout(confirmed.orderType, confirmed.source, isCurrent).catch(() => {
      // Keep the restored basket available; its explicit checkout button provides a retry.
    });
  }, [confirmed, proceedToCheckout]);

  return useMemo(() => ({ request, confirm, cancel }), [request, confirm, cancel]);
}
