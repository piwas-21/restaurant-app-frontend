/**
 * The aggregate order request/response shapes and their API-response aliases.
 * Extracted from types/order.ts (Sprint 4/6 type-file split by domain).
 */

import { OrderType } from './enums';
import { ApiResponse, PagedResult } from './common';
import {
  CreateOrderDeliveryAddressDto,
  DeliveryAddressDto,
  CreateOrderItemDto,
  OrderItemDto,
  CreateOrderPaymentDto,
  OrderPaymentDto,
  OrderStatusHistoryDto,
} from './dtos';
import type { OrderPermittedActionDto } from './tableBillRound';
import type { OrderRoutingStateDto } from './orderRouting';

/**
 * Create order command (request)
 */
export interface CreateOrderCommand {
  sessionId?: string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  type: OrderType;
  tableNumber?: number | null;
  promoCode?: string;
  hasUserLimitDiscount?: boolean;
  userLimitAmount?: number;
  // Pre-calculated values from basket (optional)
  basketSubTotal?: number;
  basketTax?: number;
  basketDiscount?: number;
  basketCustomerDiscount?: number;
  basketTotal?: number;
  // Fidelity Points
  pointsToRedeem?: number;
  // Tip
  tip?: number;
  isFocusOrder?: boolean;
  priority?: number;
  focusReason?: string;
  notes?: string;
  deliveryAddress?: CreateOrderDeliveryAddressDto;
  items?: CreateOrderItemDto[];
  payments?: CreateOrderPaymentDto[];
}

/**
 * Body for POST /api/Orders/from-basket (menu-bundles redesign #157, slice 5). The server reads the
 * user's persisted basket (resolved from the X-Session-Id header, added by apiClient) and derives the
 * order items itself — so, unlike CreateOrderCommand, this carries no `items`, and drops the
 * server/session-owned or staff/POS-only fields (`sessionId`, `userId`, focus-order, user-limit
 * discount).
 */
export type CreateOrderFromBasketCommand = Omit<
  CreateOrderCommand,
  | 'items'
  | 'sessionId'
  | 'userId'
  | 'isFocusOrder'
  | 'priority'
  | 'focusReason'
  | 'hasUserLimitDiscount'
  | 'userLimitAmount'
>;

/**
 * Complete order data (response)
 */
export interface OrderDto {
  id: string;
  orderNumber: string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  type: string;
  tableNumber?: number | null;
  /** Stable table identity for dine-in orders (additive S2 response field). */
  tableId?: string | null;
  /** Display label for a table, including labels that are not numeric (for example, T-QA). */
  tableLabel?: string | null;
  /** Explicit visit membership for staff-created dine-in rounds. */
  serviceSessionId?: string | null;
  subTotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  discountPercentage: number;
  customerDiscountAmount: number;
  tip: number;
  total: number;
  totalPaid: number;
  remainingAmount: number;
  isFullyPaid: boolean;
  status: string;
  paymentStatus: string;
  /** Whether the order was deliberately released to the kitchen. */
  isKitchenReleased?: boolean;
  kitchenReleasedAt?: string | null;
  kitchenReleasedBy?: string | null;
  /** Server-issued aggregate version used for conditional staff mutations. */
  version: number;
  isFocusOrder: boolean;
  priority?: number;
  focusReason?: string;
  focusedAt?: string;
  focusedBy?: string;
  orderTypeOverrideBy?: string | null;
  orderTypeOverrideItems?: string | null;
  preferredLanguage?: string | null;
  orderDate: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  deliveryAddress?: DeliveryAddressDto;
  cancellationReason?: string;
  promoCode?: string;
  hasUserLimitDiscount: boolean;
  userLimitAmount: number;
  currency?: string | null;
  items: OrderItemDto[];
  payments: OrderPaymentDto[];
  statusHistory: OrderStatusHistoryDto[];
  permittedActions?: OrderPermittedActionDto[] | null;
  routingStates?: OrderRoutingStateDto[] | null;
  /**
   * Per-order guest token (plan S3): lets the guest WATCH their own order via the anonymous
   * guest-status endpoint without holding any staff credential. Creation response only.
   */
  guestStatusToken?: string;
}

/**
 * Order API response types
 */
export type OrderDtoApiResponse = ApiResponse<OrderDto>;
export type OrderDtoListApiResponse = ApiResponse<OrderDto[]>;
export type OrderDtoPagedResultApiResponse = ApiResponse<PagedResult<OrderDto>>;
export type OrderPaymentDtoApiResponse = ApiResponse<OrderPaymentDto>;
