import type { ProductType } from '@/types/menu';

/** The named partitions in a product's suggested-side list. */
export type SuggestedSideGroup = 'beverages' | 'desserts' | 'accompaniments';

interface TypedSuggestedSideItem {
  type?: ProductType;
}

export interface SuggestedSideGroupDefinition<T> {
  id: SuggestedSideGroup;
  translationKey: `suggested_side_group_${SuggestedSideGroup}`;
  items: T[];
}

const GROUPS: ReadonlyArray<{
  id: SuggestedSideGroup;
  translationKey: `suggested_side_group_${SuggestedSideGroup}`;
}> = [
  { id: 'beverages', translationKey: 'suggested_side_group_beverages' },
  { id: 'desserts', translationKey: 'suggested_side_group_desserts' },
  { id: 'accompaniments', translationKey: 'suggested_side_group_accompaniments' },
];

function groupFor(type: ProductType | undefined): SuggestedSideGroup {
  if (type === 'beverage') return 'beverages';
  if (type === 'dessert') return 'desserts';
  return 'accompaniments';
}

/**
 * Keeps the existing suggested-side payload intact while giving both sheets the same named display
 * groups. Missing `type` deliberately falls back to accompaniments for compatibility with an older
 * backend during the additive contract rollout.
 */
export function groupSuggestedSideItems<T extends TypedSuggestedSideItem>(
  sideItems: readonly T[],
): SuggestedSideGroupDefinition<T>[] {
  return GROUPS.map((group) => ({
    ...group,
    items: sideItems.filter((sideItem) => groupFor(sideItem.type) === group.id),
  })).filter((group) => group.items.length > 0);
}
