import type { OrderItemDto, OrderItemIngredientDto } from '@/types/order';
import type { BasketItemDto } from '@/types/basket';

/**
 * Normalized, read-only view-model for one order/cart line's customizations, shared by
 * `OrderLineSummary`. Both the order shape (`OrderItemDto`) and the cart shape (`BasketItemDto`)
 * adapt into this so the six display surfaces render bundle composition + customizations
 * identically (menu-bundles redesign slice 2, #174).
 */
export interface LineIngredientDiff {
  /** Ingredients added or kept at an above-default quantity, e.g. "Cheese ×2". */
  added: { name: string; quantity: number }[];
  /** Ingredients the customer removed, e.g. "No onion". */
  removed: string[];
}

/** A bundle component (one level deep) with its own ingredient diff + instructions. */
export interface LineChild {
  id?: string;
  name: string;
  quantity: number;
  diff: LineIngredientDiff;
  specialInstructions?: string;
}

export interface LineSummary {
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
    children: components.map((c) => ({
      id: c.id,
      name: c.productName ?? '',
      quantity: c.quantity,
      diff: orderDiff(c.ingredientCustomizations),
      specialInstructions: c.specialInstructions || undefined,
    })),
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
  return { added, removed: item.excludedIngredientNames ?? [] };
}

/** Adapt a `BasketItemDto` (cart shape) into a `LineSummary`. Child items are bundle components. */
export function basketItemToLineSummary(item: BasketItemDto): LineSummary {
  return {
    diff: basketDiff(item),
    sideItems: (item.selectedSideItems ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      price: s.subTotal,
    })),
    specialInstructions: item.specialInstructions || undefined,
    children: (item.childItems ?? []).map((c) => ({
      id: c.id,
      name: c.productName ?? '',
      quantity: c.quantity,
      diff: basketDiff(c),
      specialInstructions: c.specialInstructions || undefined,
    })),
  };
}
