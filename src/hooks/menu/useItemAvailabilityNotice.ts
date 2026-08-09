'use client';

import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import type { ItemAvailability } from '@/types/menu';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useTableContext } from '@/contexts/TableContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import { resolveChannelNotice } from '@/utils/channelNotice';
import { orderTypeLabel, orderTypeListLabel } from '@/utils/orderTypeLabels';

/**
 * What a catalog card should say about per-order-type availability, fully localized.
 *
 * Shared LOGIC half of the S4 surface (ORDER-TYPE-AVAILABILITY-PLAN §4.5): classic's `MenuCard` and
 * craft's `CraftMenuCard` call this hook and hand the result to the shared `MenuCardAvailability`
 * shell with their own CSS module, so the two templates share one decision and one DOM and differ
 * only in styling.
 */
export interface AvailabilityNotice {
  /**
   * `info` — the guest has chosen no channel yet (the DOMINANT browse state, not an edge case), so
   * the card only mentions where the item can be ordered. Nothing is dimmed and nothing is offered.
   * `blocked` — the chosen channel cannot order this item; the card dims and offers a way out.
   */
  tone: 'info' | 'blocked';
  /** The reason line, e.g. "Takeaway and Delivery only". */
  message: string;
  /**
   * The same fact in the fewest words that still name a channel, e.g. "Not for Dine-in" — empty
   * unless `tone` is `blocked`.
   *
   * It exists for one surface: the corner marker on a PHONE, where the card is an 88px thumbnail
   * beside a text column and `message` (34 characters in French) does not fit anywhere on it. The
   * short form names the channel the guest has CHOSEN rather than the ones the dish allows, which
   * is the shorter sentence and also the more useful one at a glance — the "Switch to X" link
   * under the row is what says where to go instead.
   *
   * Deliberately NOT a truncation of `message`: a clipped "Takeaway and Deliv…" reads as an
   * available channel, i.e. the exact opposite of what it means.
   */
  shortMessage: string;
  /** The one-tap switch target, or `null` when there is none worth offering. */
  switchTo: OrderType | null;
  /** Label for the switch control; empty when `switchTo` is null. */
  switchLabel: string;
  /** Shown instead of the switch when the guest is sitting at a scanned table. */
  hint: string | null;
}

/**
 * Should this item's surface recede and drop its "Add to order"?
 *
 * The second clause is the one that was missing. `useItemAvailabilityNotice` returns `null` for
 * `reason: 'Unavailable'` and while the enabled-channel list is still loading — deliberately, since
 * there is nothing useful to SAY in either case. But a surface that derives "blocked" from the
 * notice alone then reads a null notice as "fine", dims nothing and offers a live Add for an item
 * the server has already refused.
 *
 * `FeaturedSpecial` guarded this; `MenuCard` and `CraftMenuCard` did not, so the same item behaved
 * differently in the hero and in the grid below it. The predicate lives here, next to the hook whose
 * nulls make it necessary, so a fourth surface cannot get it wrong by omission.
 */
export function isItemBlocked(availability: ItemAvailability | undefined, notice: AvailabilityNotice | null): boolean {
  return notice?.tone === 'blocked' || availability?.canOrder === false;
}

/**
 * Resolve the notice for one item, or `null` when there is nothing to say.
 *
 * Three rules are load-bearing:
 *
 * 1. **The verdict comes from the server.** `canOrder`/`reason` are read, never re-derived from
 *    `isAvailable` + a channel comparison — the whole point of one resolved field (§4.2) is that a
 *    guest is never told to "switch to Takeaway" for an item that is switched off everywhere.
 * 2. **`allowedOrderTypes` is the server-DECODED list.** No mask arithmetic happens on a customer
 *    surface; `OrderChannels` bits are 1/2/4 while `OrderType` is 1/2/3, and a stray cast between
 *    them fails silently.
 * 3. **Admin-disabled channels do not exist.** An item allowing Dine-in + Takeaway on a restaurant
 *    with Delivery switched off is effectively unrestricted, and saying "Dine In and Takeaway only"
 *    there is noise; likewise a switch target must be a channel the guest can actually pick.
 */
export function useItemAvailabilityNotice(availability: ItemAvailability | undefined): AvailabilityNotice | null {
  const { t, i18n } = useTranslation();
  const { state } = useOrderType();
  const { hasTableContext } = useTableContext();
  const { enabled, loading } = useEnabledOrderTypes();

  const orderType = state.orderType;

  // Nothing to report: no server verdict (older backend, or a bundle — bundles carry no
  // availability by contract, §9.2), or the enabled list is still in flight and any chip drawn
  // now might have to be retracted.
  if (!availability || loading || enabled.length === 0) return null;

  // `Unavailable` items are already filtered out of the grid upstream (`isVisible` in the public-menu
  // mappers). Even if one slipped through, this feature's copy must not imply stock — there is no
  // stock concept — so there is nothing useful to say.
  if (availability.reason === 'Unavailable') return null;

  // Whether to speak at all, and about which channels, is decided by the shared resolver — the same
  // one the category nav uses, so a card and its category tab can never disagree.
  const notice = resolveChannelNotice({
    allowed: availability.allowedOrderTypes,
    enabled,
    orderType,
    canOrder: availability.canOrder,
  });
  if (!notice) return null;

  const { orderable } = notice;
  const blocked = notice.tone === 'blocked';

  const message =
    orderable.length > 0
      ? t('availability_only_for', '{{orderTypes}} only', {
          orderTypes: orderTypeListLabel(orderable, t, i18n.language || 'en'),
        })
      : t('unavailable', 'Unavailable');

  // A QR scan puts the guest at a physical table, so "switch to takeaway" is nonsense there — point
  // them at a human instead (§4.4).
  const askServer = blocked && hasTableContext && orderType === OrderType.DineIn;
  const switchTo = blocked && !askServer ? (orderable.find((type) => type !== orderType) ?? null) : null;

  // `orderType` should always be set when `blocked`, but nothing enforces it: `resolveChannelNotice`
  // derives `blocked` from `canOrder` alone, with no guard on the chosen channel. So the fallback is
  // the LONG form, not an empty string — the phone's marker renders a filled bar whenever
  // `tone === 'blocked'`, and an empty `shortMessage` would paint a blank grey band across the
  // thumbnail saying nothing. A too-long sentence in a small box is a worse fit; a wordless warning
  // is a worse BUG.
  let shortMessage = '';
  if (blocked) {
    shortMessage = orderType
      ? t('availability_not_for', 'Not for {{orderType}}', { orderType: orderTypeLabel(orderType, t) })
      : message;
  }

  return {
    tone: blocked ? 'blocked' : 'info',
    message,
    shortMessage,
    switchTo,
    switchLabel: switchTo
      ? t('availability_switch_to', 'Switch to {{orderType}}', {
          orderType: orderTypeLabel(switchTo, t),
        })
      : '',
    hint: askServer ? t('availability_ask_server', 'Ask your server') : null,
  };
}
