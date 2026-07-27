'use client';

import { useEffect } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { trackEvent } from '@/lib/analytics';
import type { AvailabilityNotice } from './useItemAvailabilityNotice';

/**
 * Refusals already reported this page-load, keyed `source:itemId:orderType`.
 *
 * The SOURCE is in the key because the featured-special banner and a catalog card can show the same
 * blocked product on one page. The banner renders first, so a shared key let it claim the entry and
 * silently drop the card's event for the rest of the visit — undercounting the one number this
 * feature exists to measure.
 *
 * **Deliberately module scope, not a ref.** The grid unmounts its cards on every pagination step,
 * category-tab change and channel switch (`MenuContent` gates the whole list on its loading flag),
 * so a per-instance guard resets constantly: paging away and back would report the same refusal
 * again, and the event would end up counting *renders of blocked cards* rather than *guests blocked*
 * — which is a number that looks like engagement and means nothing.
 *
 * Bounded by items × channels and reset by a page load, which is the intended lifetime: one refusal
 * per item per channel per visit.
 */
const reported = new Set<string>();

/** Test seam — the module-scope guard would otherwise leak between cases. */
export function __resetTrackedBlocks(): void {
  reported.clear();
}

/**
 * Fire `item_blocked_by_order_type` when a catalog card is blocked for the guest's chosen channel
 * (ORDER-TYPE-AVAILABILITY-PLAN §4.4 — the analytics half of the S4 surface).
 *
 * **This is the one impression-style event in the app, and it has to be.** Every other funnel event
 * hangs off a user action, but a blocked card deliberately has no control to click — S4 REMOVES
 * "Add to order" rather than disabling it — so the only observable moment is the card telling the
 * guest no. What it measures is the thing this feature can get wrong: how often a restriction stops
 * a guest who was already browsing.
 *
 * Switching channel and being blocked *again* IS a new event: the channel is part of the key, and a
 * second refusal is the signal that the guest has not found one that works. The same product
 * refused on the hero AND in the grid is two events too — they are two places the guest was stopped.
 *
 * The `info` tone never fires — nothing is blocked before a channel is chosen, and counting ordinary
 * browsing would drown the signal.
 */
export function useTrackItemBlocked(
  itemId: string | undefined,
  notice: AvailabilityNotice | null,
  source: 'menu_card' | 'featured_special' = 'menu_card',
): void {
  const { state } = useOrderType();
  const orderType = state.orderType;

  const blocked = notice?.tone === 'blocked';
  const key = blocked && itemId && orderType !== null ? `${source}:${itemId}:${orderType}` : null;

  useEffect(() => {
    if (!key || reported.has(key)) return;
    reported.add(key);

    trackEvent('item_blocked_by_order_type', {
      productId: itemId,
      orderType: orderType ?? undefined,
      source,
    });
  }, [key, itemId, orderType, source]);
}
