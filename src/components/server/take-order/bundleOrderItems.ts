import type { Product } from '@/services/serverService';
import type { CreateOrderItemDto } from '@/types/order';
import type { MenuBundleItem, MenuSection, SelectedMenuOption } from '@/types/menu';

export interface BundleOrderSelection {
  sections: readonly MenuSection[];
  selectedOptions: readonly SelectedMenuOption[];
}

export interface WaiterBundleOrderResult {
  selectedOptions: readonly SelectedMenuOption[];
  quantity: number;
  specialInstructions?: string;
  unitPrice: number;
}

/** Build the order-list shape for a menu parent; it remains a ProductId on the staff endpoint. */
export function buildBundleOrderItem(product: Product, bundle: MenuBundleItem, result: WaiterBundleOrderResult) {
  return {
    product,
    quantity: result.quantity,
    notes: result.specialInstructions,
    unitPrice: result.unitPrice,
    bundle: { sections: bundle.menuDefinition.sections, selectedOptions: result.selectedOptions },
  };
}

/** Bundle option rows are child rows with line-absolute quantities, as basket translation uses. */
export function buildBundleChildItems(bundle: BundleOrderSelection, parentQuantity: number): CreateOrderItemDto[] {
  return bundle.selectedOptions.flatMap((option) => {
    const section = bundle.sections.find((candidate) => candidate.id === option.sectionId);
    const selectedItem = section?.items.find((candidate) => candidate.productId === option.itemId);
    if (!selectedItem) return [];

    return [
      {
        productId: option.itemId,
        quantity: parentQuantity * option.quantity,
        unitPrice: selectedItem.additionalPrice,
        specialInstructions: option.specialInstructions,
        selectedIngredientIds: option.selectedIngredients,
        ingredientQuantities: option.ingredientQuantities,
        kind: 'BundleChild' as const,
      },
    ];
  });
}
