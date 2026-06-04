/**
 * Order sub-DTOs: delivery address, items, payments, status history.
 * Extracted from types/order.ts (Sprint 4/6 type-file split by domain).
 */

import { PaymentMethod, OrderStatus } from './enums';

/**
 * Delivery address for orders
 */
export interface CreateOrderDeliveryAddressDto {
  useAddressId?: string;
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
}

export interface DeliveryAddressDto {
  id: string;
  orderId: string;
  userAddressId?: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  deliveryInstructions?: string;
  fullAddress: string;
}

/**
 * Ingredient customization details for an order item
 */
export interface OrderItemIngredientDto {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  isRemoved: boolean; // true if customer deselected/removed this ingredient
}

/**
 * Order item details
 */
export interface CreateOrderItemDto {
  productId: string;
  productVariationId?: string;
  menuId?: string;
  quantity: number;
  unitPrice: number;
  customizationPrice?: number;
  specialInstructions?: string;
  ingredientQuantities?: Record<string, number>; // Ingredient quantities for kitchen print
  childItems?: CreateOrderItemDto[]; // Child items (e.g. side items, additionals)
}

export interface OrderItemDto extends CreateOrderItemDto {
  id: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  variationName?: string;
  menuName?: string;
  itemTotal: number;
  kitchenType?: string; // FrontKitchen, BackKitchen, or None
  ingredientCustomizations?: OrderItemIngredientDto[]; // Selected/removed ingredients
  sideItems?: OrderItemDto[]; // Child order items (additionals)
}

/**
 * Payment details for orders
 */
export interface CreateOrderPaymentDto {
  paymentMethod: PaymentMethod;
  amount: number;
  transactionId?: string;
  referenceNumber?: string;
  cardLastFourDigits?: string;
  cardType?: string;
  paymentGateway?: string;
  paymentNotes?: string;
}

export interface OrderPaymentDto extends CreateOrderPaymentDto {
  id: string;
  orderId: string;
  status: string; // PaymentStatus as string from backend
  paymentDate?: string;
  isRefunded?: boolean;
  refundedAmount?: number;
  refundDate?: string;
  refundReason?: string;
  createdAt?: string;
}

/**
 * Order status history entry
 */
export interface OrderStatusHistoryDto {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedAt: string;
  changedBy?: string;
  notes?: string;
}
