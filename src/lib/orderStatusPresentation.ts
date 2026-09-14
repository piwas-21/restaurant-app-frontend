import type { StatusBadgeTone } from '@/components/design-system/StatusBadge';
import { orderStatusBadgeFill, orderStatusLabel, orderStatusMeta, type OrderStatusBadgeFill } from './orderStatus';

/**
 * One status presentation for staff surfaces. The order domain stays the authority for aliases,
 * localized label keys, StatusBadge tone and the cashier's richer six-fill palette; consumers do
 * not rebuild a partial status map from raw HTTP strings (POS S3).
 */
export interface OrderStatusPresentation {
  readonly label: string;
  readonly tone: StatusBadgeTone;
  readonly fill: OrderStatusBadgeFill;
}

export function orderStatusPresentation(
  status: string | null | undefined,
  t: (key: string) => string,
): OrderStatusPresentation {
  return {
    label: orderStatusLabel(status, t),
    tone: orderStatusMeta(status)?.tone ?? 'neutral',
    fill: orderStatusBadgeFill(status),
  };
}
