import type { OrderItemDto, OrderItemIngredientDto } from '@/types/order';
import { orderItemsForDisplay } from '@/utils/orderItemDisplay';

const ROLE_ORDER = {
  Menu: 0,
  Dish: 1,
  RequiredChoice: 2,
  Extra: 3,
  Ingredient: 4,
  Sauce: 5,
  Unknown: 6,
  Side: 7,
  Drink: 8,
} as const;

/** Only frozen IDs attach siblings to a dish. Invalid links remain visible in their original scope. */
export function receiptItems(items: readonly OrderItemDto[]): OrderItemDto[] {
  const copies = items.map((item) => ({ ...item, sideItems: receiptItems(item.sideItems ?? []) }));
  const byId = new Map(copies.map((item) => [item.id, item]));
  const owners = new Map<string, string>();
  for (const item of copies) {
    const targetId = item.parentComponentOrderItemId;
    if (targetId && targetId !== item.id && byId.has(targetId)) owners.set(item.id, targetId);
  }
  const cyclic = (id: string) => {
    const seen = new Set<string>();
    let cursor: string | undefined = id;
    while (cursor) {
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      cursor = owners.get(cursor);
    }
    return false;
  };
  const attached = new Set<string>();
  for (const item of copies) {
    const owner = owners.get(item.id);
    if (!owner || cyclic(item.id)) continue;
    byId.get(owner)!.sideItems.push(item);
    attached.add(item.id);
  }
  const sort = (rows: OrderItemDto[]): OrderItemDto[] => {
    const grouped = orderItemsForDisplay(rows);
    return grouped
      .map((item, index) => ({ item: { ...item, sideItems: sort(item.sideItems ?? []) }, index }))
      .sort((a, b) => {
        const priority =
          ROLE_ORDER[a.item.compositionRole ?? 'Unknown'] - ROLE_ORDER[b.item.compositionRole ?? 'Unknown'];
        const authored =
          (a.item.presentationOrder ?? Number.MAX_SAFE_INTEGER) - (b.item.presentationOrder ?? Number.MAX_SAFE_INTEGER);
        return priority || authored || a.index - b.index;
      })
      .map(({ item }) => item);
  };
  return sort(copies.filter((item) => !attached.has(item.id)));
}

export type ReceiptTranslate = (key: string, fallback: string) => string;
export const receiptFallback: ReceiptTranslate = (_key, fallback) => fallback;

/** A context label on a choice describes its owner, not the choice's own frozen name. */
export function receiptItemName(item: OrderItemDto, fallback = 'Item'): string {
  const name = item.productName || item.menuName || fallback;
  return item.compositionRole === 'Dish' ? item.presentationLabel || name : name;
}

export function receiptOrderTypeLabel(type: string | undefined, translate: ReceiptTranslate = receiptFallback): string {
  switch (type) {
    case 'DineIn':
      return translate('cashier.workspace.channel_dine_in', 'Dine In');
    case 'Takeaway':
      return translate('cashier.workspace.channel_takeaway', 'Takeaway');
    case 'Delivery':
      return translate('cashier.workspace.channel_delivery', 'Delivery');
    default:
      return type || 'Unknown';
  }
}

export function quantityScopeSuffix(
  row: Pick<OrderItemDto | OrderItemIngredientDto, 'quantityBasis' | 'configurationScope'>,
  parentQuantity: number,
  translate: ReceiptTranslate = receiptFallback,
): string {
  if (
    parentQuantity > 1 &&
    row.quantityBasis === 'PerParentUnit' &&
    row.configurationScope === 'SharedAcrossParentUnits'
  ) {
    return ` (${translate('receipt.quantity.each', 'each')})`;
  }
  return '';
}
