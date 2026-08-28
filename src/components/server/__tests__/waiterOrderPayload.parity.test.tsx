import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import { getProductById } from '@/services/menuService';
import type { AddItemPayload } from '@/components/cart/cartTypes';
import type { CreateOrderItemDto } from '@/types/order';
import { useProductCustomizationSheet } from '../useProductCustomizationSheet';
import { addCustomizedItem, buildOrderItems, type OrderItem } from '../take-order/orderItems';
import type { CustomizationResult, DetailedIngredient, ProductVariation } from '../productCustomizationTypes';

/**
 * #595 — THE ORACLE: the same dish, customised the same way, in the same quantity, must cost the
 * same whether a guest checked it out or a waiter rang it in.
 *
 * S7 (#594) proved the two SHEETS agree about the number they DISPLAY. That is not the same claim.
 * The waiter's sheet then handed its result to `useTakeOrder`, which posted five fields under the
 * comment "addedIngredients and sideItems would need backend support" — so the order carried no
 * ingredient selection and no side-item rows at all. The consequences were not only cosmetic: the
 * frozen S1 snapshot was empty for the entire POS, a paid-for side was recorded nowhere, and the
 * money was whatever the till declared. This file is about the PAYLOAD, which is where the two
 * paths actually meet the server.
 *
 * Neither path is trusted to check itself. Each is driven to a payload and that payload is then
 * priced by a TRANSCRIPTION OF THE SERVER — and there are deliberately TWO transcriptions, of two
 * different C# files, because the defect this shape of test exists to catch lives in the line
 * ASSEMBLY, not in the ingredient rule:
 *
 *   - the guest line is `(UnitPrice + CustomizationPrice) * Quantity` — `BasketItemFactory` +
 *     `BasketLineTotal.ForRoot`, i.e. the customization is PER UNIT;
 *   - the order line is `UnitPrice * Quantity + CustomizationPrice` — `OrderItemFactory`, i.e. the
 *     customization is LINE-ABSOLUTE.
 *
 * Those two are equal at quantity 1 and at no other quantity. The backend shipped exactly that
 * defect in #433, 1800 green tests did not see it, and one of them pinned it as correct — because
 * every money assertion but one used quantity 1. NOTHING BELOW RUNS AT QUANTITY 1.
 */

// ── Fixture ──────────────────────────────────────────────────────────────────────────────────────
// Names and figures mirror the backend's `WaiterAndGuestPricingParityTests` so the two files can be
// read side by side. #605 ADDS a real sauce row and a non-zero allowance, which this header used to
// say were absent: `sauceIncludedFree` is 0 for every product on production today, which is a fact
// about DATA and stops being true the first time an admin types a number into the field.

const BASE_PRICE = 18;
const SAUCE_PRICE = 1.5; // optional, INCLUDED in base -> taking it off DEDUCTS
const BACON_PRICE = 2.5; // paid add-on -> selecting it ADDS
const COKE_PRICE = 2.5; // an optional side item -> a CHILD ROW on the order
const LARGE_MODIFIER = 3.5;
const GARLIC_PRICE = 3; // a PAID sauce row -> the allowance is what takes it back off
/** How many sauce UNITS the product includes at no charge (#605). */
const SAUCE_INCLUDED_FREE = 2;

const CHEESE = 'cheese';
const GARLIC = 'sauce_garlic';
const SAUCE = 'sauce';
const BACON = 'bacon';
const TRUFFLE = 'truffle';
const COKE = 'coke';

const INGREDIENTS: DetailedIngredient[] = [
  { id: CHEESE, name: 'Cheese', isActive: true, isOptional: false, price: 0, maxQuantity: 1 },
  {
    id: SAUCE,
    name: 'Tomato Sauce',
    isActive: true,
    isOptional: true,
    price: SAUCE_PRICE,
    isIncludedInBasePrice: true,
    maxQuantity: 1,
  },
  {
    id: BACON,
    name: 'Extra Bacon',
    isActive: true,
    isOptional: true,
    price: BACON_PRICE,
    isIncludedInBasePrice: false,
    maxQuantity: 3,
  },
  // Inactive, and expensive: it must never reach a payload or a price on either path.
  { id: TRUFFLE, name: 'Truffle', isActive: false, isOptional: true, price: 9, maxQuantity: 4 },
  /*
   * A REAL sauce row (#605) — `kind: 'sauce'`, paid, and takeable twice, so one row can spend an
   * allowance of 2 by itself. Unselected it charges nothing, which is why adding it leaves every
   * pre-existing case in this file byte-identical.
   */
  {
    id: GARLIC,
    name: 'Garlic sauce',
    isActive: true,
    isOptional: true,
    price: GARLIC_PRICE,
    isIncludedInBasePrice: false,
    maxQuantity: 2,
    kind: 'sauce',
    displayOrder: 1,
  },
];

const VARIATIONS: ProductVariation[] = [
  { id: 'small', name: 'Small', priceModifier: 0, finalPrice: BASE_PRICE, isActive: true, displayOrder: 1 },
  {
    id: 'large',
    name: 'Large',
    priceModifier: LARGE_MODIFIER,
    finalPrice: BASE_PRICE + LARGE_MODIFIER,
    isActive: true,
    displayOrder: 2,
  },
];

// Deliberately NOT required. A required side would put a child row on EVERY line, and a line with
// child items is the one shape the server refuses to reprice — so the whole server-priced branch
// would go untested while every assertion stayed green.
const SIDES = [{ id: COKE, name: 'Coke', price: COKE_PRICE, isRequired: false, displayOrder: 1 }];

const DETAIL = {
  id: 'p1',
  name: 'Margherita',
  basePrice: BASE_PRICE,
  /*
   * The product's free-sauce allowance (#605). Non-zero, because `0` is the value that makes the
   * defect invisible: the waiter sheet dropped this field at the type boundary and `useLinePrice`
   * read the absence as `0`, which is byte-identical to correct behaviour on every product that
   * exists on production today. A fixture that also said 0 would agree with the bug.
   */
  sauceIncludedFree: SAUCE_INCLUDED_FREE,
  hideBaseProduct: false,
  variations: VARIATIONS,
  detailedIngredients: INGREDIENTS,
  suggestedSideItems: SIDES,
  allergens: [],
};

const OPTIONALS = INGREDIENTS.filter((i) => i.isOptional && i.isActive);

// ── The shared half of both oracles ──────────────────────────────────────────────────────────────
/**
 * `BasketPricingService.CalculateIngredientCustomizationPrice`, transcribed. Shared by the two
 * oracles below because the SERVER shares it — it is the single writer of ingredient money on both
 * paths, so giving each oracle its own copy would model something the backend does not do.
 *
 * The sauce-allowance branch (`sauceIncludedFree > 0`, S6/#429) is transcribed too, as #605
 * predicted it would be — one more clause, not a second price policy:
 *
 *   if (chargeableSauceUnits != null && i.Kind == IngredientKind.Sauce && i.Price > 0)
 *   { chargeableUnits = isSelected ? (i.IsIncludedInBasePrice ? Math.Max(0, q - 1) : q) : 0;
 *     add that many UNITS of (i.Price, i.DisplayOrder, i.Id); }
 *   customizationPrice -= units.OrderByDescending(Price).ThenBy(DisplayOrder).ThenBy(Id)
 *                              .Take(sauceIncludedFree).Sum(Price);
 *
 * A list of UNITS, not of rows: two of one sauce spend the allowance as surely as one of each. It
 * can only remove a charge this same loop added, so it can never invent a refund.
 *
 *   foreach (var i in detailedIngredients.Where(i => i.IsOptional && i.IsActive))
 *   { quantity = ingredientQuantities?[i.Id] ?? 1; clamp to [0, MaxQuantity];
 *     if (i.IsIncludedInBasePrice) { if (!isSelected) price -= i.Price;
 *                                    else if (quantity > 1) price += i.Price * (quantity - 1); }
 *     else if (isSelected) price += i.Price * quantity; }
 */
interface SauceUnit {
  price: number;
  displayOrder: number;
  id: string;
}

/** The server's clamp to [0, MaxQuantity]. */
function clampQuantity(ingredient: DetailedIngredient, requested: number | undefined): number {
  const quantity = requested ?? 1;
  if (quantity < 0) return 0;
  return Math.min(quantity, ingredient.maxQuantity ?? 1);
}

/** `chargeableUnits` from the C#: what the loop is about to bill for THIS row, or 0 if unselected. */
function chargedUnitCount(ingredient: DetailedIngredient, isSelected: boolean, quantity: number): number {
  if (!isSelected) return 0;
  return ingredient.isIncludedInBasePrice ? Math.max(0, quantity - 1) : quantity;
}

/** The per-row money, before any allowance: the two branches of the server's rule, unchanged. */
function rowCustomizationPrice(ingredient: DetailedIngredient, isSelected: boolean, quantity: number): number {
  const price = ingredient.price ?? 0;
  if (ingredient.isIncludedInBasePrice) {
    if (!isSelected) return -price;
    return quantity > 1 ? price * (quantity - 1) : 0;
  }
  return isSelected ? price * quantity : 0;
}

/** `OrderByDescending(Price).ThenBy(DisplayOrder).ThenBy(Id).Take(N).Sum(Price)`. */
function waiveMostExpensive(units: readonly SauceUnit[], allowance: number): number {
  return [...units]
    .sort((a, b) => b.price - a.price || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
    .slice(0, allowance)
    .reduce((sum, unit) => sum + unit.price, 0);
}

function ingredientCustomizationPrice(
  selectedIngredientIds: readonly string[] | undefined,
  ingredientQuantities: Readonly<Record<string, number>> | undefined,
): number {
  const selected = new Set(selectedIngredientIds ?? []);
  let customizationPrice = 0;
  /** One entry per CHARGED sauce unit, in the server's own shape — see the waiver clause below. */
  const sauceUnits: SauceUnit[] = [];

  for (const ingredient of INGREDIENTS) {
    if (!ingredient.isOptional || !ingredient.isActive) continue;

    const isSelected = selected.has(ingredient.id);
    const quantity = clampQuantity(ingredient, ingredientQuantities?.[ingredient.id]);
    const price = ingredient.price ?? 0;

    if (ingredient.kind === 'sauce' && price > 0) {
      const charged = chargedUnitCount(ingredient, isSelected, quantity);
      for (let unit = 0; unit < charged; unit += 1) {
        sauceUnits.push({ price, displayOrder: ingredient.displayOrder ?? 0, id: ingredient.id });
      }
    }

    customizationPrice += rowCustomizationPrice(ingredient, isSelected, quantity);
  }

  return customizationPrice - waiveMostExpensive(sauceUnits, SAUCE_INCLUDED_FREE);
}

const variationModifier = (variationId?: string | null): number =>
  VARIATIONS.find((v) => v.id === variationId)?.priceModifier ?? 0;

/**
 * ORACLE A — the GUEST line, from `BasketItemFactory.BuildRegularItemAsync`:
 *
 *   unitPrice          = BasePrice + (variation?.PriceModifier ?? 0)
 *   customizationPrice = ingredient delta + Σ side.BasePrice * side.Quantity   // PER UNIT
 *   ItemTotal          = (unitPrice + customizationPrice) * Quantity
 *
 * A side item is priced PER UNIT of the parent on this path — two pizzas each with a coke are two
 * cokes — which is the fact the waiter payload has to reproduce rather than assume.
 */
function serverBasketTotal(payload: AddItemPayload): number {
  const unitPrice = BASE_PRICE + variationModifier(payload.productVariationId);

  let customizationPrice = ingredientCustomizationPrice(payload.selectedIngredients, payload.ingredientQuantities);
  for (const side of payload.selectedSideItems ?? []) {
    if (side.quantity <= 0) continue; // BasketItemFactory drops non-positive quantities first
    customizationPrice += (SIDES.find((s) => s.id === side.id)?.price ?? 0) * side.quantity;
  }

  return (unitPrice + customizationPrice) * payload.quantity;
}

/**
 * ORACLE B — the WAITER line, from `OrderItemFactory.AddProductItemRecursiveAsync` +
 * `OrderLineIngredientChoice.Resolve`, with `pricesAreTrusted = true` (the till carries a staff
 * bearer, and `ICurrentUserService.IsStaff` includes `UserRole.Server`).
 *
 *   serverCanPrice = SelectedIngredientIds != null && root && no ChildItems && Type != Menu
 *   unitPrice      = serverCanPrice ? BasePrice + modifier : (declared UnitPrice, staff)
 *   customization  = serverCanPrice ? delta * Quantity : declared CustomizationPrice
 *   ItemTotal      = unitPrice * Quantity + customization                      // LINE-ABSOLUTE
 *
 * `delta * Quantity` is the unit conversion #435 had to add: the delta is per DISH and the slot is
 * per LINE. A child row is pinned at `ItemTotal = 0`, so it contributes nothing here — which is
 * exactly why a side folded into the parent's declared unit price is charged once, not twice.
 */
function serverOrderTotal(items: readonly CreateOrderItemDto[]): number {
  let total = 0;

  for (const dto of items) {
    const serverCanPrice = dto.selectedIngredientIds != null && !dto.childItems?.length;

    const unitPrice = serverCanPrice
      ? BASE_PRICE + variationModifier(dto.productVariationId)
      : dto.unitPrice > 0
        ? dto.unitPrice
        : BASE_PRICE + variationModifier(dto.productVariationId);

    const customization = serverCanPrice
      ? ingredientCustomizationPrice(dto.selectedIngredientIds, dto.ingredientQuantities) * dto.quantity
      : (dto.customizationPrice ?? 0);

    total += unitPrice * dto.quantity + customization; // child rows add 0
  }

  return total;
}

// ── Mocks ────────────────────────────────────────────────────────────────────────────────────────
const mockAddItem = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({ addItem: (payload: unknown) => mockAddItem(payload) }),
}));
jest.mock('@/hooks/cart/useCartFeedback', () => ({
  useCartFeedback: () => ({ notifyItemAdded: jest.fn(), notifyAddFailed: jest.fn() }),
}));

const product = { id: 'p1', name: 'Margherita', basePrice: BASE_PRICE } as never;

beforeEach(() => {
  mockAddItem.mockReset();
  mockAddItem.mockResolvedValue(undefined);
  (getProductById as jest.Mock).mockResolvedValue({ success: true, data: DETAIL });
});

// ── The two paths ────────────────────────────────────────────────────────────────────────────────
interface LineSpec {
  /** Target quantity per optional ingredient; 0 means "off the dish". */
  quantities: Record<string, number>;
  variationId: string | null;
  withSide: boolean;
  /** ALWAYS >= 2 — see the file header. */
  quantity: number;
}

/** The guest: the real sheet hook, driven to the spec, and the `AddToBasketDto` it actually sends. */
async function guestPayload(spec: LineSpec): Promise<AddItemPayload> {
  const { result } = renderHook(() => useItemCustomizationSheet());
  await act(async () => {
    await result.current.openForProduct('p1', { forceSheet: true });
  });
  await waitFor(() => expect(result.current.isOpen).toBe(true));

  act(() => {
    result.current.setSelectedIngredients([
      CHEESE,
      ...OPTIONALS.map((i) => i.id).filter((id) => (spec.quantities[id] ?? 0) > 0),
    ]);
    result.current.setIngredientQuantities({ [CHEESE]: 1, ...spec.quantities });
    result.current.setSelectedVariationId(spec.variationId);
    result.current.setSelectedSideItems(spec.withSide ? [{ id: COKE, quantity: 1 }] : []);
    result.current.setQuantity(spec.quantity);
  });

  await act(async () => {
    await result.current.addToCart();
  });

  expect(mockAddItem).toHaveBeenCalledTimes(1);
  return mockAddItem.mock.calls[0][0] as AddItemPayload;
}

/**
 * The waiter: the real sheet hook driven THROUGH ITS OWN CONTROLS, its results folded through the
 * real take-order list, and the `CreateOrderItemDto[]` `useTakeOrder` would post. Nothing here
 * writes sheet state directly, so a selection the payload can describe and the screen cannot reach
 * fails this test.
 */
async function waiterPayload(spec: LineSpec): Promise<CreateOrderItemDto[]> {
  const confirmed: CustomizationResult[] = [];
  const { result } = renderHook(() =>
    useProductCustomizationSheet({
      product,
      isOpen: true,
      onClose: jest.fn(),
      onConfirm: (line: CustomizationResult) => confirmed.push(line),
    }),
  );
  await waitFor(() => expect(result.current.optionalIngredients).toHaveLength(OPTIONALS.length));

  for (const ingredient of OPTIONALS) {
    const target = spec.quantities[ingredient.id] ?? 0;
    // The sheet opens on the BASE RECIPE: an included-in-base row starts at 1, a paid one at 0.
    let current = ingredient.isIncludedInBasePrice ? 1 : 0;

    if (target === 0) {
      if (current === 1) act(() => result.current.toggleIngredient(ingredient));
      continue;
    }
    if (current === 0) {
      act(() => result.current.toggleIngredient(ingredient));
      current = 1;
    }
    for (let q = current; q < target; q++) act(() => result.current.stepIngredient(ingredient, 1));
  }

  if (spec.variationId) {
    act(() => result.current.selectVariation(VARIATIONS.find((v) => v.id === spec.variationId)!));
  }
  if (spec.withSide) act(() => result.current.toggleSideItem(COKE));
  act(() => result.current.setQuantity(spec.quantity));
  act(() => result.current.handleConfirm());

  // `handleConfirm` fires once per unit; `addCustomizedItem` merges them into ONE line of that
  // quantity. Folding them here rather than asserting on the raw results is the point — the
  // quantity the server multiplies by is produced by that merge, not by the sheet.
  let lines: OrderItem[] = [];
  for (const line of confirmed) lines = addCustomizedItem(lines, product, line);
  expect(lines).toHaveLength(1);
  expect(lines[0].quantity).toBe(spec.quantity);

  return buildOrderItems(lines);
}

const money = (amount: number): number => Math.round(amount * 100) / 100;

async function bothPaths(spec: LineSpec): Promise<{ guest: number; waiter: number; posted: CreateOrderItemDto[] }> {
  const guestDto = await guestPayload(spec);
  const posted = await waiterPayload(spec);
  return { guest: money(serverBasketTotal(guestDto)), waiter: money(serverOrderTotal(posted)), posted };
}

// Two quantities, both above 1, so a per-unit/per-line confusion cannot survive either.
const QUANTITIES = [2, 3];

describe('#595 — the waiter POSTs a line the server prices exactly like the guest basket line', () => {
  describe.each(QUANTITIES)('at quantity %i', (quantity) => {
    it('a paid extra costs the same from the till as from the basket', async () => {
      const { guest, waiter } = await bothPaths({
        quantities: { [SAUCE]: 1, [BACON]: 1 },
        variationId: null,
        withSide: false,
        quantity,
      });
      expect(waiter).toBe(guest);
    });

    it('a removal deducts the same from the till as from the basket', async () => {
      const { guest, waiter } = await bothPaths({
        quantities: { [SAUCE]: 0, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity,
      });
      expect(waiter).toBe(guest);
    });

    it('an extra and a removal on one line agree across both paths', async () => {
      const { guest, waiter } = await bothPaths({
        quantities: { [SAUCE]: 0, [BACON]: 2 },
        variationId: null,
        withSide: false,
        quantity,
      });
      expect(waiter).toBe(guest);
    });

    it('a variation carries its modifier identically on both paths', async () => {
      const { guest, waiter } = await bothPaths({
        quantities: { [SAUCE]: 1, [BACON]: 3 },
        variationId: 'large',
        withSide: false,
        quantity,
      });
      expect(waiter).toBe(guest);
    });

    /*
     * #605 — THE MONEY CASE, and the reason this file gained a sauce row.
     *
     * A line WITH a side item is the one shape the server deliberately refuses to reprice: a side's
     * money lives in the rolled-up child total, not in `Product.BasePrice`, so `serverCanPrice` is
     * false and the DECLARED unit price stands. The declared number is whatever the waiter sheet
     * computed — which, before this fix, was computed with `sauceIncludedFree` defaulted to `0`.
     *
     * So on this shape the guest is charged for sauces the menu says are included, and no server
     * recomputation saves it. Without the fix this assertion fails by exactly the waived amount
     * times the line quantity.
     */
    it('spends the free-sauce allowance identically, on the line the server will NOT reprice', async () => {
      const { guest, waiter, posted } = await bothPaths({
        quantities: { [SAUCE]: 1, [GARLIC]: 2 },
        variationId: null,
        withSide: true,
        quantity,
      });

      // The precondition, asserted rather than assumed: this really is the declared-price shape.
      expect(posted[0].childItems).toHaveLength(1);
      expect(posted[0].selectedIngredientIds).toContain(GARLIC);

      expect(waiter).toBe(guest);
    });

    it('spends the allowance identically when the server DOES reprice, so the sheet agrees on display too', async () => {
      // The same selection with no side item. Here the server recomputes from
      // `selectedIngredientIds` and applies the allowance itself, so a wrong sheet number is a
      // display defect rather than a loss — and this is the case that pins the display half.
      const { guest, waiter, posted } = await bothPaths({
        quantities: { [SAUCE]: 1, [GARLIC]: 2 },
        variationId: null,
        withSide: false,
        quantity,
      });

      expect(posted[0].childItems).toBeUndefined();
      expect(waiter).toBe(guest);
    });

    it('a side item is charged once per dish on both paths, and recorded as a child row', async () => {
      const { guest, waiter, posted } = await bothPaths({
        quantities: { [SAUCE]: 1, [BACON]: 1 },
        variationId: 'large',
        withSide: true,
        quantity,
      });

      expect(waiter).toBe(guest);
      // The defect, stated: before #595 the guest was charged for the coke inside `unitPrice` and
      // no row on the order said so. `quantity` stays PER UNIT of the parent, as
      // `BasketToOrderTranslator` sends it.
      expect(posted[0].childItems).toEqual([{ productId: COKE, quantity: 1, unitPrice: COKE_PRICE, kind: 'SideItem' }]);
    });
  });

  describe('what the payload actually carries', () => {
    it('sends the WHOLE selection, not the diff — an untouched included-in-base row is in it', async () => {
      const [posted] = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });

      // Nothing was added and nothing was removed, so a payload built from `addedIngredients` +
      // `removedIngredients` would be EMPTY here — and an empty selection tells the server the
      // sauce was taken off, deducting CHF 1.50 per dish that nobody asked to save.
      expect(posted.selectedIngredientIds).toEqual(expect.arrayContaining([CHEESE, SAUCE]));
      expect(posted.selectedIngredientIds).not.toContain(BACON);
      expect(posted.selectedIngredientIds).not.toContain(TRUFFLE);
    });

    it('describes the same dish as the guest payload does', async () => {
      const spec: LineSpec = {
        quantities: { [SAUCE]: 0, [BACON]: 2 },
        variationId: 'large',
        withSide: false,
        quantity: 2,
      };
      const guest = await guestPayload(spec);
      const [posted] = await waiterPayload(spec);

      expect(new Set(posted.selectedIngredientIds)).toEqual(new Set(guest.selectedIngredients));
      expect(posted.selectedIngredientIds!.map((id) => posted.ingredientQuantities?.[id] ?? 1)).toEqual(
        posted.selectedIngredientIds!.map((id) => guest.ingredientQuantities?.[id] ?? 1),
      );
      expect(posted.productVariationId).toBe(guest.productVariationId);
      expect(posted.quantity).toBe(guest.quantity);
    });

    it('omits childItems entirely when no side was chosen, so a plain line posts what it always did', async () => {
      const [posted] = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 1 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });
      expect(posted.childItems).toBeUndefined();
    });
  });

  /**
   * THE CONTROL, and it is not optional. Every "waiter === guest" above is also satisfied by two
   * paths that are identically wrong — including two that both return zero. This pins that the
   * fixture MOVES MONEY, and that it moves by an amount that scales with quantity.
   */
  describe('the control — the fixture actually prices a customization', () => {
    it('prices the plain line at the advertised base, twice over', async () => {
      const posted = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });
      expect(money(serverOrderTotal(posted))).toBe(BASE_PRICE * 2);
    });

    it('charges two rashers of bacon for two pizzas, not one', async () => {
      const plain = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });
      const withBacon = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 1 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });

      // This is the assertion the backend got wrong in #433 and only caught in #435: per DISH, not
      // per LINE. At quantity 1 the two readings are indistinguishable.
      expect(money(serverOrderTotal(withBacon))).toBe(money(serverOrderTotal(plain)) + BACON_PRICE * 2);
    });

    it('deducts two sauces for two pizzas when the sauce is taken off', async () => {
      const plain = await waiterPayload({
        quantities: { [SAUCE]: 1, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });
      const noSauce = await waiterPayload({
        quantities: { [SAUCE]: 0, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      });

      // The deduction ran the OTHER way in the backend defect — a single-direction control would
      // have missed half of it.
      expect(money(serverOrderTotal(noSauce))).toBe(money(serverOrderTotal(plain)) - SAUCE_PRICE * 2);
    });

    it('charges the side once per dish, so a quantity-2 line carries two cokes', async () => {
      const spec = {
        quantities: { [SAUCE]: 1, [BACON]: 0 },
        variationId: null,
        withSide: false,
        quantity: 2,
      } as const;
      const without = await waiterPayload({ ...spec });
      const withCoke = await waiterPayload({ ...spec, withSide: true });

      expect(money(serverOrderTotal(withCoke))).toBe(money(serverOrderTotal(without)) + COKE_PRICE * 2);
    });
  });

  /**
   * WHO AUTHORS THE PRICE. The omission #595 closes was not, by itself, a money defect — #594 had
   * already made the till's arithmetic agree with the server's rule, so a correct till and a
   * correct server produced the same number. What was missing was the SERVER'S ABILITY TO CHECK.
   *
   * So the demonstration is a till that is wrong. Both payloads are built from the same sheet and
   * then have their declared `unitPrice` corrupted, which is exactly what the staff carve-out used
   * to permit. With the selection present the server recomputes and the corruption is inert; with
   * it stripped — the pre-#595 body — the corruption is simply charged.
   */
  describe('the price stops being the till’s to declare', () => {
    const spec: LineSpec = {
      quantities: { [SAUCE]: 0, [BACON]: 1 },
      variationId: null,
      withSide: false,
      quantity: 2,
    };

    /** The pre-#595 body: the five fields `useTakeOrder` used to send, and nothing else. */
    const asPostedBefore = (dto: CreateOrderItemDto): CreateOrderItemDto => ({
      productId: dto.productId,
      productVariationId: dto.productVariationId,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      specialInstructions: dto.specialInstructions,
    });

    it('ignores a wrong declared unitPrice, because the line says what it is made of', async () => {
      const guest = await guestPayload(spec);
      const [posted] = await waiterPayload(spec);

      const tampered: CreateOrderItemDto = { ...posted, unitPrice: 999 };
      expect(money(serverOrderTotal([tampered]))).toBe(money(serverBasketTotal(guest)));
    });

    it('charged a wrong declared unitPrice before the selection was sent', async () => {
      const guest = await guestPayload(spec);
      const [posted] = await waiterPayload(spec);

      const before: CreateOrderItemDto = { ...asPostedBefore(posted), unitPrice: 999 };
      expect(before.selectedIngredientIds).toBeUndefined();
      expect(money(serverOrderTotal([before]))).toBe(999 * spec.quantity);
      expect(money(serverOrderTotal([before]))).not.toBe(money(serverBasketTotal(guest)));
    });

    it('recorded no ingredients and no side row before the selection was sent', async () => {
      const posted = await waiterPayload({ ...spec, withSide: true });

      expect(posted[0].selectedIngredientIds?.length).toBeGreaterThan(0);
      expect(posted[0].childItems).toHaveLength(1);

      // The S1 snapshot and the kitchen ticket are both built from these two fields. Stripped, the
      // extras survive only as prose inside `specialInstructions`, which no reader parses.
      const before = asPostedBefore(posted[0]);
      expect(before.selectedIngredientIds).toBeUndefined();
      expect(before.childItems).toBeUndefined();
      expect(before.specialInstructions).toContain('Extra Bacon');
    });
  });
});
