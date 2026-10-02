import { candidateIdentity } from './deliveryChannelCandidateIdentity';
import type { DeliveryChannelCatalogueCandidate } from '@/types/deliveryChannelCatalogue';

/** Merges fetched identities without changing the currently visible search result set. */
export function mergeDeliveryChannelCandidateCache(
  previous: readonly DeliveryChannelCatalogueCandidate[],
  incoming: readonly DeliveryChannelCatalogueCandidate[],
): readonly DeliveryChannelCatalogueCandidate[] {
  const candidates = new Map(previous.map((item) => [candidateIdentity(item.productId, item.variationId), item]));
  incoming.forEach((item) => candidates.set(candidateIdentity(item.productId, item.variationId), item));
  return [...candidates.values()];
}
