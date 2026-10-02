import type { DeliveryChannelCatalogue } from '@/types/deliveryChannelCatalogue';
import { candidateIdentity } from './deliveryChannelCandidateIdentity';

export function deliveryChannelMappingSelections(catalogue: DeliveryChannelCatalogue): Record<string, string> {
  return Object.fromEntries(
    catalogue.items.map((item) => [
      item.providerItemId,
      item.productId ? candidateIdentity(item.productId, item.variationId) : '',
    ]),
  );
}

export function parseDeliveryChannelCandidateIdentity(
  value: string,
): { productId: string; variationId: string | null } | null {
  const split = value.lastIndexOf('::');
  return split < 1 ? null : { productId: value.slice(0, split), variationId: value.slice(split + 2) || null };
}

export function deliveryChannelDraftStatus(
  catalogue: DeliveryChannelCatalogue | null,
  selected: Readonly<Record<string, string>>,
) {
  const identities = Object.values(selected).filter(Boolean);
  return {
    duplicateSelection: new Set(identities).size !== identities.length,
    dirty: Boolean(
      catalogue &&
      (!catalogue.draftRevision ||
        JSON.stringify(selected) !== JSON.stringify(deliveryChannelMappingSelections(catalogue))),
    ),
  };
}
