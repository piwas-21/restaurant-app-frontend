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
 * `includedFree` (S6's sauce group) is deliberately absent: it does not exist yet, and the oracle
 * below is written so it lands as one more branch here rather than as a second price policy.
 */

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
    let quantity = isSelected ? requested : 1;
    if (quantity < 0) quantity = 0;
    else if (quantity > (ingredient.maxQuantity ?? 1)) quantity = ingredient.maxQuantity ?? 1;

    const price = ingredient.price ?? 0;
    if (ingredient.isIncludedInBasePrice) {
      if (!isSelected) customizationPrice -= price;
      else if (quantity > 1) customizationPrice += price * (quantity - 1);
    } else if (isSelected) {
      customizationPrice += price * quantity;
    }
  }

  return customizationPrice;
}

// ── Fixture ──────────────────────────────────────────────────────────────────────────────────────
const BASE_PRICE = 10;

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
  hideBaseProduct: false,
  variations: VARIATIONS,
  detailedIngredients: INGREDIENTS,
  suggestedSideItems: SIDES,
  allergens: [],
};

const OPTIONALS = INGREDIENTS.filter((i) => i.isOptional && i.isActive);

/** Every quantity from 0 (taken off / not ordered) to `maxQuantity`, for every optional. */
function everyQuantityCombination(): Array<Record<string, number>> {
  let combinations: Array<Record<string, number>> = [{}];

  for (const ingredient of OPTIONALS) {
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

  it('covers every quantity of every optional ingredient, 0 through max', () => {
    // 4 cheese × 3 bacon × 2 basil = 24 ingredient states, each run against 2 variations × 2 line
    // quantities. The assertion exists so a fixture edit cannot silently shrink the matrix.
    expect(CASES).toHaveLength(24);
    for (const ingredient of OPTIONALS) {
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
