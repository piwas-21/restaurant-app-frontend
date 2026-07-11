import type { BasketItemDto } from '@/types/basket';
import type { CreateOrderItemDto } from '@/types/order';

/**
 * Ingredient quantities for the order payload: copy of the basket item's map with every
 * ingredient NOT in selectedIngredients zeroed out. An explicit 0 is how the backend
 * (OrderMappingService) derives IsRemoved for the kitchen ticket. Returns undefined when the
 * basket item carries no quantities, matching the previous inline behaviour (field omitted).
 */
function buildIngredientQuantities(
  item: Pick<BasketItemDto, 'ingredientQuantities' | 'selectedIngredients'>,
): Record<string, number> | undefined {
  if (!item.ingredientQuantities || Object.keys(item.ingredientQuantities).length === 0) {
    return undefined;
  }

  const processed = { ...item.ingredientQuantities };

  // If selectedIngredients exists, mark deselected ingredients with quantity 0
  if (item.selectedIngredients && Array.isArray(item.selectedIngredients)) {
    Object.keys(processed).forEach((ingredientId) => {
      // If ingredient is NOT in selectedIngredients, it was deselected
      if (!item.selectedIngredients!.includes(ingredientId)) {
        processed[ingredientId] = 0;
      }
    });
  }

  return processed;
}

/**
 * Map a bundle-child basket item (menu option chosen in the bundle modal) to an order child
 * item. customizationPrice is sent as 0 because BasketService already rolls each child's
 * customization price into the parent's unitPrice — a non-zero value here would be
 * double-counted into the root ItemTotal by the backend OrderItemFactory (issue #150).
 */
function buildBundleChildOrderItem(child: BasketItemDto): CreateOrderItemDto {
  const childItem: CreateOrderItemDto = {
    productId: child.productId || '',
    productVariationId: child.productVariationId,
    quantity: child.quantity,
    unitPrice: child.unitPrice,
    customizationPrice: 0,
    specialInstructions: child.specialInstructions,
    ingredientQuantities: buildIngredientQuantities(child),
  };

  if (child.childItems && child.childItems.length > 0) {
    childItem.childItems = child.childItems.map(buildBundleChildOrderItem);
  }

  return childItem;
}

/**
 * Convert basket items to CreateOrderItemDto[] for POST /orders. Extracted verbatim from
 * checkout/review/page.tsx handlePlaceOrder, then extended for issue #150: bundle children
 * (item.childItems) are now mapped into the payload's childItems — including each child's
 * ingredientQuantities and specialInstructions — so per-option customizations reach the
 * kitchen ticket. Side-item mapping is unchanged (byte-identical payload for non-bundles).
 */
export function buildOrderItems(items: BasketItemDto[]): CreateOrderItemDto[] {
  return items.map((item) => {
    const orderItem: CreateOrderItemDto = {
      productId: item.productId || '',
      productVariationId: item.productVariationId,
      menuId: item.menuId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      customizationPrice: item.customizationPrice || 0,
      specialInstructions: item.specialInstructions,
      ingredientQuantities: buildIngredientQuantities(item),
    };

    const childItems: CreateOrderItemDto[] = [];

    // Map side items to child items if they exist (pre-existing behaviour, unchanged)
    if (item.selectedSideItems && item.selectedSideItems.length > 0) {
      childItems.push(
        ...item.selectedSideItems.map((sideItem) => ({
          productId: sideItem.id,
          quantity: sideItem.quantity,
          unitPrice: sideItem.price || 0,
          customizationPrice: 0,
        })),
      );
    }

    // Map bundle children (menu options) with their per-option customizations (issue #150)
    if (item.childItems && item.childItems.length > 0) {
      childItems.push(...item.childItems.map(buildBundleChildOrderItem));
    }

    if (childItems.length > 0) {
      orderItem.childItems = childItems;
    }

    return orderItem;
  });
}
