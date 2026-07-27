'use client';

import { useCallback } from 'react';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
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

  /**
   * Open by id. Fetches the detail, and routes to the bundle body if the id is a combo.
   *
   * **The blocked ⇒ forceSheet rule lives HERE, not in a caller.** The no-options quick-add path
   * never opens anything — it adds straight to the cart — so an entry point that hands over a
   * blocked verdict without forcing the sheet has handed it somewhere nobody reads. It used to sit
   * in `openForCatalogItem`, which made it true for cards and false for the featured-special banner
   * (G7): the same "unreachable from the current callers" reasoning that produced §9.10 in the first
   * place. Gating on the SERVER's `canOrder` deliberately, not on "does a notice render" — the
   * notice is null while the enabled-channel list loads.
   */
  const openForProductId = useCallback(
    (productId: string, opts?: OpenSheetOptions) => {
      const blocked = opts?.availability?.canOrder === false;
      // `openForProduct` catches its own failures and surfaces a snackbar, so this should never
      // fire — but the promise still has to be consumed, and logging keeps a future throw loud
      // rather than swallowing it.
      openForProduct(productId, { ...opts, forceSheet: opts?.forceSheet || blocked }).catch((error) =>
        console.error('Failed to open the customization sheet:', error),
      );
    },
    [openForProduct],
  );

  const openForCatalogItem = useCallback(
    (item: CatalogItem, opts?: OpenSheetOptions) => {
      if (!item.isBundle) {
        // Carry the card's own per-order-type verdict in, so the sheet cannot offer an add the card
        // just refused (§9.10). Bundles have no verdict to carry (§9.2).
        //
        // The blocked ⇒ forceSheet rule is applied by `openForProductId` for every entry point, so
        // all this has to do is carry the card's verdict in.
        openForProductId(item.id, { ...opts, availability: item.availability });
        return;
      }

      // The browse list already carries the full menuDefinition, so a combo opens without a fetch.
      // A miss falls back to the id path, which re-fetches and routes back here via onBundleDetected.
      // (Bundles always open their sheet, so `opts.forceSheet` is a product-only concern.)
      const found = findBundle?.(item.id);
      if (found) {
        openForBundle(found);
        return;
      }
      openForProductId(item.id, opts);
    },
    [openForBundle, findBundle, openForProductId],
  );

  return { product, bundle, openForCatalogItem, openForProductId };
}
