import type { SuggestedSideItem } from '@/types/menu';

export interface SelectedSideItemState {
  id: string;
  suggestedSideItemId?: string;
  quantity: number;
  productVariationId?: string | null;
}

/** Prefer the association key; only use a product-only legacy entry when it is unambiguous. */
export function findSelectedSide<T extends SelectedSideItemState>(
  selected: readonly T[],
  side: SuggestedSideItem,
): T | undefined {
  if (side.suggestedSideItemId) {
    const exact = selected.find((item) => item.suggestedSideItemId === side.suggestedSideItemId);
    if (exact) return exact;
  }
  const matching = selected.filter((item) => item.id === side.id && !item.suggestedSideItemId);
  return matching.length === 1 ? matching[0] : undefined;
}
