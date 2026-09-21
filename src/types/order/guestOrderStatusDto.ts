import type { ApiResponse } from './common';

/**
 * The anonymous guest-status read (`GET /api/orders/guest-status`): a deliberate minimum —
 * no address, payments, or notes. Unknown id or wrong token answers 404, so "not found"
 * cannot leak an order's existence.
 */
export interface GuestOrderStatusDto {
  orderNumber: string;
  type: string;
  status: string;
  estimatedDeliveryTime?: string | null;
  confirmationFlow: 'direct' | 'acknowledge';
  reviewWindowMinutes: number;
  reviewDeadlineUtc?: string | null;
}

export type GuestOrderStatusApiResponse = ApiResponse<GuestOrderStatusDto>;
