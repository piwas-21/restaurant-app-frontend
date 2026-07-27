'use client';

import { useCallback, useEffect, useRef } from 'react';
import { setBasketOrderType } from '@/services/basketChannelService';
import { OrderType } from '@/types/order';

export interface AssertBasketChannel {
  /** Record what the server has accepted (or `null` to force a re-assert). */
  markSynced: (orderType: OrderType | null) => void;
}

/**
 * Keeps the SERVER's copy of the basket channel in step with the guest's choice.
 *
 * Split out of `useOrderTypeSwitch` (which owns the guest-facing two-phase switch) because this is
 * a different job: no dialog, no consent, just "does the basket row know its channel yet".
 *
 * It exists because the switch alone cannot arm the guard. Only `AddItemToBasketAsync` calls
 * `GetOrCreateBasketAsync`, so `PUT /api/Basket/order-type` on an empty cart 404s *by construction*
 * — and a guest who picks a channel and then browses (exactly what the sidebar toggle invites)
 * would otherwise add every item to a basket still on `OrderType = null`, which
 * `BasketChannelGuard` waves through. `BasketDto` carries no `orderType`, so the client cannot read
 * back what the basket is on; hence the local record.
 *
 * @param lineCount the OPTIMISTIC cart line count — see `useOrderTypeSwitch` for why not `basket`.
 */
export function useAssertBasketChannel(lineCount: number, orderType: OrderType | null): AssertBasketChannel {
  const syncedRef = useRef<OrderType | null>(null);

  const markSynced = useCallback((next: OrderType | null) => {
    syncedRef.current = next;
  }, []);

  useEffect(() => {
    if (lineCount === 0 || !orderType || syncedRef.current === orderType) return;
    syncedRef.current = orderType;
    // Deliberately a dry run: conflicts here are not the guest's doing and must not raise a dialog
    // they did not ask for — their cart already held those lines, and `OrderChannelGuard` still
    // stops the order.
    setBasketOrderType(orderType).catch((err) => {
      // A failed assert must not be remembered as done, or the guard stays disarmed for the whole
      // session. Depending on the COUNT rather than a hasLines boolean is what lets this retry:
      // a boolean never changes again once the cart is non-empty.
      syncedRef.current = null;
      console.warn('Could not assert the basket order type after the basket appeared:', err);
    });
  }, [lineCount, orderType]);

  return { markSynced };
}
