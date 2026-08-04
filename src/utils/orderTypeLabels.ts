import { OrderType } from '@/types/order';

/**
 * The i18n key (plus a dev-time fallback) for each order type's display label.
 *
 * Shared so the admin channel matrix and the product editor cannot drift into calling one channel
 * "Dine In" and the other "Dine-in", and so a new order type is a one-line change here.
 */
export const ORDER_TYPE_LABEL_KEY: Record<OrderType, { key: string; fallback: string }> = {
  [OrderType.DineIn]: { key: 'order_type_dine_in', fallback: 'Dine In' },
  [OrderType.Takeaway]: { key: 'order_type_takeaway', fallback: 'Takeaway' },
  [OrderType.Delivery]: { key: 'order_type_delivery', fallback: 'Delivery' },
};

/** Localized label for one order type. */
export function orderTypeLabel(orderType: OrderType, t: (key: string, fallback: string) => string): string {
  return t(ORDER_TYPE_LABEL_KEY[orderType].key, ORDER_TYPE_LABEL_KEY[orderType].fallback);
}

/**
 * "Takeaway and Delivery" — the list a customer-facing chip interpolates.
 *
 * `Intl.ListFormat` rather than a hardcoded `", "` join because the conjunction, its placement and
 * the separators genuinely differ across the ten locales (Arabic and Chinese in particular), and
 * building the phrase in the component would bake English grammar into a translated string. Falls
 * back to a comma join on any runtime that lacks it.
 */
export function orderTypeListLabel(
  orderTypes: readonly OrderType[],
  t: (key: string, fallback: string) => string,
  language: string,
): string {
  const labels = orderTypes.map((orderType) => orderTypeLabel(orderType, t));
  try {
    return new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(labels);
  } catch {
    // IGNORED ON PURPOSE: feature detection. `Intl.ListFormat` is missing on older engines and
    // throws on a locale tag it does not know; the comma join is the intended degradation.
    return labels.join(', ');
  }
}
