import type { OrderDto } from '@/types/order';

function itemReview(item: OrderDto['items'][number]) {
  return {
    id: item.id,
    productId: item.productId,
    productVariationId: item.productVariationId,
    productName: item.productName,
    variationName: item.variationName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    customizationPrice: item.customizationPrice,
    itemTotal: item.itemTotal,
    specialInstructions: item.specialInstructions,
    selectedIngredientIds: item.selectedIngredientIds,
    ingredientQuantities: item.ingredientQuantities,
    ingredientCustomizations: item.ingredientCustomizations,
    childItems: item.childItems,
    sideItems: item.sideItems,
  };
}

/** Binds a human review to visible order facts and server-supplied permissions, excluding volatile revisions. */
export function channelOrderReviewFingerprint(order: OrderDto): string {
  const permissions = (order.permittedActions ?? [])
    .map(({ action, allowed, reasonCode, requiresReason }) => ({ action, allowed, reasonCode, requiresReason }))
    .sort((left, right) => left.action.localeCompare(right.action));
  const external = order.externalOrder;
  return JSON.stringify({
    orderId: order.id.toLowerCase(),
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    isKitchenReleased: order.isKitchenReleased === true,
    permissions,
    customerName: order.customerName,
    notes: order.notes,
    deliveryAddress: {
      fullAddress: order.deliveryAddress?.fullAddress,
      deliveryInstructions: order.deliveryAddress?.deliveryInstructions,
    },
    totals: {
      currency: order.currency,
      subTotal: order.subTotal,
      tax: order.tax,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      tip: order.tip,
      total: order.total,
    },
    items: (order.items ?? []).map(itemReview),
    external: external
      ? {
          provider: external.provider,
          externalDisplayId: external.externalDisplayId,
          externalState: external.externalState,
          fulfillmentType: external.fulfillmentType,
          currency: external.currency,
          merchantTotal: external.merchantTotal,
          reportedTax: external.reportedTax,
          isSandbox: external.isSandbox,
        }
      : null,
  });
}
