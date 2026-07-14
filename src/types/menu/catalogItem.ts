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
  /** Starting price — a bundle displays this as a "from" price. */
  price: number;
  isBundle: boolean;
  allergens?: string[];
  isSpecial?: boolean;
  isAvailable?: boolean;
  /** For bundles: the default option names, for a "Includes: Pizza, Cola" card preview. */
  bundleItemNames?: string[];
}
