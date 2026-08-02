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

/**
 * `'editable'`, or the reason it is not. A union rather than a boolean-plus-reason pair so the two
 * halves cannot disagree — there is no way to express "not editable, no reason" or the reverse.
 */
export type PriceEditability = 'editable' | 'variations' | 'bundle';

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
  /**
   * Whether the card's inline price quick-edit applies, and when it does NOT, why.
   *
   * A plain boolean used to live here, and the absence it produced was silent: `AdminPriceEditor`
   * rendered `null`, so an admin saw the control on some items and nothing at all on others, with
   * no way to tell a deliberate refusal from a bug. That is how it was reported.
   *
   * `'variations'` — the card price is a derived "from" value; the real prices live per variation.
   * `'bundle'`     — a combo's price is composed from its items, and this editor writes a product's
   *                  base price, which a combo does not have.
   *
   * NOT the backend's verdict, despite what this component's doc comment claimed until 2026-08-02:
   * `PriceEditable` does not exist anywhere in the backend. It is derived in `utils/catalogItem.ts`
   * from data the card already has.
   */
  priceEditability?: PriceEditability;
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
