import type { OrderDto, OrderItemDto } from '@/types/order';
import type { OrderAmendmentItemDto } from '@/types/orderAmendment';
import { amendmentItemIdentity } from '@/lib/orderAmendmentItemIdentity';

/** Convert a frozen read snapshot to the write shape without dropping customization metadata. */
export function toAmendmentItemSnapshot(item: OrderItemDto): OrderAmendmentItemDto {
  return cloneAmendmentItem(item);
}

function cloneAmendmentItem(item: OrderItemDto | OrderAmendmentItemDto): OrderAmendmentItemDto {
  const wireFields = item as unknown as Record<string, unknown>;
  const { productId, menuId, productVariationId } = amendmentItemIdentity(item);
  const rawSideItems = Array.isArray(wireFields.sideItems) ? wireFields.sideItems : null;
  const children = rawSideItems?.length
    ? rawSideItems.map((child) => cloneAmendmentItem(child as OrderItemDto))
    : item.childItems?.map(cloneAmendmentItem);
  return {
    ...(productId ? { productId } : {}),
    ...(menuId ? { menuId } : {}),
    ...(productVariationId ? { productVariationId } : {}),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    customizationPrice: item.customizationPrice,
    specialInstructions: item.specialInstructions,
    selectedIngredientIds: item.selectedIngredientIds ? [...item.selectedIngredientIds] : undefined,
    ingredientQuantities: item.ingredientQuantities ? { ...item.ingredientQuantities } : undefined,
    sectionId: item.sectionId,
    ...(children ? { childItems: children } : {}),
    kind: item.kind,
  };
}

export function orderNeedsPreparingOverride(order: OrderDto, hasExistingChanges: boolean): boolean {
  return hasExistingChanges && ['Preparing', 'Ready'].includes(order.status);
}

export function formatAmendmentMinorAmount(
  amount: number,
  currency: string | null | undefined,
  language: string,
): string | null {
  if (!currency || !Number.isFinite(amount)) return null;
  try {
    const formatter = new Intl.NumberFormat(language, { style: 'currency', currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amount / 10 ** fractionDigits);
  } catch (_formatError) {
    // Intentionally ignore invalid Intl currency configuration; the caller renders localized unavailable copy.
  }
  return null;
}

export function orderItemTitle(item: Pick<OrderItemDto, 'productName' | 'menuName' | 'variationName'>): string {
  return item.productName || item.menuName || item.variationName || 'Item';
}
