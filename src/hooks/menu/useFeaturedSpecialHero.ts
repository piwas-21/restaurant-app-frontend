'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isItemBlocked, useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useTrackItemBlocked } from '@/hooks/menu/useTrackItemBlocked';
import { toCatalogItemFromFeaturedSpecial } from '@/utils/catalogItem';
import type { AvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import type { CatalogItem, FeaturedSpecial } from '@/types/menu';

export interface FeaturedSpecialHero {
  /** The per-order-type notice to hand `MenuCardAvailability`, or null when there is nothing to say. */
  availabilityNotice: AvailabilityNotice | null;
  /** Should the hero recede and drop its "Add to Order"? */
  isBlocked: boolean;
  /** Id for the reason paragraph, folded into the section's accessible name while blocked. */
  reasonId: string;
  /** Localized name/description, resolved from `content` with the base value as fallback. */
  itemName: string;
  description?: string;
  /** The displayed base price, reflecting an admin inline edit until the prop resyncs. */
  price: number;
  onPriceChange: (price: number) => void;
  /** The hero's item as `AdminMenuCardControls` / `AdminPriceEditor` consume it. */
  adminItem: CatalogItem;
}

/**
 * Everything the Chef's Special hero DECIDES, so that classic and craft can look nothing alike
 * without deciding it twice.
 *
 * This split is not stylistic. `CraftMenuCard` was written as standalone DOM that re-derived the
 * blocked state from `availabilityNotice?.tone` alone, and it diverged from the hero, which also
 * checked `canOrder === false` — so a server refusal with no notice to show for it dimmed the
 * banner and left the grid below it orderable (BUGS-IMPROVEMENTS-PLAN E6). Three surfaces deriving
 * one verdict separately is how they drift; the fix there was a shared predicate, and the fix here
 * is to not open the second copy at all.
 *
 * Templates own the DOM and the CSS. They own none of this.
 */
export function useFeaturedSpecialHero(special: FeaturedSpecial): FeaturedSpecialHero {
  const { i18n } = useTranslation();
  // The hero is an ENTRY POINT — a guest can order straight from it — so it carries the same
  // verdict, the same notice component and the same rule as a catalog card (G7).
  const availabilityNotice = useItemAvailabilityNotice(special.availability);
  useTrackItemBlocked(special.id, availabilityNotice, 'featured_special');

  // Locally reflect an admin inline price edit; resync if the special changes (the card pattern).
  const [price, setPrice] = useState(special.basePrice);
  useEffect(() => setPrice(special.basePrice), [special.basePrice]);

  const lang = (i18n.language || 'en').split('-')[0];

  return {
    availabilityNotice,
    // The SERVER's verdict is the gate, not our ability to render a reason for it — the same
    // predicate `ItemCustomizationSheet` uses. `useItemAvailabilityNotice` returns null while the
    // enabled-channel list loads AND for `reason: 'Unavailable'`, and unlike a card this hero is
    // NOT filtered by `isVisible` (the featured query filters on IsActive, never IsAvailable), so
    // an unavailable special reaches here with `canOrder: false` and no notice to show for it.
    isBlocked: isItemBlocked(special.availability, availabilityNotice),
    reasonId: `featured-special-availability-${special.id}`,
    itemName: special.content?.[lang]?.name || special.content?.en?.name || special.name,
    description: special.content?.[lang]?.description || special.content?.en?.description || special.description,
    price,
    onPriceChange: setPrice,
    adminItem: toCatalogItemFromFeaturedSpecial(special),
  };
}
