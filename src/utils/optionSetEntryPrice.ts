import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';

export function optionSetEntryPrice(kind: OptionSetKind, entry: OptionSetEntry): number {
  if (kind === 'bundleChoice') return entry.additionalPrice;
  if (kind === 'ingredient' || kind === 'sauce') return entry.price;
  return 0;
}
