import type { OrderItemDto, OrderItemIngredientDto } from '@/types/order';
import type { BasketItemDto } from '@/types/basket';
import { variationLabel } from './variationLabel';

/**
 * Normalized, read-only view-model for one order/cart line's customizations, shared by
 * `OrderLineSummary`. Both the order shape (`OrderItemDto`) and the cart shape (`BasketItemDto`)
 * adapt into this so every display surface renders bundle composition + customizations identically
 * (menu-bundles redesign slice 2, #174). Nine render sites as of #189 — count them rather than
 * trusting this sentence, with a recipe that excludes the tests and the prose (this comment
 * included), both of which mention the tag:
 * `grep -rn '<OrderLineSummary' src/ | grep -v '\.test\.' | grep -v lineSummary.ts`
 */
export interface LineIngredientDiff {
  /** Ingredients added or kept at an above-default quantity, e.g. "Cheese ×2". */
  added: { name: string; quantity: number }[];
  /** Ingredients the customer removed, e.g. "No onion". */
  removed: string[];
}

/**
 * A bundle component with its own ingredient diff + instructions, and its own components beneath it.
 * The tree nests to arbitrary depth on both wire shapes (`OrderItemDto.sideItems` and
 * `BasketItemDto.childItems` are self-recursive), so this does too — a component of a component
 * that stopped at one level would simply vanish from every surface.
 */
export interface LineChild {
  id?: string;
  name: string;
  quantity: number;
  diff: LineIngredientDiff;
  specialInstructions?: string;
  children: LineChild[];
  /**
   * The component's own upcharge, PER UNIT — for a bundle child this is its section's additional
   * price (backend `BasketItemFactory`: `UnitPrice = sectionItem.AdditionalPrice`), not its share of
   * the line total (a bundle child's `itemTotal` is 0 by design; the whole price is rolled into the
   * parent, which accumulates `AdditionalPrice * selection.Quantity`).
   *
   * Per-unit is why `showChildPrices` also suppresses the child's `quantity`. The two DO reconcile
   * when the line is built — `quantity * price` is the component's share of the line total — but
   * nothing rescales a child when the line quantity changes, so the pair stops agreeing after one
   * press of the cart's stepper. See `ChildList`.
   *
   * Populated by the CART adapter only, and rendered only where `OrderLineSummary` is asked for it
   * (`showChildPrices`). Both restraints exist because the /cart card showed this number before it
   * was migrated onto this component (#189) and the other eight render sites did not — carrying it
   * unconditionally would have added a price to the order views, the checkout list and the cart
   * rail as a side effect of a refactor. The order adapter can start setting it the day an order
   * surface wants it.
   */
  price?: number;
}

export interface LineSummary {
  /**
   * The variation the guest chose ("Large (40 cm)"), already resolved for the reading language.
   *
   * Set by the CART adapter only, and rendered only where `OrderLineSummary` is asked for it
   * (`showVariation`) — the same restraint `LineChild.price` documents, and for the same reason:
   * the /cart card and the checkout list already draw this line themselves, so populating it
   * unconditionally would print the size twice on the two surfaces that were never missing it.
   *
   * It is NOT part of the ingredient diff. A variation is a different product row, not a change to
   * the recipe — which is also why `isLineSummaryEmpty` ignores it.
   */
  variation?: string;
  diff: LineIngredientDiff;
  /** True add-on side items ordered alongside the line (not bundle components). */
  sideItems: { id?: string; name: string; quantity: number; price?: number }[];
  specialInstructions?: string;
  /** Bundle components, rendered indented one level. */
  children: LineChild[];
}

/** True when there is nothing customization-related to show for the line. */
export function isLineSummaryEmpty(summary: LineSummary): boolean {
  return (
    summary.diff.added.length === 0 &&
    summary.diff.removed.length === 0 &&
    summary.sideItems.length === 0 &&
    !summary.specialInstructions &&
    summary.children.length === 0
  );
}

/**
 * Build a diff from an order item's flattened ingredient customizations. The snapshot can carry
 * unchanged defaults (quantity 1), so those are skipped: only removals (`isRemoved`) and
 * above-default quantities (>1) are meaningful changes — matching the "No onion" / "Extra cheese ×2"
 * display. (The order DTO can't distinguish a default-1 from an added-optional-1, so single adds are
 * not surfaced here; the richer cart shape carries an explicit added list.)
 */
function orderDiff(customizations: OrderItemIngredientDto[] | undefined): LineIngredientDiff {
  const list = customizations ?? [];
  return {
    added: list
      .filter((c) => !c.isRemoved && c.quantity > 1)
      .map((c) => ({ name: c.ingredientName, quantity: c.quantity })),
    removed: list.filter((c) => c.isRemoved).map((c) => c.ingredientName),
  };
}

/**
 * Adapt one child row and everything under it. The `kind` split into add-on sides vs components is
 * applied at the ROOT only — that is where an add-on side attaches — so below the root every
 * descendant renders uniformly as a nested component.
 */
function orderItemToChild(item: OrderItemDto): LineChild {
  return {
    id: item.id,
    name: item.productName ?? '',
    quantity: item.quantity,
    diff: orderDiff(item.ingredientCustomizations),
    specialInstructions: item.specialInstructions || undefined,
    children: (item.sideItems ?? []).map(orderItemToChild),
  };
}

/**
 * Adapt an `OrderItemDto` into a `LineSummary`. Children are split by the backend `kind`
 * discriminator (#158): `SideItem` → true add-on sides (name/qty/price), anything else
 * (`BundleChild` or, for pre-#158 historical orders, undefined) → bundle components with their
 * own ingredient diffs.
 */
export function orderItemToLineSummary(item: OrderItemDto): LineSummary {
  const childItems = item.sideItems ?? [];
  const sides = childItems.filter((c) => c.kind === 'SideItem');
  const components = childItems.filter((c) => c.kind !== 'SideItem');

  return {
    diff: orderDiff(item.ingredientCustomizations),
    sideItems: sides.map((s) => ({ id: s.id, name: s.productName ?? '', quantity: s.quantity, price: s.itemTotal })),
    specialInstructions: item.specialInstructions || undefined,
    children: components.map(orderItemToChild),
  };
}

/**
 * Diff from a basket item. Unlike the order shape, the basket carries an explicit added-ingredient
 * name list (`selectedIngredientNames`), so every added ingredient is surfaced with its quantity
 * (index-aligned with `selectedIngredients`/`ingredientQuantities`), matching the existing cart
 * customizations display.
 */
function basketDiff(item: BasketItemDto): LineIngredientDiff {
  const added = (item.selectedIngredientNames ?? []).map((name, idx) => {
    const id = item.selectedIngredients?.[idx];
    const quantity = id && item.ingredientQuantities?.[id] ? item.ingredientQuantities[id] : 1;
    return { name, quantity };
  });
  // Removals, at last from a channel that works (#363). The basket's old one,
  // `excludedIngredientNames`, was derived from a column nothing ever wrote (backend #283 /
  // frontend #170), so the cart could never show a removal while the order view always could.
  //
  // Both shapes now read the SAME thing — a saved quantity of 0 — through the same server-side
  // base-recipe rule, so a quantity PRESENT in the saved map means the same on both. They are not
  // yet identical: the order path additionally treats a required ingredient that is ABSENT from
  // that map as removed, and the cart does not, so such a line still shows a removal on the order
  // view and none here (backend `IngredientRecipeRules` remarks — tracked there, not closed by
  // #363). It is resolved on the backend
  // rather than here for two reasons the cart payload cannot overcome: a 0 is also written for
  // every optional add-on the guest never chose (only a BASE-RECIPE ingredient at 0 is a removal,
  // and `isOptional`/`isIncludedInBasePrice` are not in this payload), and a removed ingredient's
  // name is absent entirely — `selectedIngredientNames` is index-aligned with the SELECTED ids.
  return { added, removed: item.removedIngredientNames ?? [] };
}

function basketItemToChild(item: BasketItemDto): LineChild {
  return {
    id: item.id,
    name: item.productName ?? '',
    quantity: item.quantity,
    diff: basketDiff(item),
    specialInstructions: item.specialInstructions || undefined,
    children: (item.childItems ?? []).map(basketItemToChild),
    // See LineChild.price — the /cart card's component upcharge, kept through the #189 migration.
    price: item.unitPrice,
  };
}

/**
 * Adapt a `BasketItemDto` (cart shape) into a `LineSummary`. Child items are bundle components.
 *
 * `language` is the SHORT reading code and only feeds `variation`, which no caller renders unless it
 * asks — so the eight existing call sites keep their exact output while omitting it.
 */
export function basketItemToLineSummary(item: BasketItemDto, language = 'en'): LineSummary {
  return {
    variation: variationLabel(item, language) ?? undefined,
    diff: basketDiff(item),
    sideItems: (item.selectedSideItems ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      price: s.subTotal,
    })),
    specialInstructions: item.specialInstructions || undefined,
    children: (item.childItems ?? []).map(basketItemToChild),
  };
}
