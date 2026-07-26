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
