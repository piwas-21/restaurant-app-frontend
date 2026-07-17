import { useState, useEffect } from 'react';
import type { FeaturedSpecial, FeaturedSpecialResponse } from '@/types/menu';
import { getFeaturedSpecial } from '@/services/menuService';

/**
 * Loads today's featured special for the menu banner.
 *
 * Adding it is no longer this hook's job (menu-bundles redesign #175, slice 6): both the banner's
 * Add and its Details now open the shared `ItemCustomizationSheet` by product id, which fetches the
 * detail, applies the one base-recipe default rule, prices the line backend-faithfully, and adds
 * straight to the cart when the product has no options. That replaced this hook's own
 * has-customization check + its `ProductCustomization` add path, and the two hand-built product
 * literals `MenuModals` fed to the retired `CustomizationModal` / `ProductDetailsModal`.
 */
export function useFeaturedSpecial() {
  const [featuredSpecial, setFeaturedSpecial] = useState<FeaturedSpecial | null>(null);

  useEffect(() => {
    const loadFeaturedSpecial = async () => {
      try {
        const response = (await getFeaturedSpecial()) as FeaturedSpecialResponse;
        if (response.success && response.data) {
          setFeaturedSpecial(response.data);
        }
      } catch {
        // Silently fail if featured special cannot be loaded — the banner just doesn't render.
      }
    };

    // Internal try/catch absorbs errors — `void` for fire-and-forget.
    void loadFeaturedSpecial();
  }, []);

  return { featuredSpecial };
}
