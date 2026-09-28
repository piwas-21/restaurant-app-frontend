import type { ItemAvailability, MenuBundleItem } from '@/types/menu';
import type { OfferMode } from '@/types/menu/offerFamily';

/**
 * Options for opening the customization sheet (`useItemCustomizationSheet` /
 * `useCatalogSheet`). Its own module so both the hooks and the menu cards can
 * import the type without dragging in the hook.
 */
export interface OpenSheetOptions {
  /**
   * Always open the sheet, skipping the no-options quick-add. Set by the "Details" and title
   * affordances, whose job is to SHOW the item — never to add it. "Add to Order" leaves this unset,
   * so a simple item still adds straight to the cart.
   */
  forceSheet?: boolean;
  /**
   * The list's per-order-type verdict remains authoritative for the parent item. Product-detail
   * requests also send the current channel so nested customization memberships resolve correctly.
   */
  availability?: ItemAvailability;
  /** Variation selected in the offer-family step; avoids asking for the same size twice. */
  selectedVariationId?: string | null;
  /** The family purchase mode selected before this sheet opened. */
  offerMode?: OfferMode;
  /** Active family filters, so the mode step only offers matching underlying targets. */
  offerFamilyFilterIds?: ReadonlySet<string>;
}

export interface UseItemCustomizationSheetArgs {
  onBundleDetected?: (bundle: MenuBundleItem, opts?: Pick<OpenSheetOptions, 'availability' | 'offerMode'>) => void;
  onAdded?: () => void;
  onLineAdded?: () => Promise<void>;
}
