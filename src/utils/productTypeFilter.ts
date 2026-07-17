/**
 * Narrows a product query by type. Mirrors the backend `GetProductsQuery` contract
 * (backend #189): an unfiltered query hides Menu bundles for the customer catalog,
 * `includeMenus` opts into a mixed list, and an explicit `type` always wins over it.
 */
export interface ProductTypeQuery {
  /** A `ProductType` enum NAME (e.g. 'Menu'). Query-string enum binding is by name. */
  type?: 'Menu';
  /** Opt into a mixed list of items AND Menu bundles. Ignored when `type` is set. */
  includeMenus?: boolean;
}

/**
 * The admin catalog's Type filter (redesign #176, slice 7). Replaces the hardcoded
 * Products/Bundles tab fork, which spelled the item-vs-bundle discriminator three
 * different ways across four sites and could disagree with itself.
 */
export type MenuTypeFilter = 'all' | 'items' | 'bundles';

export const MENU_TYPE_FILTERS: readonly MenuTypeFilter[] = ['all', 'items', 'bundles'] as const;

/** The i18n key for each chip. All three already exist in every locale. */
export const MENU_TYPE_FILTER_LABEL_KEYS: Record<MenuTypeFilter, string> = {
  all: 'all_dish_types_filter',
  items: 'items',
  bundles: 'menu_bundles',
};

/**
 * The wire value a product's `type` takes for a Menu bundle. The backend enum is
 * `ProductType.Menu` with `[EnumMember(Value = "menu")]`, so responses carry the
 * camelCase form while query-string binding uses the enum NAME ('Menu').
 */
export const MENU_BUNDLE_TYPE = 'menu';

/** The single place that decides whether a catalog row is a bundle or a plain item. */
export function isMenuBundle(product: { type?: string | null } | null | undefined): boolean {
  return product?.type === MENU_BUNDLE_TYPE;
}

/**
 * Maps a chip to the backend query. All three chips come from ONE paginated endpoint
 * (`GET /api/Products`) so paging and the category filter stay consistent across them —
 * the old tabs hit two different endpoints with independent pagination, which is why
 * an "All" view was not expressible before backend #189 added `IncludeMenus`.
 */
export function toProductTypeQuery(filter: MenuTypeFilter): ProductTypeQuery {
  switch (filter) {
    case 'bundles':
      return { type: 'Menu' };
    case 'all':
      return { includeMenus: true };
    case 'items':
    default:
      // The backend already excludes Menu bundles from an unfiltered query.
      return {};
  }
}
