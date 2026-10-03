import type {
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import {
  categorySelectionCount,
  categoryUnsupportedSelectionCount,
  knownCategoryItemSupport,
  knownCategoryItems,
} from './deliveryChannelMenuSelection';
import { categorySourceView } from './deliveryChannelCategorySource';

interface Props {
  readonly inventory: DeliveryChannelCategoryInventory | null;
  readonly stale: boolean;
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;
  readonly knownCandidates: Parameters<typeof knownCategoryItems>[0];
}

export function deliveryChannelCategorySelectionMetrics({
  inventory,
  stale,
  categoryIds,
  overrides,
  knownCandidates,
}: Readonly<Props>) {
  const { categories, unsupportedSnapshot } = categorySourceView(inventory, stale);
  const savedItems = unsupportedSnapshot ? (inventory?.draft?.items ?? []) : [];
  const knownItems = knownCategoryItems(knownCandidates, savedItems);
  const draftMatchesSource = inventory?.draft?.sourceRevision === inventory?.sourceRevision;
  const keepCandidateSupport = !stale || draftMatchesSource;
  const supportCandidates = keepCandidateSupport ? knownCandidates : [];
  const itemStatuses = keepCandidateSupport ? (inventory?.itemStatuses ?? []) : [];
  const knownSupport = knownCategoryItemSupport(supportCandidates, savedItems, itemStatuses);
  return {
    categories,
    unsupportedSnapshot,
    knownItems,
    selectedCount: categorySelectionCount(categories, categoryIds, overrides),
    unsupportedCount: categoryUnsupportedSelectionCount(
      categories,
      categoryIds,
      overrides,
      knownSupport,
      unsupportedSnapshot,
    ),
  };
}
