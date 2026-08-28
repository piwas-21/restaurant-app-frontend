import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useItemCustomizationSheet } from '@/hooks/menu/useItemCustomizationSheet';
import { getProductById } from '@/services/menuService';
import { useProductCustomizationSheet } from '../useProductCustomizationSheet';
import type { DetailedIngredient, ProductVariation } from '../productCustomizationTypes';

/**
 * S7 — THE PROPERTY: the guest sheet and the waiter sheet cannot disagree about money.
 *
 * The two sheets share no component, no state shape and no render. What they must share is the
 * price, because the same dish customised the same way is the same amount of money whoever typed
 * it in. Until this slice they did not: the waiter sheet ran its own arithmetic, blind to
 * `isIncludedInBasePrice` and to `maxQuantity`.
 *
 * The test drives BOTH REAL HOOKS — not two calls into the shared helper, which would prove only
 * that a function equals itself — across every ingredient quantity from 0 to `maxQuantity`, every
 * variation (including none), both side-item states and a line quantity above 1, and asserts three
 * things about each of those states:
 *
 *   1. the guest sheet's total equals the waiter sheet's total;
 *   2. both equal an INDEPENDENT transcription of the server's own
 *      `BasketPricingService.CalculateIngredientCustomizationPrice` (below), so "they agree" cannot
 *      be satisfied by two copies of the same mistake;
 *   3. the waiter sheet can actually REACH the state through its own controls — every case is
 *      driven by toggles and stepper presses, never by writing state directly.
 *
 * #605 ADDS THE SAUCE ALLOWANCE, which this header used to say was deliberately absent. It lands
 * exactly as predicted — one more branch in the oracle below, not a second price policy — and it is
 * the branch the waiter sheet was blind to: `ProductCustomizationDetail` dropped
 * `sauceIncludedFree` at the type boundary, so `useLinePrice` defaulted it to `0`, which is the
 * assertion "this product includes NO free sauces". Same class of defect as the one this file was
 * written for, in the same file, one field later.
 *
 * The sauce states are enumerated SEPARATELY rather than folded into the cross product above, and
 * the reason is runtime, not taste: two more rows would take the matrix from 24 cases to 144, each
 * driving two real hooks (~6.7s becomes ~40s). The sauce matrix is exhaustive in its own right and
 * both matrices carry a tripwire assertion, so neither can silently shrink.
 */

/** The server's clamp to [0, MaxQuantity]. Unselected rows are priced as quantity 1, as the C# does. */
function clampQuantity(ingredient: DetailedIngredient, requested: number): number {
  const quantity = requested > 0 ? requested : 1;
  if (quantity < 0) return 0;
  return Math.min(quantity, ingredient.maxQuantity ?? 1);
}

// ── The oracle. A line-by-line transcription of the C#, from the server, not from linePrice.ts. ──
//
//   foreach (var ingredient in detailedIngredients.Where(i => i.IsOptional && i.IsActive))
//   { ... clamp to [0, MaxQuantity] ...
//     if (ingredient.IsIncludedInBasePrice) { if (!isSelected) price -= Price;
//                                             else if (quantity > 1) price += Price * (quantity-1); }
//     else if (isSelected) { price += Price * quantity; } }
function serverIngredientCustomizationPrice(
  ingredients: readonly DetailedIngredient[],
  quantities: Readonly<Record<string, number>>,
): number {
  let customizationPrice = 0;

  for (const ingredient of ingredients) {
    if (!ingredient.isOptional || !ingredient.isActive) continue;

    const requested = quantities[ingredient.id] ?? 0;
    const isSelected = requested > 0;
    const quantity = clampQuantity(ingredient, requested);

    const price = ingredient.price ?? 0;
    if (ingredient.isIncludedInBasePrice) {
      if (!isSelected) customizationPrice -= price;
      else if (quantity > 1) customizationPrice += price * (quantity - 1);
    } else if (isSelected) {
      customizationPrice += price * quantity;
    }
  }

  return customizationPrice - serverSauceWaiver(ingredients, quantities);
}

/*
 * The sauce allowance, transcribed from `BasketPricingService.CalculateIngredientCustomizationPrice`
 * — the C# is quoted below — and NOT from `utils/sauceGroup.ts`, which is the code under test:
 *
 *   List<(decimal Price, int DisplayOrder, Guid Id)>? chargeableSauceUnits =
 *       sauceIncludedFree > 0 ? new List<(decimal, int, Guid)>() : null;
 *   ...
 *   if (chargeableSauceUnits != null && ingredient.Kind == IngredientKind.Sauce && ingredient.Price > 0)
 *   { int chargeableUnits = 0;
 *     if (isSelected) chargeableUnits = ingredient.IsIncludedInBasePrice ? Math.Max(0, quantity - 1) : quantity;
 *     for (int unit = 0; unit < chargeableUnits; unit++)
 *       chargeableSauceUnits.Add((ingredient.Price, ingredient.DisplayOrder, ingredient.Id)); }
 *   ...
 *   customizationPrice -= chargeableSauceUnits
 *       .OrderByDescending(u => u.Price).ThenBy(u => u.DisplayOrder).ThenBy(u => u.Id)
 *       .Take(sauceIncludedFree).Sum(u => u.Price);
 *
 * A list of UNITS, not of rows, because "2 sauces free" means two units — a guest who takes two of
 * the same sauce has spent the allowance just as surely as one who took two different ones. And the
 * allowance can only remove a charge this same loop added, so it can never invent a refund.
 */
interface SauceUnit {
  price: number;
  displayOrder: number;
  id: string;
}

/** `chargeableUnits` from the C#: what the loop is about to bill for THIS row, or 0 if unselected. */
function chargedUnitCount(ingredient: DetailedIngredient, isSelected: boolean, quantity: number): number {
  if (!isSelected) return 0;
  return ingredient.isIncludedInBasePrice ? Math.max(0, quantity - 1) : quantity;
}

/** `OrderByDescending(Price).ThenBy(DisplayOrder).ThenBy(Id).Take(N).Sum(Price)`. */
function waiveMostExpensive(units: readonly SauceUnit[], allowance: number): number {
  return [...units]
    .sort((a, b) => b.price - a.price || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
    .slice(0, allowance)
    .reduce((sum, unit) => sum + unit.price, 0);
}

function serverSauceWaiver(
  ingredients: readonly DetailedIngredient[],
  quantities: Readonly<Record<string, number>>,
): number {
  if (SAUCE_INCLUDED_FREE <= 0) return 0;

  const units: SauceUnit[] = [];

  for (const ingredient of ingredients) {
    if (!ingredient.isOptional || !ingredient.isActive) continue;
    if (ingredient.kind !== 'sauce' || (ingredient.price ?? 0) <= 0) continue;

    const requested = quantities[ingredient.id] ?? 0;
    const charged = chargedUnitCount(ingredient, requested > 0, clampQuantity(ingredient, requested));

    for (let unit = 0; unit < charged; unit += 1) {
      units.push({ price: ingredient.price ?? 0, displayOrder: ingredient.displayOrder ?? 0, id: ingredient.id });
    }
  }

  return waiveMostExpensive(units, SAUCE_INCLUDED_FREE);
}

// ── Fixture ──────────────────────────────────────────────────────────────────────────────────────
const BASE_PRICE = 10;

/** The product's free-sauce allowance (#605). Two, so the "take N" branch is exercised, not just N=1. */
const SAUCE_INCLUDED_FREE = 2;

const INGREDIENTS: DetailedIngredient[] = [
  {
    id: 'dough',
    name: 'Dough',
    isActive: true,
    isOptional: false,
    price: 0,
    isIncludedInBasePrice: true,
    maxQuantity: 1,
  },
  {
    id: 'cheese',
    name: 'Cheese',
    isActive: true,
    isOptional: true,
    price: 2,
    isIncludedInBasePrice: true,
    maxQuantity: 3,
  },
  {
    id: 'bacon',
    name: 'Bacon',
    isActive: true,
    isOptional: true,
    price: 1.5,
    isIncludedInBasePrice: false,
    maxQuantity: 2,
  },
  {
    id: 'basil',
    name: 'Basil',
    isActive: true,
    isOptional: true,
    price: 0.5,
    isIncludedInBasePrice: true,
    maxQuantity: 1,
  },
  {
    id: 'truffle',
    name: 'Truffle',
    isActive: false,
    isOptional: true,
    price: 9,
    isIncludedInBasePrice: false,
    maxQuantity: 4,
  },
  /*
   * Two sauce rows at DIFFERENT prices, so "the most expensive charged unit is waived first" is a
   * claim the fixture can actually falsify. With both at the same price the sort would be a no-op
   * and a wrong allocation order would still produce the right total.
   *
   * `garlic` also has maxQuantity 2, so a single row can spend the whole allowance by itself —
   * which is the "a list of UNITS, not of rows" half of the server's rule.
   */
  {
    id: 'sauce_garlic',
    name: 'Garlic sauce',
    isActive: true,
    isOptional: true,
    price: 3,
    isIncludedInBasePrice: false,
    maxQuantity: 2,
    kind: 'sauce',
    displayOrder: 1,
  },
  {
    id: 'sauce_chili',
    name: 'Chili sauce',
    isActive: true,
    isOptional: true,
    price: 1,
    isIncludedInBasePrice: false,
    maxQuantity: 1,
    kind: 'sauce',
    displayOrder: 2,
  },
];

const VARIATIONS: ProductVariation[] = [
  { id: 'small', name: 'Small', priceModifier: 0, finalPrice: 10, isActive: true, displayOrder: 1 },
  { id: 'large', name: 'Large', priceModifier: 3.5, finalPrice: 13.5, isActive: true, displayOrder: 2 },
];

const SIDES = [
  { id: 'fries', name: 'Fries', price: 4, isRequired: true, displayOrder: 1 },
  { id: 'coke', name: 'Coke', price: 2.5, isRequired: false, displayOrder: 2 },
];

const DETAIL = {
  id: 'p1',
  name: 'Margherita',
  basePrice: BASE_PRICE,
  sauceIncludedFree: SAUCE_INCLUDED_FREE,
  hideBaseProduct: false,
  variations: VARIATIONS,
  detailedIngredients: INGREDIENTS,
  suggestedSideItems: SIDES,
  allergens: [],
};

const OPTIONALS = INGREDIENTS.filter((i) => i.isOptional && i.isActive);

/** The cross product below covers the NON-sauce optionals; the sauce matrix covers the rest. */
const NON_SAUCE_OPTIONALS = OPTIONALS.filter((i) => i.kind !== 'sauce');

/** Every quantity from 0 (taken off / not ordered) to `maxQuantity`, for every optional. */
function everyQuantityCombination(): Array<Record<string, number>> {
  let combinations: Array<Record<string, number>> = [{}];

  for (const ingredient of NON_SAUCE_OPTIONALS) {
    const next: Array<Record<string, number>> = [];
    for (const combination of combinations) {
      for (let quantity = 0; quantity <= (ingredient.maxQuantity ?? 1); quantity++) {
        next.push({ ...combination, [ingredient.id]: quantity });
      }
    }
    combinations = next;
  }

  return combinations;
}

const CASES = everyQuantityCombination();

/**
 * Every sauce state: garlic 0-2 × chili 0-1 = 6, run against a fixed non-sauce baseline.
 *
 * Enumerated rather than folded into `CASES` because the product of the two would be 144 cases each
 * driving two real hooks. The allowance is 2, so this matrix spans every side of it — nothing
 * charged (0 units), part of it spent (1), exactly spent (2) and OVERSPENT (3 units against an
 * allowance of 2), which is the only state that proves the `Take(N)` is really a cap.
 */
const SAUCE_CASES: Array<Record<string, number>> = [];
for (let garlic = 0; garlic <= 2; garlic += 1) {
  for (let chili = 0; chili <= 1; chili += 1) {
    SAUCE_CASES.push({ sauce_garlic: garlic, sauce_chili: chili });
  }
}

/** What the line must cost, derived from the server's rule and nothing else. */
function expectedTotal(
  quantities: Record<string, number>,
  variationId: string | null,
  withOptionalSide: boolean,
  lineQuantity: number,
): number {
  const variation = VARIATIONS.find((v) => v.id === variationId);
  const sides = 4 + (withOptionalSide ? 2.5 : 0); // fries are required on both sheets
  const unit =
    BASE_PRICE + (variation?.priceModifier ?? 0) + serverIngredientCustomizationPrice(INGREDIENTS, quantities) + sides;
  return unit * lineQuantity;
}

// ── Mocks ────────────────────────────────────────────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('@/services/menuService', () => ({ getProductById: jest.fn() }));
jest.mock('@/components/cart/CartContext', () => ({ useCart: () => ({ addItem: jest.fn() }) }));
jest.mock('@/hooks/cart/useCartFeedback', () => ({
  useCartFeedback: () => ({ notifyItemAdded: jest.fn(), notifyAddFailed: jest.fn() }),
}));

const product = { id: 'p1', name: 'Margherita', basePrice: BASE_PRICE } as never;

beforeEach(() => {
  (getProductById as jest.Mock).mockResolvedValue({ success: true, data: DETAIL });
});

/** The guest sheet, opened and driven to the target state. */
async function guestTotal(
  quantities: Record<string, number>,
  variationId: string | null,
  withOptionalSide: boolean,
  lineQuantity: number,
): Promise<number> {
  const { result } = renderHook(() => useItemCustomizationSheet());
  await act(async () => {
    await result.current.openForProduct('p1', { forceSheet: true });
  });
  await waitFor(() => expect(result.current.isOpen).toBe(true));

  act(() => {
    result.current.setSelectedIngredients(Object.keys(quantities).filter((id) => quantities[id] > 0));
    result.current.setIngredientQuantities(quantities);
    result.current.setSelectedVariationId(variationId);
    result.current.setSelectedSideItems(
      withOptionalSide
        ? [
            { id: 'fries', quantity: 1 },
            { id: 'coke', quantity: 1 },
          ]
        : [{ id: 'fries', quantity: 1 }],
    );
    result.current.setQuantity(lineQuantity);
  });

  return result.current.linePrice.total;
}

/**
 * The waiter sheet, driven THROUGH ITS OWN CONTROLS to the same state. Nothing here writes state
 * directly, so a state the oracle can describe and the UI cannot reach fails this test.
 */
async function waiterTotal(
  quantities: Record<string, number>,
  variationId: string | null,
  withOptionalSide: boolean,
  lineQuantity: number,
): Promise<number> {
  const { result } = renderHook(() =>
    useProductCustomizationSheet({ product, isOpen: true, onClose: jest.fn(), onConfirm: jest.fn() }),
  );
  await waitFor(() => expect(result.current.optionalIngredients).toHaveLength(OPTIONALS.length));

  for (const ingredient of OPTIONALS) {
    const target = quantities[ingredient.id] ?? 0;
    // The sheet opens on the base recipe: an included-in-base ingredient starts at 1, a paid one at 0.
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

  if (variationId) {
    const variation = VARIATIONS.find((v) => v.id === variationId)!;
    act(() => result.current.selectVariation(variation));
  }
  if (withOptionalSide) act(() => result.current.toggleSideItem('coke'));
  act(() => result.current.setQuantity(lineQuantity));

  return result.current.totalPrice;
}

const money = (amount: number) => Math.round(amount * 100) / 100;

describe('S7 — the guest sheet and the waiter sheet price the same line identically', () => {
  it.each(CASES.map((quantities) => [JSON.stringify(quantities), quantities] as const))(
    'agrees with the server on %s',
    async (_label, quantities) => {
      // Two variation states and two line quantities per combination, plus the optional side, so
      // the ingredient rules are exercised against a non-zero variation modifier and a multiplier.
      for (const variationId of [null, 'large'] as const) {
        for (const lineQuantity of [1, 3]) {
          const withOptionalSide = lineQuantity === 3;
          const expected = money(expectedTotal(quantities, variationId, withOptionalSide, lineQuantity));

          const guest = money(await guestTotal(quantities, variationId, withOptionalSide, lineQuantity));
          const waiter = money(await waiterTotal(quantities, variationId, withOptionalSide, lineQuantity));

          expect(guest).toBe(expected);
          expect(waiter).toBe(expected);
          expect(waiter).toBe(guest);
        }
      }
    },
  );

  it('covers every quantity of every non-sauce optional ingredient, 0 through max', () => {
    // 4 cheese × 3 bacon × 2 basil = 24 ingredient states, each run against 2 variations × 2 line
    // quantities. The assertion exists so a fixture edit cannot silently shrink the matrix.
    expect(CASES).toHaveLength(24);
    for (const ingredient of NON_SAUCE_OPTIONALS) {
      const seen = new Set(CASES.map((c) => c[ingredient.id]));
      expect(seen.size).toBe((ingredient.maxQuantity ?? 1) + 1);
      expect(Math.max(...seen)).toBe(ingredient.maxQuantity ?? 1);
    }
  });

  it('would have caught the defect it was written for', () => {
    // The old waiter arithmetic, reproduced: no included-in-base branch, no quantity.
    const oldWaiterDelta = (quantities: Record<string, number>) =>
      INGREDIENTS.filter((i) => i.isOptional && i.isActive && (quantities[i.id] ?? 0) > 0).reduce(
        (sum, i) => sum + (i.price ?? 0),
        0,
      );

    const onlyCheese = { cheese: 1, bacon: 0, basil: 0 };
    expect(oldWaiterDelta(onlyCheese)).toBe(2);
    expect(serverIngredientCustomizationPrice(INGREDIENTS, onlyCheese)).toBe(-0.5); // basil taken off
  });
});

/**
 * #605 — the sauce allowance, on the same property.
 *
 * The defect this covers is one line: `ProductCustomizationDetail` did not carry
 * `sauceIncludedFree`, so the waiter sheet called `useLinePrice` without it and the hook read the
 * missing argument as `0` — "this product includes no free sauces". The guest sheet passed it all
 * along, so the two sheets disagreed about money on any product with an allowance.
 *
 * Dormant on production today ONLY because no product has an allowance yet. That is a fact about
 * DATA, and it stops being true the first time an admin types a number into the field.
 */
describe('#605 — both sheets spend the product free-sauce allowance identically', () => {
  it.each(SAUCE_CASES.map((quantities) => [JSON.stringify(quantities), quantities] as const))(
    'agrees with the server on %s',
    async (_label, sauceQuantities) => {
      // A non-empty non-sauce baseline, so the allowance is subtracted from a line that already has
      // customisation money in it rather than from a bare base price.
      const quantities = { ...sauceQuantities, cheese: 2, bacon: 1 };

      // Quantity 3, not 1: the allowance is a UNIT-price rule, so a multiplier is the difference
      // between waiving once and waiving on every unit of the line. Every money bug found on this
      // path tonight was invisible at quantity 1.
      for (const lineQuantity of [1, 3]) {
        const expected = money(expectedTotal(quantities, 'large', true, lineQuantity));

        const guest = money(await guestTotal(quantities, 'large', true, lineQuantity));
        const waiter = money(await waiterTotal(quantities, 'large', true, lineQuantity));

        expect(guest).toBe(expected);
        expect(waiter).toBe(expected);
        expect(waiter).toBe(guest);
      }
    },
  );

  it('spans both sides of the allowance, including overspending it', () => {
    // The tripwire, so a fixture edit cannot quietly drop the case that matters. Chargeable UNITS
    // per case, against an allowance of 2.
    expect(SAUCE_CASES).toHaveLength(6);
    const units = SAUCE_CASES.map((c) => (c.sauce_garlic ?? 0) + (c.sauce_chili ?? 0));
    expect(Math.min(...units)).toBe(0);
    expect(Math.max(...units)).toBe(3);
    expect(units).toContain(SAUCE_INCLUDED_FREE);
  });

  it('waives the MOST EXPENSIVE units first, which a cheaper-first allocation would get wrong', () => {
    // Garlic 3.00 ×1 and chili 1.00 ×1: three chargeable units of value 3, 3 and 1 when garlic is
    // taken twice. With an allowance of 2 the server waives 3 + 3 = 6, not 1 + 3 = 4. Asserted on
    // the ORACLE, so this states the server's rule rather than re-reading the app's implementation.
    const bothMaxed = { sauce_garlic: 2, sauce_chili: 1 };
    const noSauces = { sauce_garlic: 0, sauce_chili: 0 };

    const sauceCost = expectedTotal(bothMaxed, null, false, 1) - expectedTotal(noSauces, null, false, 1);

    // 3 + 3 + 1 charged, 3 + 3 waived → 1 remains. A cheapest-first waiver would leave 3.
    expect(money(sauceCost)).toBe(1);
  });
});
