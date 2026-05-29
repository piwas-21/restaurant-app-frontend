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
  tableNumber?: number;
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
  tableNumber?: number;
  subTotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  discountPercentage: number;
  tip: number;
  total: number;
  totalPaid: number;
  remainingAmount: number;
  isFullyPaid: boolean;
  status: string;
  paymentStatus: string;
  isFocusOrder: boolean;
  priority?: number;
  focusReason?: string;
  focusedAt?: string;
  focusedBy?: string;
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
  items: OrderItemDto[];
  payments: OrderPaymentDto[];
  statusHistory: OrderStatusHistoryDto[];
}

/**
 * Order API response types
 */
export type OrderDtoApiResponse = ApiResponse<OrderDto>;
export type OrderDtoListApiResponse = ApiResponse<OrderDto[]>;
export type OrderDtoPagedResultApiResponse = ApiResponse<PagedResult<OrderDto>>;
export type OrderPaymentDtoApiResponse = ApiResponse<OrderPaymentDto>;
