import type {
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryItem,
  DeliveryChannelCategoryItemOverride,
  DeliveryChannelCategoryItemOverrideRequest,
  DeliveryChannelCategorySummary,
  DeliveryChannelCategoryDraft,
} from '@/types/deliveryChannelMenuSelection';

export type DeliveryChannelCategoryOverrideMap = Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;

export interface DeliveryChannelSelectionMetrics {
  readonly selectedItemCount: number;
  readonly unsupportedItemCount: number;
}

export function categoryOverrideMap(
  overrides: readonly DeliveryChannelCategoryItemOverride[],
): Record<string, DeliveryChannelCategoryItemOverride> {
  return Object.fromEntries(overrides.map((override) => [override.selectionKey, override]));
}

export function categoryDraftSelection(draft: DeliveryChannelCategoryDraft | null) {
  return {
    categoryIds: new Set(draft?.selectedCategoryIds ?? []),
    overrides: categoryOverrideMap(draft?.itemOverrides ?? []),
  };
}

export function categoryItemIsSelected(
  item: DeliveryChannelCategoryCandidate | DeliveryChannelCategoryItem,
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): boolean {
  return overrides[item.selectionKey]?.selected ?? Boolean(item.categoryId && selectedCategoryIds.has(item.categoryId));
}

export function updateCategoryItemOverride(
  item: DeliveryChannelCategoryCandidate | DeliveryChannelCategoryItem,
  selected: boolean,
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): Record<string, DeliveryChannelCategoryItemOverride> {
  if (!item.categoryId) return { ...overrides };
  const next = { ...overrides };
  if (selected === selectedCategoryIds.has(item.categoryId)) {
    delete next[item.selectionKey];
  } else {
    next[item.selectionKey] = {
      selectionKey: item.selectionKey,
      productId: item.productId,
      variationId: item.variationId,
      categoryId: item.categoryId,
      selected,
      supported: item.supported,
    };
  }
  return next;
}

export function toggleCategorySelection(
  categoryId: string,
  selected: boolean,
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): { readonly categoryIds: Set<string>; readonly overrides: Record<string, DeliveryChannelCategoryItemOverride> } {
  const categoryIds = new Set(selectedCategoryIds);
  if (selected) categoryIds.add(categoryId);
  else categoryIds.delete(categoryId);
  const nextOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, override]) => override.categoryId !== categoryId),
  );
  return { categoryIds, overrides: nextOverrides };
}

export function normalizedCategoryOverrides(
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): DeliveryChannelCategoryItemOverride[] {
  return Object.values(overrides)
    .filter((override) => override.selected !== selectedCategoryIds.has(override.categoryId))
    .sort((left, right) => left.selectionKey.localeCompare(right.selectionKey));
}

export function categoryOverrideRequests(
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): DeliveryChannelCategoryItemOverrideRequest[] {
  return normalizedCategoryOverrides(selectedCategoryIds, overrides).map(
    ({ productId, variationId, categoryId, selected }) => ({ productId, variationId, categoryId, selected }),
  );
}

export function categorySelectionCount(
  categories: readonly DeliveryChannelCategorySummary[],
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): number {
  let count = categories.reduce(
    (total, category) => total + (selectedCategoryIds.has(category.categoryId) ? category.totalItemCount : 0),
    0,
  );
  for (const override of Object.values(overrides)) {
    const categorySelected = selectedCategoryIds.has(override.categoryId);
    if (override.selected !== categorySelected) count += override.selected ? 1 : -1;
  }
  return Math.max(0, count);
}

export function categorySelectionState(
  category: DeliveryChannelCategorySummary,
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): { readonly selected: boolean; readonly indeterminate: boolean; readonly count: number } {
  let count = selectedCategoryIds.has(category.categoryId) ? category.totalItemCount : 0;
  for (const override of Object.values(overrides)) {
    if (override.categoryId !== category.categoryId) continue;
    const baseSelected = selectedCategoryIds.has(category.categoryId);
    if (override.selected !== baseSelected) count += override.selected ? 1 : -1;
  }
  const safeCount = Math.max(0, Math.min(category.totalItemCount, count));
  return {
    selected: safeCount === category.totalItemCount && category.totalItemCount > 0,
    indeterminate: safeCount > 0 && safeCount < category.totalItemCount,
    count: safeCount,
  };
}

export function categoryUnsupportedSelectionCount(
  categories: readonly DeliveryChannelCategorySummary[],
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
  knownItems: ReadonlyMap<string, Pick<DeliveryChannelCategoryItem, 'supported'>>,
  draft: DeliveryChannelCategoryDraft | null,
): number {
  if (draft && categorySelectionMatchesDraft(draft, selectedCategoryIds, overrides)) {
    return draft.categories.reduce((total, category) => total + (category.selectedUnsupportedItemCount ?? 0), 0);
  }

  if (draft) {
    return adjustedDraftUnsupportedCount(categories, selectedCategoryIds, overrides, knownItems, draft);
  }

  let count = categories.reduce(
    (total, category) => total + (selectedCategoryIds.has(category.categoryId) ? category.unsupportedItemCount : 0),
    0,
  );
  for (const override of Object.values(overrides)) {
    const categorySelected = selectedCategoryIds.has(override.categoryId);
    const item = knownItems.get(override.selectionKey);
    if (item?.supported !== false || override.selected === categorySelected) continue;
    count += override.selected ? 1 : -1;
  }
  return Math.max(0, count);
}

function adjustedDraftUnsupportedCount(
  categories: readonly DeliveryChannelCategorySummary[],
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
  knownItems: ReadonlyMap<string, Pick<DeliveryChannelCategoryItem, 'supported'>>,
  draft: DeliveryChannelCategoryDraft,
): number {
  const savedCategoryIds = new Set(draft.selectedCategoryIds);
  const count =
    draft.categories.reduce((total, category) => total + (category.selectedUnsupportedItemCount ?? 0), 0) +
    categoryUnsupportedDelta(categories, selectedCategoryIds, draft, savedCategoryIds) +
    overrideUnsupportedDelta(selectedCategoryIds, overrides, knownItems, draft, savedCategoryIds);
  return Math.max(0, count);
}

function categoryUnsupportedDelta(
  categories: readonly DeliveryChannelCategorySummary[],
  selectedCategoryIds: ReadonlySet<string>,
  draft: DeliveryChannelCategoryDraft,
  savedCategoryIds: ReadonlySet<string>,
): number {
  let delta = 0;
  for (const categoryId of new Set([...savedCategoryIds, ...selectedCategoryIds])) {
    const wasSelected = savedCategoryIds.has(categoryId);
    const isSelected = selectedCategoryIds.has(categoryId);
    if (wasSelected === isSelected) continue;
    const savedCount = draft.categories.find((category) => category.categoryId === categoryId);
    const currentCount = categories.find((category) => category.categoryId === categoryId);
    delta +=
      (isSelected ? (currentCount?.unsupportedItemCount ?? 0) : 0) -
      (wasSelected ? (savedCount?.selectedUnsupportedItemCount ?? 0) : 0);
  }
  return delta;
}

function overrideUnsupportedDelta(
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
  knownItems: ReadonlyMap<string, Pick<DeliveryChannelCategoryItem, 'supported'>>,
  draft: DeliveryChannelCategoryDraft,
  savedCategoryIds: ReadonlySet<string>,
): number {
  const savedOverrides = categoryOverrideMap(draft.itemOverrides);
  let delta = 0;
  for (const selectionKey of new Set([...Object.keys(savedOverrides), ...Object.keys(overrides)])) {
    const saved = savedOverrides[selectionKey];
    const current = overrides[selectionKey];
    const categoryId = current?.categoryId ?? saved?.categoryId;
    if (!categoryId || savedCategoryIds.has(categoryId) !== selectedCategoryIds.has(categoryId)) continue;
    const beforeSelected = saved?.selected ?? savedCategoryIds.has(categoryId);
    const afterSelected = current?.selected ?? selectedCategoryIds.has(categoryId);
    if (beforeSelected === afterSelected) continue;
    const supported = knownItems.get(selectionKey)?.supported ?? current?.supported ?? saved?.supported;
    if (supported === false) delta += afterSelected ? 1 : -1;
  }
  return delta;
}

export function knownCategoryItems(
  pages: readonly DeliveryChannelCategoryCandidate[],
  frozenItems: readonly DeliveryChannelCategoryItem[],
): Map<string, DeliveryChannelCategoryItem | DeliveryChannelCategoryCandidate> {
  return new Map([...frozenItems, ...pages].map((item) => [item.selectionKey, item]));
}

export function knownCategoryItemSupport(
  pages: readonly DeliveryChannelCategoryCandidate[],
  frozenItems: readonly DeliveryChannelCategoryItem[],
  itemStatuses: readonly { readonly selectionKey: string; readonly supported: boolean }[] = [],
): Map<string, Pick<DeliveryChannelCategoryItem, 'supported'>> {
  const known = new Map([...frozenItems, ...pages].map(({ selectionKey, supported }) => [selectionKey, { supported }]));
  for (const { selectionKey, supported } of itemStatuses) known.set(selectionKey, { supported });
  return known;
}

export function categorySelectionMatchesDraft(
  draft: DeliveryChannelCategoryDraft,
  selectedCategoryIds: ReadonlySet<string>,
  overrides: DeliveryChannelCategoryOverrideMap,
): boolean {
  const draftCategoryIds = new Set(draft.selectedCategoryIds);
  if (draftCategoryIds.size !== selectedCategoryIds.size) return false;
  for (const categoryId of draftCategoryIds) if (!selectedCategoryIds.has(categoryId)) return false;
  const draftOverrides = categoryOverrideMap(draft.itemOverrides);
  const currentOverrides = normalizedCategoryOverrides(selectedCategoryIds, overrides);
  return (
    currentOverrides.length === Object.keys(draftOverrides).length &&
    currentOverrides.every((item) => {
      const saved = draftOverrides[item.selectionKey];
      return saved?.selected === item.selected && saved.categoryId === item.categoryId;
    })
  );
}
