import styles from '@/styles/orderStatus.module.css';
import { OrderStatus } from '@/types/order';
import { ORDER_STATUS_META, orderStatusMeta, PAYMENT_STATUS_META } from '@/lib/orderStatus';

/**
 * Thin adapters over `@/lib/orderStatus`, kept so the existing callsites keep working while they
 * migrate. Every mapping this file used to own now lives in one place — this module had drifted
 * from `useOrderHelpers` on `InTransit` alone (`order_status_intransit` vs `order_status_in_transit`),
 * which is why both spellings existed in all ten locale files.
 */

/** CSS class for an order status badge. Unknown values keep the neutral pending look. */
export const getOrderStatusClass = (status: string): string =>
  styles[orderStatusMeta(status)?.className ?? 'statusPending'];

/** CSS class for a payment status badge. */
export const getPaymentStatusClass = (status: string): string => {
  const key = status.toLowerCase().replace(/\s+/g, '');
  const match = (Object.keys(PAYMENT_STATUS_META) as (keyof typeof PAYMENT_STATUS_META)[]).find(
    (s) => s.toLowerCase() === key,
  );
  return styles[match ? PAYMENT_STATUS_META[match].className : 'paymentPending'];
};

export const getStatusBadgeClasses = (status: string): string => `${styles.statusBadge} ${getOrderStatusClass(status)}`;

export const getPaymentBadgeClasses = (status: string): string =>
  `${styles.paymentBadge} ${getPaymentStatusClass(status)}`;

export const getFocusBadgeClass = (): string => styles.focusBadge;

/** i18n key for an order status. Unknown values return the raw string, as before. */
export const getOrderStatusTranslationKey = (status: OrderStatus): string =>
  ORDER_STATUS_META[status]?.i18nKey ?? status;
