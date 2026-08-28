import { ingredientCustomizationPrice, type PriceableIngredient } from './linePrice';
import {
  chargeableSauceUnits,
  isSauce,
  isSauceGroupFull,
  sauceWaiverAmount,
  sauceWidget,
  toSauceGroupRule,
  waivedSauceUnits,
} from './sauceGroup';

/**
 * The money half of S6.
 *
 * `includedFree` has exactly one writer on the server (`BasketPricingService`), and this file's job
 * is to prove the browser mirror agrees with the RULE that writer implements — for every selection
 * and every quantity, not for the three cases someone thought of. The reference implementation
 * below is written independently of `sauceGroup.ts` (it re-derives the whole delta from the
 * ingredient definitions rather than reusing the allocation), so the property test compares two
 * different pieces of code and not one piece of code with itself.
 */

const sauce = (id: string, price: number, displayOrder: number, extra: Partial<PriceableIngredient> = {}) =>
  ({
    id,
    price,
    displayOrder,
    isOptional: true,
    isActive: true,
    kind: 'sauce',
    maxQuantity: 3,
    ...extra,
  }) satisfies PriceableIngredient;

const ingredient = (id: string, price: number, extra: Partial<PriceableIngredient> = {}) =>
  ({ id, price, isOptional: true, isActive: true, ...extra }) satisfies PriceableIngredient;

/** The per-row half of the rule, stated once: what this row moves, and what it CHARGES for. */
function referenceRow(
  item: PriceableIngredient,
  isSelected: boolean,
  quantities: Record<string, number>,
): { delta: number; charged: number } {
  const quantity = Math.max(0, Math.min(item.maxQuantity ?? 1, quantities[item.id] ?? 1));

  if (item.isIncludedInBasePrice) {
    if (!isSelected) return { delta: -item.price, charged: 0 };
    const charged = Math.max(0, quantity - 1);
    return { delta: item.price * charged, charged };
  }

  const charged = isSelected ? quantity : 0;
  return { delta: item.price * charged, charged };
}

/** An independent statement of the backend rule: per-row pricing, then waive the N dearest charges. */
function referencePrice(
  ingredients: readonly PriceableIngredient[],
  selected: readonly string[],
  quantities: Record<string, number>,
  includedFree: number,
): number {
  let delta = 0;
  const charges: { price: number; displayOrder: number; id: string }[] = [];

  for (const item of ingredients) {
    if (!item.isOptional || !item.isActive) continue;

    const row = referenceRow(item, selected.includes(item.id), quantities);
    delta += row.delta;

    if (item.kind === 'sauce' && item.price > 0) {
      for (let unit = 0; unit < row.charged; unit += 1) {
        charges.push({ price: item.price, displayOrder: item.displayOrder ?? 0, id: item.id });
      }
    }
  }

  charges.sort((a, b) => b.price - a.price || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  return delta - charges.slice(0, Math.max(0, includedFree)).reduce((sum, charge) => sum + charge.price, 0);
}

describe('sauceGroup — reading the rule off the wire', () => {
  it('degrades every absent field to the neutral rule, and keeps a zero cap', () => {
    expect(toSauceGroupRule(undefined)).toEqual({ min: 0, max: null, includedFree: 0 });
    expect(toSauceGroupRule({ sauceMax: null })).toEqual({ min: 0, max: null, includedFree: 0 });
    // 0 is a real cap ("takes no sauces"), and must NOT collapse into "no cap".
    expect(toSauceGroupRule({ sauceMin: 1, sauceMax: 0, sauceIncludedFree: 2 })).toEqual({
      min: 1,
      max: 0,
      includedFree: 2,
    });
  });

  it('treats a row with no kind as an ingredient', () => {
    expect(isSauce({})).toBe(false);
    expect(isSauce({ kind: 'ingredient' })).toBe(false);
    expect(isSauce({ kind: 'sauce' })).toBe(true);
  });

  it('derives the widget from the cap and never from an admin choice', () => {
    expect(sauceWidget({ min: 1, max: 1, includedFree: 0 })).toBe('radio');
    expect(sauceWidget({ min: 0, max: 3, includedFree: 1 })).toBe('checkbox');
    expect(sauceWidget({ min: 0, max: null, includedFree: 0 })).toBe('checkbox');
  });

  it('is only ever full against a real cap', () => {
    expect(isSauceGroupFull(9, { min: 0, max: null, includedFree: 0 })).toBe(false);
    expect(isSauceGroupFull(2, { min: 0, max: 3, includedFree: 1 })).toBe(false);
    expect(isSauceGroupFull(3, { min: 0, max: 3, includedFree: 1 })).toBe(true);
  });
});

describe('sauceGroup — which sauces the allowance pays for', () => {
  const sauces = [sauce('a', 0.5, 1), sauce('b', 2, 2), sauce('c', 0.5, 3)];

  it('waives the most expensive charged sauce first', () => {
    expect(waivedSauceUnits(sauces, ['a', 'b'], {}, 1)).toEqual(new Map([['b', 1]]));
    expect(sauceWaiverAmount(sauces, ['a', 'b'], {}, 1)).toBe(2);
  });

  it('falls back to display order when two sauces cost the same — the badge the design draws', () => {
    expect(waivedSauceUnits(sauces, ['c', 'a'], {}, 1)).toEqual(new Map([['a', 1]]));
  });

  it('cannot be steered by the ORDER of the selection array', () => {
    expect(sauceWaiverAmount(sauces, ['b', 'a', 'c'], {}, 2)).toBe(sauceWaiverAmount(sauces, ['c', 'b', 'a'], {}, 2));
  });

  it('waives nothing for a deselected sauce, so it can never invent a refund', () => {
    expect(waivedSauceUnits(sauces, [], {}, 3).size).toBe(0);
    expect(sauceWaiverAmount(sauces, [], {}, 3)).toBe(0);
  });

  it('counts only the EXTRA units of a sauce already included in the base price', () => {
    const included = sauce('inc', 1, 1, { isIncludedInBasePrice: true });
    expect(chargeableSauceUnits(included, true, { inc: 1 })).toBe(0);
    expect(chargeableSauceUnits(included, true, { inc: 3 })).toBe(2);
    expect(chargeableSauceUnits(included, false, { inc: 3 })).toBe(0);
  });

  it('never waives more units than the guest is being charged for', () => {
    expect(sauceWaiverAmount(sauces, ['a'], {}, 5)).toBe(0.5);
  });

  it('defaults a missing maxQuantity to one unit, as the backend clamp does', () => {
    const noMax = { id: 'plain', price: 1, isOptional: true, isActive: true, kind: 'sauce' as const };
    expect(chargeableSauceUnits(noMax, true, { plain: 9 })).toBe(1);
  });

  it('falls back to the id when price AND display order tie — same money, one stable badge', () => {
    const twins = [sauce('b-id', 1, 1), sauce('a-id', 1, 1)];
    expect(waivedSauceUnits(twins, ['a-id', 'b-id'], {}, 1)).toEqual(new Map([['a-id', 1]]));
  });

  it('treats a sauce with no display order as the first of its price, whichever side it is on', () => {
    const noOrder = { id: 'z', price: 1, isOptional: true, isActive: true, kind: 'sauce' as const };
    const ordered = sauce('y', 1, 5);
    expect(waivedSauceUnits([ordered, noOrder], ['y', 'z'], {}, 1)).toEqual(new Map([['z', 1]]));
    expect(waivedSauceUnits([noOrder, ordered], ['y', 'z'], {}, 1)).toEqual(new Map([['z', 1]]));
  });

  it('is a no-op with no ingredient list at all', () => {
    expect(waivedSauceUnits(undefined, ['x'], {}, 2).size).toBe(0);
    expect(sauceWaiverAmount(undefined, ['x'], {}, 2)).toBe(0);
  });

  it('ignores an inactive or non-optional sauce, exactly as the pricing filter does', () => {
    const rows = [sauce('x', 1, 1, { isActive: false }), sauce('y', 1, 2, { isOptional: false })];
    expect(waivedSauceUnits(rows, ['x', 'y'], {}, 2).size).toBe(0);
  });
});

describe('ingredientCustomizationPrice — the allowance rides on top of the per-row rule', () => {
  const rows = [
    ingredient('cheese', 1.5, { isIncludedInBasePrice: true }),
    ingredient('olives', 1),
    sauce('aioli', 0.5, 1),
    sauce('truffle', 2, 2),
  ];

  it('is byte-identical to pre-S6 pricing when nothing is free — every product on prod today', () => {
    const selection = ['cheese', 'olives', 'aioli', 'truffle'];
    expect(ingredientCustomizationPrice(rows, selection, {}, 0)).toBe(
      ingredientCustomizationPrice(rows, selection, {}),
    );
    expect(ingredientCustomizationPrice(rows, selection, {}, 0)).toBe(3.5);
  });

  it('takes the dearest chosen sauce off the line when one is free', () => {
    expect(ingredientCustomizationPrice(rows, ['cheese', 'aioli', 'truffle'], {}, 1)).toBe(0.5);
  });

  it('still refunds a deselected included ingredient, allowance or not', () => {
    expect(ingredientCustomizationPrice(rows, ['aioli'], {}, 1)).toBe(-1.5);
  });

  /**
   * The property the plan asks for by name: 0…max selections at qty > 1, every combination, against
   * an independently written statement of the same rule.
   */
  it('matches the reference rule for every selection and quantity', () => {
    const ids = rows.map((row) => row.id);
    for (let mask = 0; mask < 2 ** ids.length; mask += 1) {
      const selected = ids.filter((_, index) => (mask & (1 << index)) !== 0);
      for (const quantity of [1, 2, 3]) {
        const quantities = Object.fromEntries(selected.map((id) => [id, quantity]));
        for (const includedFree of [0, 1, 2, 3]) {
          expect(ingredientCustomizationPrice(rows, selected, quantities, includedFree)).toBeCloseTo(
            referencePrice(rows, selected, quantities, includedFree),
            10,
          );
        }
      }
    }
  });

  it('clamps a tampered quantity before the allowance sees it', () => {
    // `cheese` stays selected so the only movement on the line is the sauce being tampered with.
    expect(ingredientCustomizationPrice(rows, ['cheese', 'truffle'], { truffle: -5 }, 0)).toBe(0);
    expect(ingredientCustomizationPrice(rows, ['cheese', 'truffle'], { truffle: 99 }, 1)).toBe(4);
  });
});
