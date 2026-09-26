import type { OrderType } from '@/types/order';
import type { MenuDefinition, SelectedMenuOption } from '@/types/menu';
import type { ProductQuoteRequest } from '@/services/productQuoteService';

export const ORDER_TYPE_KEYS: Record<OrderType, string> = {
  DineIn: 'order_type_dine_in',
  Takeaway: 'order_type_takeaway',
  Delivery: 'order_type_delivery',
};

export function hasTemporarySelectionIds(menuDefinition: MenuDefinition): boolean {
  return menuDefinition.sections.some(
    (section) =>
      !section.id ||
      section.id.startsWith('temp-') ||
      section.items.some((item) => !item.id || item.id.startsWith('temp-')),
  );
}

export function toQuoteRequest(selections: readonly SelectedMenuOption[], quantity: number): ProductQuoteRequest {
  return {
    quantity,
    selectedMenuOptions: selections.map((option) => ({
      sectionId: option.sectionId,
      itemId: option.itemId,
      productVariationId: option.productVariationId,
      quantity: option.quantity,
      specialInstructions: option.specialInstructions,
      selectedIngredients: option.selectedIngredients,
      ingredientQuantities: option.ingredientQuantities,
      customizationSelections: option.customizationSelections,
    })),
  };
}

export function optionOrderable(
  option: SelectedMenuOption,
  definition: MenuDefinition,
  channel: OrderType | '',
): boolean {
  const item = definition.sections
    .find((section) => section.id === option.sectionId)
    ?.items.find(
      (candidate) =>
        candidate.productId === option.itemId &&
        (candidate.productVariationId ?? null) === (option.productVariationId ?? null),
    );
  if (!item?.availability) return true;
  return channel ? item.availability.allowedOrderTypes.includes(channel) : item.availability.canOrder;
}
