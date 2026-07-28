'use client';

// The ordered category tabs (All, Menu Bundles, then each API category with its
// localized display name) shared by the classic CategoryNav and the craft
// CraftCategoryNav surface — one source of truth for order, ids and labels, so
// the two navs never drift.
import { useTranslation } from 'react-i18next';
import type { ApiCategory } from '@/types/menu';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/publicMenu/constants';
import { getCategoryDisplayName } from '@/utils/categoryNameMapper';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import { resolveChannelNotice } from '@/utils/channelNotice';
import { orderTypeListLabel } from '@/utils/orderTypeLabels';

export interface CategoryTabNotice {
  /** The reason line, e.g. "Takeaway and Delivery only" — same copy as the card chip. */
  message: string;
}

export interface CategoryTab {
  id: string;
  label: string;
  /**
   * Channel restriction to show beside the label, or `null` when there is nothing to say
   * (ORDER-TYPE-AVAILABILITY-PLAN §4.4: *an entirely-blocked category stays visible with a channel
   * chip*). A restricted category is never hidden and never disabled — its products carry their own
   * verdicts, and a tab that vanished when the guest picked a channel is exactly the "All items
   * looks broken" outcome §4.4 exists to prevent.
   *
   * **There is deliberately no blocked/dimmed tone here, unlike a card.** A product may OVERRIDE its
   * category's mask (that is what the S3 inherit/custom control is for), so a category the chosen
   * channel cannot order may still contain items that channel CAN order — and the client has no
   * per-category server verdict to know which. Dimming the tab would be the client claiming
   * something the server never said, the exact failure this feature's rules exist to prevent. The
   * chip states the category's own restriction, which is true either way.
   */
  notice: CategoryTabNotice | null;
}

export function useCategoryTabs(categories: ApiCategory[], allLabel: string): CategoryTab[] {
  const { t, i18n } = useTranslation();
  const { state } = useOrderType();
  const { enabled, loading } = useEnabledOrderTypes();

  const orderType = state.orderType;
  const language = i18n.language || 'en';

  const noticeFor = (category: ApiCategory): CategoryTabNotice | null => {
    // Nothing to say while the admin's enabled list is in flight (a chip drawn now might have to be
    // retracted), or without a decoded list from the server — an older backend omits it, and absent
    // means unrestricted, never blocked.
    if (loading || enabled.length === 0 || !category.allowedOrderTypes) return null;

    // A category has no server `canOrder` of its own the way a product does. Membership stands in for
    // one only to decide WHETHER to speak — a category that permits the chosen channel has nothing
    // to say. It never becomes a claim about the items inside (see the `notice` docs above).
    const canOrder = orderType === null || category.allowedOrderTypes.includes(orderType);
    const notice = resolveChannelNotice({ allowed: category.allowedOrderTypes, enabled, orderType, canOrder });
    if (!notice) return null;

    return {
      message:
        notice.orderable.length > 0
          ? t('availability_only_for', '{{orderTypes}} only', {
              orderTypes: orderTypeListLabel(notice.orderable, t, language),
            })
          : t('unavailable', 'Unavailable'),
    };
  };

  return [
    { id: ALL_ITEMS_KEY, label: allLabel, notice: null },
    { id: MENU_BUNDLES_KEY, label: t('menu_bundles'), notice: null },
    ...categories.map((cat) => ({
      id: cat.id,
      label: getCategoryDisplayName(cat.name, t),
      notice: noticeFor(cat),
    })),
  ];
}
