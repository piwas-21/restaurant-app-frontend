'use client';

import { useCallback, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { setBasketOrderType } from '@/services/basketChannelService';
import { OrderType } from '@/types/order';

export interface AssertBasketChannel {
  /**
   * Record that a channel has been SENT to the server (or `null` to force a fresh attempt).
   *
   * Deliberately "attempted", not "accepted" — the caller cannot know the server took it any better
   * than this hook can. It exists so a switch the caller has just sent is not immediately repeated:
   * the echoed basket does not reach `serverOrderType` until the next sync, so agreement is not yet
   * observable at that moment.
   */
  markAttempted: (orderType: OrderType | null) => void;
}

/**
 * Keeps the SERVER's copy of the basket channel in step with the guest's choice.
 *
 * Split out of `useOrderTypeSwitch` (which owns the guest-facing two-phase switch) because this is
 * a different job: no dialog, no consent, just "does the basket row know its channel yet".
 *
 * It exists because the switch alone cannot arm the guard. A guest who picks a channel and then
 * browses — exactly what the sidebar toggle invites — would otherwise add every item to a basket
 * still on `OrderType = null`, which `BasketChannelGuard` waves through.
 *
 * **Since §9.13 this RECONCILES rather than asserts.** `BasketDto.orderType` puts the server's own
 * answer on the wire, so the loop closes: when the two agree there is nothing to send, and when they
 * disagree the client knows it — where before, the only record was a local ref that could not tell
 * "the server took it" from "the server refused it because of a conflicting line". A refused assert
 * was remembered as done and the guard stayed disarmed for the whole session.
 *
 * @param syncedLineCount how many lines the last SYNCED basket had — deliberately NOT the optimistic
 *   count `useOrderTypeSwitch` uses for its conflict check. The count and `serverOrderType` have to
 *   come off the same clock: an optimistic count moves while the mutation is still in flight, so a
 *   retry triggered by it can reach the server BEFORE the change that would let it succeed.
 * @param orderType the guest's chosen channel.
 * @param serverOrderType the channel that synced basket came back on, or null when it has none.
 */
export function useAssertBasketChannel(
  syncedLineCount: number,
  orderType: OrderType | null,
  serverOrderType: OrderType | null,
): AssertBasketChannel {
  // What we last SENT for, not what the server has — that is `serverOrderType`.
  const attemptedRef = useRef<OrderType | null>(null);
  const lastLineCountRef = useRef(syncedLineCount);

  const markAttempted = useCallback((next: OrderType | null) => {
    attemptedRef.current = next;
  }, []);

  useEffect(() => {
    // ANY cart change invalidates a previous attempt. The usual reason an assert does not stick is a
    // line the channel forbids, and changing the cart is how a guest fixes that — so a cart that has
    // moved deserves a fresh try. Deliberately not "the count differs from the one we tried at":
    // removing one line and adding another returns to a count already marked attempted, and the
    // retry would be skipped for a cart that is materially different.
    if (lastLineCountRef.current !== syncedLineCount) {
      lastLineCountRef.current = syncedLineCount;
      attemptedRef.current = null;
    }

    if (syncedLineCount === 0 || !orderType) return;

    // Reconciled: the server says what the guest chose. Clear the attempt marker so a later drift
    // (another tab switching the channel, an expired basket replaced by a new one) re-asserts.
    if (serverOrderType === orderType) {
      attemptedRef.current = null;
      return;
    }

    if (attemptedRef.current === orderType) return;
    attemptedRef.current = orderType;

    // Deliberately a dry run: conflicts here are not the guest's doing and must not raise a dialog
    // they did not ask for — their cart already held those lines, and `OrderChannelGuard` still
    // stops the order.
    setBasketOrderType(orderType)
      .then((result) => {
        if (result.applied) return;

        // Now VISIBLE, where it used to be indistinguishable from success. Still not escalated to
        // the guest: they did not ask for this switch, so silently deleting their lines — or
        // interrupting them with a dialog about a change they did not make — would both be worse
        // than letting the order-creation guard have the last word.
        //
        // Tracked as well as logged, because a console warning on a guest's phone is observable by
        // nobody, and "the client and the server disagree about which channel this basket is on" is
        // precisely the state §9.13 exists to make observable. Fired once per attempt rather than
        // per render, since the ref above gates it — the same shape as `item_blocked_by_order_type`.
        console.warn('The basket kept its previous channel: some lines are not available on', orderType);
        trackEvent('basket_channel_assert_refused', { orderType, itemCount: syncedLineCount });
      })
      .catch((err) => {
        // A failed assert must not be remembered as done, or the guard stays disarmed for the whole
        // session. Reading the COUNT rather than a hasLines boolean is what lets this retry at all:
        // a boolean never changes again once the cart is non-empty.
        attemptedRef.current = null;
        console.warn('Could not assert the basket order type after the basket appeared:', err);
      });
  }, [syncedLineCount, orderType, serverOrderType]);

  return { markAttempted };
}
