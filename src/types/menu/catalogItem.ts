import type { ProductIngredient, DietaryTag, MenuItemImage } from './shared';
import type { ItemAvailability } from './availability';

/**
 * CatalogItem — the unified card view-model for the merged `MenuCard` (menu-bundles redesign #175,
 * slice 6). A single mapper normalises both a plain product (`MenuItem`) and a combo
 * (`MenuBundleItem`) into this one summary shape so the browse grid stops forking into two card
 * components + two type families. The customization sheet fetches the full detail separately when
 * opened; this carries only what a card renders.
 */
export type CatalogItemKind = 'product' | 'bundle';

export interface CatalogItem {
  kind: CatalogItemKind;
  id: string;
  /** Base name/description (fallbacks); the card resolves the localized value from `content`. */
  name: string;
  description?: string;
  content?: Partial<Record<string, { name: string; description?: string }>>;
  imageUrl?: string;
  /** How many images the item has — the card badges the count. */
  imageCount?: number;
  /** All of the item's images, for the enlarge-on-click gallery lightbox. */
  images?: MenuItemImage[];
  /** Starting price — a bundle displays this as a "from" price. */
  price: number;
  isBundle: boolean;
  /** Products with no variations only: the base price is safe to quick-edit inline on the card. */
  priceEditable?: boolean;
  allergens?: string[];
  isSpecial?: boolean;
  isAvailable?: boolean;
  /** Products only: the card's summary line resolves these to localized names. */
  detailedIngredients?: ProductIngredient[];
  /** Products only: legacy fallback when `detailedIngredients` is absent. */
  ingredients?: string[];
  /** Products only — bundles carry no dietary tags. */
  dietaryTags?: DietaryTag[];
  /** Bundles only: the default option names, for an "Includes: Pizza + Cola" card summary. */
  bundleItemNames?: string[];
  /**
   * Server-resolved per-order-type availability, driving the card's chip / dimmed state — for
   * products AND, since ORDER-TYPE-AVAILABILITY-PLAN §9.2, for bundles: `GetMenuBundlesQuery` now
   * binds `RequestedOrderType` and both bundle commands store a mask.
   *
   * Still optional, and `undefined` still means unrestricted: a backend that predates §9.2 omits it,
   * and permissive-on-missing-data is this feature's invariant everywhere.
   *
   * A bundle's verdict judges the BUNDLE, not its options — a combo whose optional side is
   * takeaway-only stays orderable on dine-in, because the guest picks another side. A blocked
   * COMPONENT is refused at add time by the server (§9.3).
   */
  availability?: ItemAvailability;
}
