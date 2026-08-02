import type { OrderStatus } from '@/types/order';

/**
 * Which tab an order belongs to on `/orders` (BUGS-IMPROVEMENTS-PLAN B3).
 *
 * Every member of `OrderStatus` must appear in exactly one of these two lists — `orderStatus.test.ts`
 * asserts it. That is not tidiness: a status in NEITHER list is an order the customer cannot find
 * under Active or under Past, i.e. one that disappears from the page entirely, and nothing about
 * the previous shape made that visible.
 *
 * It had happened twice. `OutForDelivery` — the backend's real name for a delivery in transit, and
 * reachable through its own `Ready → OutForDelivery` transition — was absent because this file
 * assumed the name `InTransit` ("same concept as OutForDelivery in the spec"). And `Refunded` was
 * absent because of the comment that used to sit here: *"'Refunded' is a PaymentStatus, not an
 * OrderStatus — not listed here intentionally."* It is both
 * (`RestaurantSystem.Domain/Common/Enums/OrderStatus.cs:13`).
 */
export const ACTIVE_STATUSES: OrderStatus[] = [
  'Pending',
  'PendingApproval',
  'Confirmed',
  'Preparing',
  'In Progress',
  'Ready',
  'OutForDelivery',
  'InTransit',
];

export const PAST_STATUSES: OrderStatus[] = ['Delivered', 'Completed', 'Cancelled', 'Refunded'];
