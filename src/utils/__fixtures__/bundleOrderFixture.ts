/**
 * Bundle-order fixtures shaped like the ROOT-ONLY `OrderDto.items` the backend has returned since
 * #237 (issue #234): bundle components and add-on sides live only in the parent's `sideItems`, never
 * as top-level entries. Shared by the kitchen-routing tests (receipt template + cashier print
 * buttons) so both exercise the same tree.
 */
import { OrderDto, OrderItemDto } from '@/types/order';

type ItemOverrides = Partial<OrderItemDto> & Pick<OrderItemDto, 'id' | 'productName'>;

export function makeOrderItem(overrides: ItemOverrides): OrderItemDto {
  return {
    productId: `product-${overrides.id}`,
    quantity: 1,
    unitPrice: 0,
    itemTotal: 0,
    ...overrides,
  };
}

export function makeOrder(items: OrderItemDto[]): OrderDto {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    type: 'DineIn',
    tableNumber: 4,
    subTotal: 20,
    tax: 0,
    deliveryFee: 0,
    discount: 0,
    discountPercentage: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remainingAmount: 20,
    isFullyPaid: false,
    status: 'Pending',
    paymentStatus: 'Pending',
    isFocusOrder: false,
    orderDate: '2026-07-27T12:00:00.000Z',
    hasUserLimitDiscount: false,
    userLimitAmount: 0,
    items,
    payments: [],
    statusHistory: [],
  };
}

/**
 * A FrontKitchen combo whose components are ALSO FrontKitchen. Only the front kitchen gets a
 * ticket, and its components print nested under the combo — exactly once.
 */
export const singleKitchenBundleOrder = (): OrderDto =>
  makeOrder([
    makeOrderItem({
      id: 'combo',
      productName: 'Mezze Combo',
      menuName: 'Mezze Combo',
      kitchenType: 'FrontKitchen',
      itemTotal: 20,
      unitPrice: 20,
      sideItems: [
        makeOrderItem({ id: 'hummus', productName: 'Hummus', kitchenType: 'FrontKitchen', kind: 'BundleChild' }),
        makeOrderItem({ id: 'salad', productName: 'Fattoush Salad', kitchenType: 'FrontKitchen', kind: 'BundleChild' }),
      ],
    }),
  ]);

/**
 * A combo whose component has a component of its own. The backend builds the tree to arbitrary
 * depth, so every surface that itemises an order has to recurse — one level deep silently drops
 * the grandchild.
 */
export const nestedBundleOrder = (): OrderDto =>
  makeOrder([
    makeOrderItem({
      id: 'combo',
      productName: 'Family Platter',
      menuName: 'Family Platter',
      kitchenType: 'FrontKitchen',
      itemTotal: 20,
      unitPrice: 20,
      sideItems: [
        makeOrderItem({
          id: 'mezze',
          productName: 'Mezze Selection',
          kitchenType: 'FrontKitchen',
          kind: 'BundleChild',
          sideItems: [
            makeOrderItem({ id: 'hummus', productName: 'Hummus', kitchenType: 'FrontKitchen', kind: 'BundleChild' }),
          ],
        }),
      ],
    }),
  ]);

/**
 * The regression case from backend #237: a FrontKitchen combo containing BackKitchen fries. Both
 * kitchens must get a ticket, and the fries must land on the BACK one — not nested on the front.
 */
export const mixedKitchenBundleOrder = (): OrderDto =>
  makeOrder([
    makeOrderItem({
      id: 'combo',
      productName: 'Burger Combo',
      menuName: 'Burger Combo',
      kitchenType: 'FrontKitchen',
      itemTotal: 20,
      unitPrice: 20,
      sideItems: [
        makeOrderItem({ id: 'burger', productName: 'Beef Burger', kitchenType: 'FrontKitchen', kind: 'BundleChild' }),
        makeOrderItem({ id: 'fries', productName: 'Fries', kitchenType: 'BackKitchen', kind: 'BundleChild' }),
      ],
    }),
  ]);
