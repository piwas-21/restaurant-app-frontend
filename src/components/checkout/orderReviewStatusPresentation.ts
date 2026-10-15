const APPROVED_STATUSES = new Set(['Confirmed', 'Preparing', 'Ready', 'Delivered', 'Completed']);

export interface ApprovedStatusCopy {
  readonly titleKey: string;
  readonly titleFallback: string;
  readonly statusKey: string;
}

export function isApprovedOrderStatus(status: string): boolean {
  return APPROVED_STATUSES.has(status);
}

export function approvedStatusCopy(status: string): ApprovedStatusCopy {
  switch (status) {
    case 'Ready':
      return { titleKey: 'order_status_ready', titleFallback: 'Ready', statusKey: 'order_status_ready' };
    case 'Completed':
      return { titleKey: 'order_status_completed', titleFallback: 'Completed', statusKey: 'order_status_completed' };
    case 'Delivered':
      return { titleKey: 'order_status_delivered', titleFallback: 'Delivered', statusKey: 'order_status_delivered' };
    default:
      return {
        titleKey: 'checkout.review_approved_title',
        titleFallback: 'Your order is approved',
        statusKey: 'order_status_confirmed',
      };
  }
}

export function legacyTimeForActivePreparation(
  status: string,
  expectedReadyAt: string | null | undefined,
  estimatedDeliveryTime: string | null | undefined,
  orderType: string | undefined,
  locale: string,
): string | null {
  if (status !== 'Confirmed' && status !== 'Preparing') return null;
  if (!estimatedDeliveryTime || expectedReadyAt || orderType === 'Delivery') return null;
  const parsed = new Date(estimatedDeliveryTime);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
