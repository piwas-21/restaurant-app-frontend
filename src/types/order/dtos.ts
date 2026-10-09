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
  isAddOn?: boolean; // frozen paid-extra marker; CHOSEN = !isRemoved && qty > 0 && (isAddOn || qty > 1); absent = pre-flag payload (see lineSummary.isChosenIngredient)
}

/** Order item details — the shape POSTed to `/api/Orders`, and the base of what it returns. */
export interface CreateOrderItemDto {
  productId: string;
  productVariationId?: string;
  menuId?: string;
  quantity: number;
  unitPrice: number;
  customizationPrice?: number;
  specialInstructions?: string;
  // IDs on the dish. Presence triggers server pricing (backend #430); empty means all optional off,
  // while omission preserves the declared price.
  selectedIngredientIds?: string[];
  ingredientQuantities?: Record<string, number>; // Ingredient quantities for kitchen print
  sectionId?: string; // Frozen menu-section identity for stable choice grouping in order displays.
  childItems?: CreateOrderItemDto[]; // Child items (e.g. side items, additionals)
  // Child rows only (backend #318): bundle component vs true side. On the CREATE shape because a
  // child row is WRITTEN, not just read — the waiter sheet posts its side items with it.
  kind?: 'BundleChild' | 'SideItem';
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
  sideItems?: OrderItemDto[]; // Child order items: bundle components + true add-on sides (see kind)
}

/**
 * The tender declared when an order is placed — an *intent* to pay, not a record of money
 * received.
 *
 * Deliberately carries no gateway metadata, and deliberately no longer the parent of
 * `OrderPaymentDto`. `transactionId` / `referenceNumber` / `cardLastFourDigits` / `cardType` /
 * `paymentGateway` used to live here and were sent to `POST /api/Orders` — an ANONYMOUS endpoint
 * that wrote them into the ledger verbatim, so a caller could invent a payment reference for a
 * payment that never happened. The backend DTO dropped them; this mirrors that.
 *
 * They still exist on `AddPaymentToOrderCommand` (`src/types/order/commands.ts`), the staff-only
 * till path, which is the correct home: it runs after a human has taken the money.
 */
export interface CreateOrderPaymentDto {
  paymentMethod: PaymentMethod;
  amount: number;
  paymentNotes?: string;
}

export type { OrderPaymentDto } from './paymentDto';
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
