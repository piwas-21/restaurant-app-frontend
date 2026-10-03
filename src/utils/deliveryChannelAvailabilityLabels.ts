import type { DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';
import type {
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryItem,
} from '@/types/deliveryChannelMenuSelection';

export function availabilityIdentity(productId: string, variationId: string | null): string {
  return JSON.stringify([productId, variationId]);
}

export function deliveryChannelAvailabilityLabels(
  mappings: readonly DeliveryChannelMappingRow[],
  frozenItems: readonly DeliveryChannelCategoryItem[],
  knownItems: readonly (DeliveryChannelCategoryItem | DeliveryChannelCategoryCandidate)[],
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (const row of mappings) {
    if (!row.productId || !row.productName) continue;
    labels.set(availabilityIdentity(row.productId, row.variationId), row.productName);
  }
  for (const item of frozenItems) {
    labels.set(availabilityIdentity(item.productId, item.variationId), item.name);
  }
  for (const item of knownItems) {
    labels.set(availabilityIdentity(item.productId, item.variationId), item.name);
  }
  return labels;
}
