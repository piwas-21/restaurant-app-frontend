/**
 * Pure order-item helpers for the take-order flow.
 *
 * Extracted verbatim from the former `TakeOrderModal` god-file so the hook can
 * stay under the §4 length limit and so the load-bearing dedup + note-building
 * logic is independently unit-testable. Behaviour is byte-for-byte identical to
 * the original inline implementation — do not "fix" the projection or the note
 * string without a product decision.
 */
import { Product } from '@/services/serverService';
import { CreateOrderItemDto } from '@/types/order';
import { CustomizationResult } from '../ProductCustomization';

export interface OrderItem {
  product: Product;
  quantity: number;
  variationId?: string;
  variationName?: string;
  notes?: string;
  addedIngredients?: Array<{ id: string; name: string; price: number; quantity: number }>;
  /** What the waiter took OFF the base recipe. New with S7 — see `waiterSelection.ts`. */
  removedIngredients?: Array<{ id: string; name: string; price: number; quantity: number }>;
  /**
   * The WHOLE selection, as the guest sheet sends it to the basket. The two arrays above are a
   * DIFF, kept for the note string; these are what the server prices the line from (#595).
   */
  selectedIngredientIds?: string[];
  ingredientQuantities?: Record<string, number>;
  sideItems?: Array<{ id: string; name: string; quantity: number; price: number }>;
  unitPrice: number;
}

/**
 * The `/api/Products` payload carries the server-flow fields (type, categories,
 * primaryCategoryId, variations) that the admin menu-management `Product` type
 * used by `getProducts` omits, which is why the original code reached for `any`.
 * Describe just the fields this flow reads and cast once here.
 */
interface RawMenuProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  type: string;
  categories?: NonNullable<Product['categories']>;
  primaryCategoryId?: string;
  imageUrl?: string;
  variations?: NonNullable<Product['variations']>;
}

/** Project the raw paginated `/api/Products` items onto the server `Product` type. */
export function mapMenuProducts(items: readonly unknown[]): Product[] {
  return (items as RawMenuProduct[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    basePrice: p.basePrice,
    isActive: p.isActive,
    isAvailable: p.isAvailable,
    type: p.type,
    categories: p.categories,
    primaryCategoryId: p.primaryCategoryId,
    imageUrl: p.imageUrl,
    variations: p.variations,
  }));
}

/**
 * The added-ingredient half of the dedup key and the note.
 *
 * `N× ` appears only above quantity 1, and the removal clause only when something was removed.
 * Both states became reachable with S7 (the stepper, and opening on the base recipe); before it
 * every added ingredient was implicitly one and nothing could be removed at all — so for every
 * line a waiter could enter BEFORE S7, this produces the byte-identical string it always did.
 */
function describeIngredient(ingredient: { name: string; quantity: number }): string {
  return ingredient.quantity > 1 ? `${ingredient.quantity}× ${ingredient.name}` : ingredient.name;
}

/** The identity of a customization: the same key means the same line, so quantity can merge. */
function dedupKey(result: {
  variationId?: string;
  addedIngredients: ReadonlyArray<{ id: string; quantity: number }>;
  removedIngredients?: ReadonlyArray<{ id: string }>;
  sideItems: ReadonlyArray<{ id: string }>;
}): string {
  return JSON.stringify([
    result.variationId,
    // The QUANTITY is part of the identity, not just the id: one extra rasher of bacon and two are
    // different lines at different prices, and merging them would charge for one of them.
    result.addedIngredients.map((i) => [i.id, i.quantity]),
    (result.removedIngredients ?? []).map((i) => i.id),
    result.sideItems.map((s) => s.id),
  ]);
}

/**
 * Add a customized product to the order list. If an identical line already
 * exists (same product + variation + removed/added/side selections) its
 * quantity is incremented; otherwise a new line with a built note string is
 * appended. The dedup key and note format are load-bearing — preserve exactly.
 */
export function addCustomizedItem(prev: OrderItem[], product: Product, result: CustomizationResult): OrderItem[] {
  // Check if identical item already exists
  const key = dedupKey(result);
  const existingIndex = prev.findIndex(
    (item) =>
      item.product.id === product.id &&
      dedupKey({
        variationId: item.variationId,
        addedIngredients: item.addedIngredients ?? [],
        removedIngredients: item.removedIngredients ?? [],
        sideItems: item.sideItems ?? [],
      }) === key,
  );

  if (existingIndex >= 0) {
    // Increment quantity
    const updated = [...prev];
    updated[existingIndex].quantity += 1;
    return updated;
  }

  // Build customization notes
  const noteParts: string[] = [];
  if (result.variationName) {
    noteParts.push(result.variationName);
  }
  if (result.addedIngredients.length > 0) {
    noteParts.push(`Add: ${result.addedIngredients.map(describeIngredient).join(', ')}`);
  }
  if (result.removedIngredients.length > 0) {
    noteParts.push(`No: ${result.removedIngredients.map((i) => i.name).join(', ')}`);
  }
  if (result.sideItems.length > 0) {
    noteParts.push(`Sides: ${result.sideItems.map((s) => s.name).join(', ')}`);
  }
  if (result.specialInstructions) {
    noteParts.push(result.specialInstructions);
  }

  return [
    ...prev,
    {
      product,
      quantity: 1,
      variationId: result.variationId,
      variationName: result.variationName,
      notes: noteParts.join(' | ') || undefined,
      addedIngredients: result.addedIngredients,
      removedIngredients: result.removedIngredients,
      selectedIngredientIds: result.selectedIngredientIds,
      ingredientQuantities: result.ingredientQuantities,
      sideItems: result.sideItems,
      unitPrice: result.finalPrice,
    },
  ];
}

/**
 * The `POST /api/Orders` line items for a finished waiter order.
 *
 * Until #595 this was five fields inlined in `useTakeOrder`, under a comment reading "addedIngredients
 * and sideItems would need backend support". The line therefore said WHAT was ordered and never WHAT
 * WAS CHOSEN, with three consequences: the order's frozen ingredient snapshot (S1) was empty for the
 * entire POS, a paid-for side item was charged inside `unitPrice` but recorded nowhere, and the money
 * was whatever the till declared — the one line in the system outside
 * `BasketPricingService.CalculateIngredientCustomizationPrice`.
 *
 * Two fields do the work, and each changes what the SERVER does with the line:
 *
 * - `selectedIngredientIds` — the ids that ARE on the dish. Its presence (backend #430) makes the
 *   server recompute the line from the catalogue plus its own ingredient math and DROP the declared
 *   `unitPrice`, so the till stops being an authority on price. It is always sent, including empty:
 *   an empty selection is a real answer, and omitting it would silently restore the old behaviour.
 *
 * - `childItems` — the side items, in the shape `BasketToOrderTranslator` already produces for the
 *   guest checkout: one child row per side, `quantity` PER UNIT of the parent, `kind: 'SideItem'` so
 *   the renderer never has to derive the kind from the parent's mutable `Product.Type` (#318).
 *
 * `unitPrice` is still sent and is still load-bearing for exactly one shape — a line WITH child
 * items, which the server refuses to reprice because a side's money lives in the rolled-up child
 * total rather than in `Product.BasePrice`. There the declared number stands, which is why #594
 * (one price math for both sheets) had to land first: `unitPrice` comes from the shared
 * `linePrice.ts` port of the server's own rule, not from a second POS arithmetic.
 */
export function buildOrderItems(items: readonly OrderItem[]): CreateOrderItemDto[] {
  return items.map((item) => ({
    productId: item.product.id,
    productVariationId: item.variationId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    specialInstructions: item.notes,
    selectedIngredientIds: item.selectedIngredientIds ?? [],
    ingredientQuantities: item.ingredientQuantities,
    // Omitted, not sent as `[]`, so a line with no sides posts exactly the body it always did.
    childItems: item.sideItems?.length
      ? item.sideItems.map((side) => ({
          productId: side.id,
          quantity: side.quantity,
          unitPrice: side.price,
          kind: 'SideItem' as const,
        }))
      : undefined,
  }));
}
