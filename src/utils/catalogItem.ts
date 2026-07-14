import type { MenuItem, MenuBundleItem, CatalogItem } from '@/types/menu';

/**
 * Normalise a plain product (`MenuItem`) and a combo (`MenuBundleItem`) into the one `CatalogItem`
 * card view-model (menu-bundles redesign #175, slice 6). Replaces the `MenuItem` vs `MenuBundleItem`
 * card fork so a single `MenuCard` renders both. Pure — no I/O, no locale resolution (the card
 * resolves the display name from `content`).
 */
export function toCatalogItemFromProduct(item: MenuItem): CatalogItem {
  return {
    kind: 'product',
    id: item.id,
    name: item.name,
    description: item.description,
    content: item.content,
    imageUrl: item.image || item.images?.[0]?.url,
    price: item.price,
    isBundle: false,
    allergens: item.allergens,
    isSpecial: item.isSpecial,
    isAvailable: item.isAvailable,
  };
}

export function toCatalogItemFromBundle(bundle: MenuBundleItem): CatalogItem {
  const bundleItemNames = bundle.menuDefinition?.sections
    ?.flatMap((section) => section.items.filter((i) => i.isDefault))
    .map((i) => i.productName)
    .filter((name): name is string => !!name);

  return {
    kind: 'bundle',
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    content: bundle.content,
    imageUrl: bundle.images?.[0]?.url,
    price: bundle.basePrice,
    isBundle: true,
    isSpecial: bundle.isSpecial,
    isAvailable: bundle.isAvailable,
    bundleItemNames: bundleItemNames && bundleItemNames.length > 0 ? bundleItemNames : undefined,
  };
}
