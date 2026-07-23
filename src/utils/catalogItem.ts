import type { MenuItem, MenuBundleItem, CatalogItem, DetailedProduct } from '@/types/menu';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';

/**
 * Normalise a plain product (`MenuItem`) and a combo (`MenuBundleItem`) into the one `CatalogItem`
 * card view-model (menu-bundles redesign #175, slice 6). Replaces the `MenuItem` vs `MenuBundleItem`
 * card fork so a single `MenuCard` renders both. Pure — no I/O, no locale resolution (the card
 * resolves the display name and the ingredient summary from `content`).
 */
export function toCatalogItemFromProduct(item: MenuItem): CatalogItem {
  return {
    kind: 'product',
    id: item.id,
    name: item.name,
    description: item.description,
    content: item.content,
    imageUrl: item.image || item.images?.[0]?.url || FALLBACK_IMAGE,
    imageCount: item.images?.length,
    images: item.images,
    price: item.price,
    isBundle: false,
    // Inline price-edit is safe only when the card price IS the editable base price — i.e. no
    // variations (a variation product's displayed price is a derived "from" value).
    priceEditable: (item.variations?.length ?? 0) === 0,
    allergens: item.allergens,
    isSpecial: item.isSpecial,
    isAvailable: item.isAvailable,
    detailedIngredients: item.detailedIngredients,
    ingredients: item.ingredients,
    dietaryTags: item.dietaryTags,
  };
}

export function toCatalogItemFromBundle(bundle: MenuBundleItem): CatalogItem {
  const bundleItemNames = bundle.menuDefinition?.sections
    ?.flatMap((section) => section?.items?.filter((i) => i.isDefault) ?? [])
    .map((i) => i.productName)
    .filter((name): name is string => !!name);

  return {
    kind: 'bundle',
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    content: bundle.content,
    imageUrl: bundle.images?.[0]?.url || FALLBACK_IMAGE,
    imageCount: bundle.images?.length,
    images: bundle.images,
    price: bundle.basePrice,
    isBundle: true,
    isSpecial: bundle.isSpecial,
    isAvailable: bundle.isAvailable,
    bundleItemNames: bundleItemNames && bundleItemNames.length > 0 ? bundleItemNames : undefined,
  };
}

/**
 * A fetched product detail that turns out to be a combo, re-read as a `MenuBundleItem` so the bundle
 * sheet can drive it.
 *
 * A bundle is not its own type — it is a `Product` with `type === 'menu'` owning a `menuDefinition`
 * — so any entry point that only has a product id (the featured special) can surface one. The modal
 * this replaces handled that by rendering a *second* modal from inside itself and adding via
 * `addItemToBasket` directly, bypassing `CartContext` (the cart never learned about the line).
 * Returns null when the detail is a plain product.
 */
export function toBundleItemFromDetail(detail: DetailedProduct): MenuBundleItem | null {
  if (detail.type !== 'menu' || !detail.menuDefinition) return null;

  // `MenuBundleItem.content` requires a description per locale where the product detail leaves it
  // optional; normalise rather than widen the bundle contract.
  const content = Object.fromEntries(
    Object.entries(detail.content ?? {}).map(([locale, value]) => [
      locale,
      { name: value.name, description: value.description ?? '' },
    ]),
  );

  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    basePrice: detail.basePrice,
    content,
    menuDefinition: detail.menuDefinition,
    images: detail.images,
    isActive: detail.isActive,
    isAvailable: detail.isAvailable,
    isSpecial: detail.isSpecial,
    preparationTimeMinutes: detail.preparationTimeMinutes,
    displayOrder: detail.displayOrder,
  };
}
