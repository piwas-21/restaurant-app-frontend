import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import type {
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import { categoryItemIsSelected, categoryOverrideRequests } from './deliveryChannelMenuSelection';
import { sortCategoryIds } from './categoryIdProtocolOrder';

export { sortCategoryIds } from './categoryIdProtocolOrder';

export function categoryInventoryIsSourceMismatched(inventory: DeliveryChannelCategoryInventory | null): boolean {
  return Boolean(
    inventory &&
    (inventory.sourceChanged || (inventory.draft && inventory.draft.sourceRevision !== inventory.sourceRevision)),
  );
}

export function categorySourceView(inventory: DeliveryChannelCategoryInventory | null, stale: boolean) {
  const freezeDraft = stale && categoryInventoryIsSourceMismatched(inventory);
  const categories = freezeDraft && inventory?.draft ? inventory.draft.categories : (inventory?.categories ?? []);
  const draftMatchesSource = Boolean(inventory && inventory.draft?.sourceRevision === inventory.sourceRevision);
  const unsupportedSnapshot = inventory?.draft && (draftMatchesSource || freezeDraft) ? inventory.draft : null;
  return {
    categories,
    unsupportedSnapshot,
  };
}

export async function refreshCategoryReferenceSnapshot(
  inventory: DeliveryChannelCategoryInventory,
  categoryIds: ReadonlySet<string>,
  overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>,
): Promise<DeliveryChannelCategoryInventory> {
  const removedItems = new Map((inventory.removedItems ?? []).map((item) => [item.selectionKey, item]));
  const removedOverrides = new Map((inventory.removedItemOverrides ?? []).map((item) => [item.selectionKey, item]));
  const itemReferences = uniqueItemReferences(
    (inventory.draft?.items ?? [])
      .filter((item) => categoryItemIsSelected(item, categoryIds, overrides))
      .map(({ productId, variationId, categoryId }) => ({ productId, variationId, categoryId })),
  );
  const changes = await deliveryChannelManagementService.checkCategoryReferences({
    expectedSourceRevision: inventory.sourceRevision,
    categoryIds: sortCategoryIds(categoryIds),
    itemReferences,
    itemOverrides: categoryOverrideRequests(categoryIds, overrides),
  });

  for (const item of changes.removedItems) removedItems.set(item.selectionKey, item);
  for (const item of changes.removedItemOverrides) removedOverrides.set(item.selectionKey, item);
  return {
    ...inventory,
    sourceRevision: changes.sourceRevision,
    language: changes.language,
    maximumCategoryCount: changes.maximumCategoryCount,
    maximumItemOverrideCount: changes.maximumItemOverrideCount,
    categories: changes.categories,
    sourceChanged:
      inventory.sourceChanged || changes.sourceChanged || changes.sourceRevision !== inventory.sourceRevision,
    removedCategoryIds: [...new Set([...(inventory.removedCategoryIds ?? []), ...changes.removedCategoryIds])],
    removedItems: [...removedItems.values()],
    removedItemOverrides: [...removedOverrides.values()],
    itemStatuses: changes.itemStatuses,
  };
}

function uniqueItemReferences<T extends { readonly productId: string; readonly variationId: string | null }>(
  items: readonly T[],
): T[] {
  const byIdentity = new Map(items.map((item) => [JSON.stringify([item.productId, item.variationId]), item]));
  return [...byIdentity.values()];
}
