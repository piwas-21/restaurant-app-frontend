/**
 * Tenant → diner online payment (Stripe Connect, ADR-011 Job B / SOFRA-PAYMENTS-PLAN).
 *
 * Mirrors backend `Features/Payments/Dtos/`. Both are deliberately narrow: the endpoints
 * serving them are ANONYMOUS, because a guest checkout has no account (ADR-004).
 */

import { ApiResponse } from '@/types/order';

/** Mirrors `OnlinePaymentAvailabilityDto`. */
export interface OnlinePaymentAvailabilityDto {
  available: boolean;
}

/** Mirrors `CheckoutSessionDto`. */
export interface CheckoutSessionDto {
  /** Stripe `cs_…`. Handed back on the return trip (S9). */
  sessionId: string;
  /** The hosted Checkout page to send the browser to. */
  url: string;
  /** ISO timestamp, +31 minutes from minting. */
  expiresAt: string;
  /** Lower-case ISO-4217, as Stripe returns it. */
  currency: string;
  /** Minor units — what Stripe will actually charge. */
  amountMinor: number;
}

export type OnlinePaymentAvailabilityApiResponse = ApiResponse<OnlinePaymentAvailabilityDto>;
export type CheckoutSessionApiResponse = ApiResponse<CheckoutSessionDto>;
