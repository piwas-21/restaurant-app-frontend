/**
 * Order mutation commands and list/query filters.
 * Extracted from types/order.ts (Sprint 4/6 type-file split by domain).
 */

import { OrderStatus, PaymentStatus, OrderType, PaymentMethod } from './enums';

/**
 * Update order status command
 */
export interface UpdateOrderStatusCommand {
  newStatus: OrderStatus;
  notes?: string;
  estimatedPreparationMinutes?: number;
}

/**
 * Cancel order command
 */
export interface CancelOrderCommand {
  reason: string;
}

/**
 * Toggle focus order command
 */
export interface ToggleFocusOrderCommand {
  isFocusOrder: boolean;
  priority?: number;
  focusReason?: string;
}

/**
 * Add payment to order command
 */
export interface AddPaymentToOrderCommand {
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  transactionId?: string;
  referenceNumber?: string;
  cardLastFourDigits?: string;
  cardType?: string;
  paymentGateway?: string;
  paymentNotes?: string;
}

/**
 * Refund payment command
 */
export interface RefundPaymentCommand {
  amount: number;
  reason: string;
}

/**
 * Order query filters
 */
export interface OrderQueryFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  orderType?: OrderType;
  startDate?: string;
  endDate?: string;
  userId?: string;
  search?: string;
  isFocusOrder?: boolean;
  orderBy?: string;
  descending?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Focus orders query filters
 */
export interface FocusOrdersQueryFilters {
  activeOnly?: boolean;
  priority?: number;
  orderBy?: string;
}
