import type { CreateOrderDeliveryAddressDto, CreateOrderItemDto } from './dtos';
import { OrderType } from './enums';
import type { ApiResponse } from './common';
import type { OrderDto } from './orderDto';

/**
 * Payment state accepted when a counter order is created. Both values describe an UNPAID
 * order — recording the tender is a separate staff action (backend `StaffOrderPaymentState`).
 * `PayLater` is an explicit synonym the server accepts alongside the default.
 */
export type StaffOrderPaymentState = 'Unpaid' | 'PayLater';

/**
 * Shared wire payload for the staff counter quote and create contracts.
 *
 * Mirrors backend `RestaurantSystem.Api/Features/Orders/Dtos/StaffCounterOrderRequest.cs`.
 * The wire is camelCase JSON; `type` and `items` are `[JsonRequired]` server-side, and
 * `paymentState` defaults to `Unpaid` when omitted. Dine-in additionally requires
 * `serviceSessionId` (and may carry `tableId` / `tableNumber`); every table field must be
 * absent on takeaway and delivery — the server validator refuses them there.
 */
export interface StaffCounterOrderRequest {
  type: OrderType;
  tableId?: string;
  tableNumber?: number;
  serviceSessionId?: string;
  /** Canonical customer id. `customerId` remains an additive alias; the server rejects conflicts. */
  customerUserId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Delivery channel only (the server validator refuses it on other channels). */
  deliveryAddress?: CreateOrderDeliveryAddressDto;
  promoCode?: string;
  /** Loyalty points requested for redemption against this attributed customer. */
  pointsToRedeem?: number;
  tip?: number;
  notes?: string;
  paymentState?: StaffOrderPaymentState;
  items: CreateOrderItemDto[];
}

/** `POST /api/staff/orders/quote` body: the shared request, priced by the server, never persisted. */
export type QuoteStaffCounterOrderCommand = StaffCounterOrderRequest;

/**
 * `POST /api/staff/orders` body. Both added fields are `[JsonRequired]` on the wire: a missing
 * `clientOperationId` has no idempotency key, and a missing `releaseToKitchen` must not
 * silently choose a kitchen policy.
 */
export interface CreateStaffCounterOrderCommand extends StaffCounterOrderRequest {
  clientOperationId: string;
  releaseToKitchen: boolean;
}

/** `POST /api/staff/orders/{orderId}/release` body: release a held order to the kitchen. */
export interface ReleaseStaffCounterOrderCommand {
  clientOperationId: string;
  expectedVersion: number;
}

/** POST /api/staff/orders/round; stable table-service round contract. */
export interface CreateStaffRoundCommand extends StaffCounterOrderRequest {
  clientOperationId: string;
  releaseToKitchen: boolean;
  type: OrderType.DineIn;
  tableId: string;
  serviceSessionId: string;
  paymentState: 'Unpaid';
}

export type StaffRoundOperationLookupStatus = 'Unknown' | 'Committed';

export interface StaffRoundOperationLookupDto {
  operationId: string;
  status: StaffRoundOperationLookupStatus;
  order?: OrderDto | null;
}

export type StaffRoundOperationLookupApiResponse = ApiResponse<StaffRoundOperationLookupDto>;
