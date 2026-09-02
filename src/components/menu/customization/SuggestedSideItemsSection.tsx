'use client';

import SuggestedSideItemGroup from './SuggestedSideItemGroup';
import { groupSuggestedSideItems } from '@/utils/suggestedSideItems';
import type { SuggestedSideItem } from '@/types/menu';

interface SuggestedSideItemsSectionProps {
  sideItems: SuggestedSideItem[];
  selectedSideItems: Array<{ id: string; quantity: number }>;
  onSelectionChange: (selected: Array<{ id: string; quantity: number }>) => void;
  currentLanguage: string;
  /** Passed straight through — see `SuggestedSideItemGroup`. */
  variant?: 'disclosure' | 'plain';
}

/** Optional drinks, desserts and accompaniments, partitioned without changing their basket payload. */
export default function SuggestedSideItemsSection({
  sideItems,
  selectedSideItems,
  onSelectionChange,
  variant,
}: Readonly<SuggestedSideItemsSectionProps>) {
  if (!sideItems.length) return null;

  const handleAdd = (sideItemId: string) => {
    const existing = selectedSideItems.find((item) => item.id === sideItemId);
    onSelectionChange(
      existing
        ? selectedSideItems.map((item) => (item.id === sideItemId ? { ...item, quantity: item.quantity + 1 } : item))
        : [...selectedSideItems, { id: sideItemId, quantity: 1 }],
    );
  };
  const handleRemove = (sideItemId: string) => {
    const existing = selectedSideItems.find((item) => item.id === sideItemId);
    if (!existing) return;
    onSelectionChange(
      existing.quantity > 1
        ? selectedSideItems.map((item) => (item.id === sideItemId ? { ...item, quantity: item.quantity - 1 } : item))
        : selectedSideItems.filter((item) => item.id !== sideItemId),
    );
  };

  return groupSuggestedSideItems(sideItems).map((group) => (
    <SuggestedSideItemGroup
      key={group.id}
      group={group}
      selectedSideItems={selectedSideItems}
      onAdd={handleAdd}
      onRemove={handleRemove}
      variant={variant}
    />
  ));
}
