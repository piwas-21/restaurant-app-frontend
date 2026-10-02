import type { DeliveryChannelCatalogueCandidate, DeliveryChannelMappingRow } from '@/types/deliveryChannelCatalogue';
import { candidateIdentity } from './deliveryChannelCandidateIdentity';

/** Project the complete draft before filtering or paging; provider readback stays unchanged. */
export function deliveryChannelDraftRows(
  rows: readonly DeliveryChannelMappingRow[],
  selected: Readonly<Record<string, string>>,
  candidates: readonly DeliveryChannelCatalogueCandidate[],
): DeliveryChannelMappingRow[] {
  const byIdentity = new Map(
    candidates.map((candidate) => [candidateIdentity(candidate.productId, candidate.variationId), candidate]),
  );
  return rows.map((row) => {
    const saved = row.productId ? candidateIdentity(row.productId, row.variationId) : '';
    const identity = selected[row.providerItemId] ?? saved;
    if (identity === saved) return row;
    if (!identity)
      return {
        ...row,
        productId: null,
        variationId: null,
        productName: null,
        variationName: null,
        tenantPriceMinor: null,
        available: false,
        mappingStatus: row.mappingStatus === 'blocked' ? 'blocked' : 'unmapped',
      };
    const candidate = byIdentity.get(identity);
    if (!candidate)
      return {
        ...row,
        productName: null,
        variationName: null,
        tenantPriceMinor: null,
        mappingStatus: 'blocked',
        blockReason: 'ReviewRequired',
      };
    return {
      ...row,
      productId: candidate.productId,
      variationId: candidate.variationId,
      productName: candidate.name,
      variationName: candidate.variationName,
      tenantPriceMinor: candidate.priceMinor,
      available: candidate.available,
      mappingStatus: candidate.supported && row.mappingStatus !== 'blocked' ? 'mapped' : 'blocked',
      blockReason: candidate.supported ? row.blockReason : candidate.blockReason,
    };
  });
}
