/**
 * Selection sentinels for the public menu view-state.
 *
 * `ALL_ITEMS_KEY` = show every product across all categories.
 * `MENU_BUNDLES_KEY` = show menu bundles instead of products.
 * Any other string value is a category id.
 *
 * Re-exported from `@/hooks/usePublicMenu` so existing call sites keep
 * working unchanged after the hook split.
 */
export const ALL_ITEMS_KEY = 'all' as const;
export const MENU_BUNDLES_KEY = 'menu-bundles' as const;

export type PublicMenuView = string | typeof ALL_ITEMS_KEY | typeof MENU_BUNDLES_KEY | null;
