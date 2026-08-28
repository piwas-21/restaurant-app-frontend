import { renderHook } from '@testing-library/react';
import { useLinePrice } from './useLinePrice';

describe('useLinePrice', () => {
  it('prices a product line (unit + total) from the base + customization', () => {
    const { result } = renderHook(() =>
      useLinePrice({
        kind: 'product',
        basePrice: 10,
        quantity: 2,
        ingredients: [{ id: 'bacon', price: 3, isOptional: true, isActive: true, isIncludedInBasePrice: false }],
        selectedIngredientIds: ['bacon'],
      }),
    );
    // unit 10 + 3 = 13; total 13 × 2 = 26
    expect(result.current.unitPrice).toBe(13);
    expect(result.current.total).toBe(26);
  });

  /**
   * The BUNDLE path's free-sauce allowance, pinned against the PRODUCT path as its oracle.
   *
   * Two things nothing else covered. First, the value TRAVELS: the allowance is read off the
   * section ITEM (`MenuSectionItem.sauceIncludedFree` — the option product's own rule, since the
   * parent bundle owns no sauce rows), so losing it anywhere between the section and the
   * arithmetic turns this red while the pure-function tests stay green. Second, the quantity is
   * **2 as well as 1**: at quantity 1 a missing allowance, a per-LINE allowance and a per-UNIT one
   * give the same answer. The backend subtracts it inside the per-unit delta
   * (`BasketPricingService.CalculateIngredientCustomizationPrice`), so two pizzas with "the first
   * sauce free" get two free sauces.
   *
   * The oracle is not a number derived from the bundle code: it is what the PRODUCT line charges
   * for the same rows, and that path is the one already pinned against the backend port. Parity
   * alone is satisfied by two identically-wrong paths — including two that both return zero — so
   * the three CONTROL cases below pin that the fixture actually moves money.
   *
   * Mutation signature, measured rather than predicted. Dropping `item.sauceIncludedFree` on the
   * bundle path turns all three cases red. Moving the waiver from per-unit to per-line leaves the
   * quantity-1 TOTAL identical — the two are indistinguishable there — and is caught only because
   * the per-UNIT price is asserted as well as the total. So the unit assertion is not redundant
   * with the total: it is the one that separates a per-unit term from a per-line one.
   */
  describe('the free-sauce allowance of a bundle option', () => {
    const sauces = [
      { id: 'aioli', price: 1.5, isOptional: true, isActive: true, kind: 'sauce' as const, displayOrder: 1 },
      { id: 'truffle', price: 2.5, isOptional: true, isActive: true, kind: 'sauce' as const, displayOrder: 2 },
    ];
    const BASE = 12;

    const inBundle = (quantity: number, sauceIncludedFree: number, picks: readonly string[]) =>
      renderHook(() =>
        useLinePrice({
          kind: 'bundle',
          basePrice: BASE,
          quantity,
          sections: [
            {
              id: 'main',
              items: [{ productId: 'pizza', additionalPrice: 0, detailedIngredients: sauces, sauceIncludedFree }],
            },
          ],
          selectedOptions: [{ sectionId: 'main', itemId: 'pizza', quantity: 1, selectedIngredients: [...picks] }],
        }),
      ).result.current;

    const alone = (quantity: number, sauceIncludedFree: number, picks: readonly string[]) =>
      renderHook(() =>
        useLinePrice({
          kind: 'product',
          basePrice: BASE,
          quantity,
          ingredients: sauces,
          selectedIngredientIds: [...picks],
          sauceIncludedFree,
        }),
      ).result.current;

    it.each([1, 2])('prices a bundle option exactly as the same product bought alone (quantity %i)', (quantity) => {
      const bundled = inBundle(quantity, 1, ['aioli', 'truffle']);
      const standalone = alone(quantity, 1, ['aioli', 'truffle']);

      expect(bundled.unitPrice).toBeCloseTo(standalone.unitPrice, 5);
      expect(bundled.total).toBeCloseTo(standalone.total, 5);
      // 12 + 1.50 + 2.50 − 2.50 waived = 13.50 a unit. No allowance would be 16.00 a unit;
      // waiving once per LINE would leave the unit at 16.00 and the pair at 29.50.
      expect(bundled.unitPrice).toBeCloseTo(13.5, 5);
      expect(bundled.total).toBeCloseTo(13.5 * quantity, 5);
    });

    // CONTROL — without these, "bundle == product" is satisfied by two paths that are wrong in the
    // same way, and the file could quietly become a tautology after a later refactor.
    it('moves money at all: no sauce, one paid sauce, one waived sauce', () => {
      expect(inBundle(2, 0, []).total).toBeCloseTo(2 * BASE, 5);
      expect(inBundle(2, 0, ['aioli']).total).toBeCloseTo(2 * BASE + 2 * 1.5, 5);
      // The allowance pays for exactly one sauce PER UNIT, so it cancels the line's only extra.
      expect(inBundle(2, 1, ['aioli']).total).toBeCloseTo(2 * BASE, 5);
    });
  });

  it('prices a bundle line from base + section additionals', () => {
    const { result } = renderHook(() =>
      useLinePrice({
        kind: 'bundle',
        basePrice: 8,
        quantity: 1,
        sections: [
          { id: 'main', items: [{ productId: 'pizza', additionalPrice: 2.99 }] },
          { id: 'drink', items: [{ productId: 'cola', additionalPrice: 1.99 }] },
        ],
        selectedOptions: [
          { sectionId: 'main', itemId: 'pizza', quantity: 1 },
          { sectionId: 'drink', itemId: 'cola', quantity: 1 },
        ],
      }),
    );
    expect(result.current.unitPrice).toBeCloseTo(12.98, 5);
    expect(result.current.total).toBeCloseTo(12.98, 5);
  });
});
