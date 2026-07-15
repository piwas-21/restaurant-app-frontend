'use client';

import { useCallback } from 'react';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { CatalogItem, MenuBundleItem } from '@/types/menu';

interface UseCatalogSheetArgs {
  /** Resolves a bundle id back to its full definition (the browse list already carries it). */
  findBundle?: (id: string) => MenuBundleItem | undefined;
  /** Fired after a successful add — the menu page uses it to animate the cart button. */
  onAdded?: () => void;
}

/**
 * One entry point onto the shared customization sheet (menu-bundles redesign #175, slice 6): give it
 * a catalog card or a bare product id and it opens the right body. Owns both controllers so callers
 * never pick between them, and so a product id that turns out to be a combo is routed rather than
 * mis-rendered.
 *
 * Only one sheet is ever open, so rendering both is safe — each returns null while closed.
 */
export function useCatalogSheet({ findBundle, onAdded }: UseCatalogSheetArgs = {}) {
  const bundle = useBundleCustomizationSheet({ onAdded });
  const product = useItemCustomizationSheet({ onBundleDetected: bundle.openForBundle, onAdded });

  // Depend on the individual openers, not the controller objects: each hook returns a fresh object
  // every render, so `[product]` would rebuild these callbacks every render and the memo would
  // never hit. The openers themselves are `useCallback`-stable.
  const { openForProduct } = product;
  const { openForBundle } = bundle;

  /** Open by id. Fetches the detail, and routes to the bundle body if the id is a combo. */
  const openForProductId = useCallback(
    (productId: string) => {
      void openForProduct(productId);
    },
    [openForProduct],
  );

  const openForCatalogItem = useCallback(
    (item: CatalogItem) => {
      if (!item.isBundle) {
        openForProductId(item.id);
        return;
      }

      // The browse list already carries the full menuDefinition, so a combo opens without a fetch.
      // A miss falls back to the id path, which re-fetches and routes back here via onBundleDetected.
      const found = findBundle?.(item.id);
      if (found) {
        openForBundle(found);
        return;
      }
      openForProductId(item.id);
    },
    [openForBundle, findBundle, openForProductId],
  );

  return { product, bundle, openForCatalogItem, openForProductId };
}
