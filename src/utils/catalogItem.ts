import type {
  ItemAvailability,
  MenuItem,
  MenuBundleItem,
  CatalogItem,
  DetailedProduct,
  FeaturedSpecial,
  PriceEditability,
} from '@/types/menu';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';
import { isBaseRowHidden, startingPrice } from '@/utils/baseProductVisibility';

/**
 * Normalise a plain product (`MenuItem`) and a combo (`MenuBundleItem`) into the one `CatalogItem`
 * card view-model (menu-bundles redesign #175, slice 6). Replaces the `MenuItem` vs `MenuBundleItem`
 * card fork so a single `MenuCard` renders both. Pure — no I/O, no locale resolution (the card
 * resolves the display name and the ingredient summary from `content`).
 */
export function toCatalogItemFromProduct(item: MenuItem): CatalogItem {
  // With the base row hidden, `item.price` (the bare base price) is a price nobody can buy — the
  // cheapest orderable line is base + the smallest active modifier, and the card says "from"
  // (Track F / F2). Degrades with the flag: no active variation ⇒ the base row is back ⇒ the
  // ordinary price.
  const baseHidden = isBaseRowHidden(item.hideBaseProduct, item.variations);

  return {
    kind: 'product',
    id: item.id,
    name: item.name,
    description: item.description,
    content: item.content,
    imageUrl: item.image || item.images?.[0]?.url || FALLBACK_IMAGE,
    imageCount: item.images?.length,
    images: item.images,
    price: baseHidden ? startingPrice(item.price, item.variations) : item.price,
    priceIsFrom: baseHidden,
    isBundle: false,
    // Inline price-edit is safe only when the card price IS the editable base price — i.e. no
    // variations (a variation product's displayed price is a derived "from" value). The reason
    // travels with the verdict so the card can SAY why rather than rendering nothing.
    priceEditability: (item.variations?.length ?? 0) === 0 ? 'editable' : 'variations',
    allergens: item.allergens,
    isSpecial: item.isSpecial,
    isAvailable: item.isAvailable,
    detailedIngredients: item.detailedIngredients,
    ingredients: item.ingredients,
    dietaryTags: item.dietaryTags,
    availability: item.availability,
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
    // Was simply absent, which read as `undefined` and made the editor render nothing at all for
    // every combo — indistinguishable from a bug, and the half of the report that said "SOME menu
    // items don't have the button". Stated explicitly now, with the reason.
    priceEditability: 'bundle',
    isSpecial: bundle.isSpecial,
    isAvailable: bundle.isAvailable,
    bundleItemNames: bundleItemNames && bundleItemNames.length > 0 ? bundleItemNames : undefined,
    availability: bundle.availability,
  };
}

/**
 * The featured special as a `CatalogItem`, so the hero can render the same admin controls the
 * catalog cards do (`AdminMenuCardControls` + `AdminPriceEditor`). Before this, an admin could edit
 * the price of every item on the menu page EXCEPT the one the page is promoting.
 *
 * Only the fields those two controls read are mapped — this is not a card view-model, and the hero
 * renders its own body from the `FeaturedSpecial` directly.
 *
 * The `priceEditability` derivation is the whole reason this is a separate mapper rather than a
 * cast. It has to be provable from what the banner's payload actually carries:
 *
 * - variations present → `'variations'`, exactly as a product card derives it (the displayed price
 *   is a derived "from" value; the real prices live per variation).
 * - `type === 'menu'` → `'bundle'`: a combo. Nothing stops one being featured.
 * - `type` absent → `'unknownKind'`. Against a backend older than #285 there is no way to tell, and
 *   the wrong guess writes through the wrong validator. Refusing WITH the reason is the E3 rule:
 *   an absence with no explanation reads as a bug, which is how this was reported in the first place.
 */
export function toCatalogItemFromFeaturedSpecial(special: FeaturedSpecial): CatalogItem {
  return {
    // `kind`/`isBundle` DO fall back to "product" when the type is absent, where `priceEditability`
    // refuses to. The difference is what each is used for: nothing on the hero reads these two (the
    // admin controls take the id and the editability verdict), so they carry the shape's default
    // rather than a decision. Anything that starts reading them must revisit that.
    kind: special.type === 'menu' ? 'bundle' : 'product',
    id: special.id,
    name: special.name,
    description: special.description,
    content: special.content,
    imageUrl: special.imageUrl,
    images: special.images,
    price: special.basePrice,
    isBundle: special.type === 'menu',
    priceEditability: resolveFeaturedPriceEditability(special),
    allergens: special.allergens,
    availability: special.availability,
  };
}

function resolveFeaturedPriceEditability(special: FeaturedSpecial): PriceEditability {
  if ((special.variations?.length ?? 0) > 0) return 'variations';
  if (special.type === undefined) return 'unknownKind';
  return special.type === 'menu' ? 'bundle' : 'editable';
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
export function toBundleItemFromDetail(
  detail: DetailedProduct,
  availability?: ItemAvailability,
): MenuBundleItem | null {
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
    // A caller's verdict WINS over the detail's, and the fallback is not the safe one it looks:
    // `getProductById` sends no channel, so `detail.availability` was resolved against "none
    // chosen" — permissive by construction (§9.2).
    //
    // The featured special is the live case. A combo can be the featured item; the banner resolves
    // it WITH the channel and hides its own Add, then "Details" opens the sheet by id. Taking the
    // detail's verdict there would re-offer the add the banner just refused — §9.10 two clicks
    // later.
    availability: availability ?? detail.availability,
  };
}
