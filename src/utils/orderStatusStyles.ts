import styles from '@/styles/orderStatus.module.css';

/**
 * Get the CSS class name for an order status badge
 */
export const getOrderStatusClass = (status: string): string => {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case 'pending':
      return styles.statusPending;
    case 'confirmed':
      return styles.statusConfirmed;
    case 'preparing':
      return styles.statusPreparing;
    case 'ready':
      return styles.statusReady;
    case 'intransit':
    case 'in transit':
      return styles.statusInTransit;
    case 'delivered':
      return styles.statusDelivered;
    case 'completed':
      return styles.statusCompleted;
    case 'cancelled':
      return styles.statusCancelled;
    default:
      return styles.statusPending;
  }
};

/**
 * Get the CSS class name for a payment status badge
 */
export const getPaymentStatusClass = (status: string): string => {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case 'pending':
      return styles.paymentPending;
    case 'paid':
      return styles.paymentPaid;
    case 'partiallypaid':
    case 'partially paid':
      return styles.paymentPartiallyPaid;
    case 'refunded':
      return styles.paymentRefunded;
    case 'failed':
      return styles.paymentFailed;
    default:
      return styles.paymentPending;
  }
};

/**
 * Get combined class names for status badge
 */
export const getStatusBadgeClasses = (status: string): string => {
  return `${styles.statusBadge} ${getOrderStatusClass(status)}`;
};

/**
 * Get combined class names for payment badge
 */
export const getPaymentBadgeClasses = (status: string): string => {
  return `${styles.paymentBadge} ${getPaymentStatusClass(status)}`;
};

/**
 * Get focus badge class
 */
export const getFocusBadgeClass = (): string => {
  return styles.focusBadge;
};
