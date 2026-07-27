import { useState, useEffect } from 'react';
import type { FeaturedSpecial, FeaturedSpecialResponse } from '@/types/menu';
import { getFeaturedSpecial } from '@/services/menuService';
import { useOrderType } from '@/contexts/OrderTypeContext';

/**
 * Loads today's featured special for the menu banner.
 *
 * Adding it is no longer this hook's job (menu-bundles redesign #175, slice 6): both the banner's
 * Add and its Details now open the shared `ItemCustomizationSheet` by product id, which fetches the
 * detail, applies the one base-recipe default rule, prices the line backend-faithfully, and adds
 * straight to the cart when the product has no options. That replaced this hook's own
 * has-customization check + its `ProductCustomization` add path, and the two hand-built product
 * literals `MenuModals` fed to the retired `CustomizationModal` / `ProductDetailsModal`.
 *
 * **The channel is part of the request (G7).** The banner is an entry point — a guest can order
 * straight from it — and without `RequestedOrderType` the server resolves against "no channel
 * chosen", which is orderable by design. So the hero would have offered an item the catalog card
 * two rows below it refuses.
 */
export function useFeaturedSpecial() {
  const [featuredSpecial, setFeaturedSpecial] = useState<FeaturedSpecial | null>(null);
  const { state, hydrated } = useOrderType();
  const orderType = state.orderType;

  useEffect(() => {
    // `orderType` is null both for "no channel chosen" and for "not read back from localStorage
    // yet", and the two are indistinguishable without this gate. Fetching early makes a returning
    // guest load the banner twice and watch a blocked special flip orderable→blocked (the same
    // trap S4 hit on the grid).
    if (!hydrated) return;

    let active = true;
    const loadFeaturedSpecial = async () => {
      try {
        const response = (await getFeaturedSpecial(orderType)) as FeaturedSpecialResponse;
        if (!active) return;
        // Clear on a miss rather than keeping what is on screen. Keeping it would leave the PREVIOUS
        // channel's verdict — usually the permissive one — driving the banner after a switch whose
        // refetch failed, which is exactly the "two resolutions, two moments, one of them stale"
        // state §9.10 exists to prevent. `getFeaturedSpecial` swallows network errors into
        // `{ success: true, data: null }`, so this branch IS the failure path, not just "no special".
        setFeaturedSpecial(response.success && response.data ? response.data : null);
      } catch {
        // Silently fail if featured special cannot be loaded — the banner just doesn't render.
      }
    };

    // Internal try/catch absorbs errors — `void` for fire-and-forget.
    void loadFeaturedSpecial();
    // A switch must RE-RESOLVE the verdict: the item did not change, but whether this guest can
    // order it did. `orderType` is a plain string|null, so this is a value dependency.
    return () => {
      active = false;
    };
  }, [hydrated, orderType]);

  return { featuredSpecial };
}
