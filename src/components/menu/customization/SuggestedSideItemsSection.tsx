'use client';

import SuggestedSideItemGroup from './SuggestedSideItemGroup';
import { groupSuggestedSideItems, type SuggestedSideGroup } from '@/utils/suggestedSideItems';
import type { SuggestedSideItem } from '@/types/menu';
import { findSelectedSide } from '@/utils/selectedSideItem';

interface SuggestedSideItemsSectionProps {
  sideItems: SuggestedSideItem[];
  selectedSideItems: Array<{
    id: string;
    suggestedSideItemId?: string;
    quantity: number;
    productVariationId?: string | null;
  }>;
  onSelectionChange: (
    selected: Array<{ id: string; suggestedSideItemId?: string; quantity: number; productVariationId?: string | null }>,
  ) => void;
  currentLanguage: string;
  /** Passed straight through — see `SuggestedSideItemGroup`. */
  variant?: 'disclosure' | 'plain' | 'bare';
  /**
   * Render only this partition. The guided flow gives each group its own step, so it asks for one
   * at a time. Omitted, every partition renders — which is what a `sides` step with no `sideGroup`
   * falls back to, and the only path that still exercises it. See `ProductSheetBody`.
   */
  onlyGroup?: SuggestedSideGroup;
}

/** Optional drinks, desserts and accompaniments, partitioned without changing their basket payload. */
export default function SuggestedSideItemsSection({
  sideItems,
  selectedSideItems,
  onSelectionChange,
  variant,
  onlyGroup,
}: Readonly<SuggestedSideItemsSectionProps>) {
  if (!sideItems.length) return null;

  const handleAdd = (sideItem: SuggestedSideItem) => {
    const existing = findSelectedSide(selectedSideItems, sideItem);
    onSelectionChange(
      existing
        ? selectedSideItems.map((item) => (item === existing ? { ...item, quantity: item.quantity + 1 } : item))
        : [...selectedSideItems, { id: sideItem.id, suggestedSideItemId: sideItem.suggestedSideItemId, quantity: 1 }],
    );
  };
  const handleRemove = (sideItem: SuggestedSideItem) => {
    const existing = findSelectedSide(selectedSideItems, sideItem);
    if (!existing) return;
    onSelectionChange(
      existing.quantity > 1
        ? selectedSideItems.map((item) => (item === existing ? { ...item, quantity: item.quantity - 1 } : item))
        : selectedSideItems.filter((item) => item !== existing),
    );
  };

  return groupSuggestedSideItems(sideItems)
    .filter((group) => onlyGroup === undefined || group.id === onlyGroup)
    .map((group) => (
      <SuggestedSideItemGroup
        key={group.id}
        group={group}
        selectedSideItems={selectedSideItems}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onVariationChange={(sideItem, productVariationId) => {
          const existing = findSelectedSide(selectedSideItems, sideItem);
          if (!existing) return;
          onSelectionChange(
            selectedSideItems.map((item) => (item === existing ? { ...item, productVariationId } : item)),
          );
        }}
        variant={variant}
      />
    ));
}
