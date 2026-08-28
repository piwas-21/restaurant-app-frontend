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
   * Two things this covers that nothing else did. First, the value TRAVELS: the allowance is read
   * off the section ITEM (`MenuSectionItem.sauceIncludedFree`, the option product's own rule —
   * the parent bundle owns no sauce rows), so dropping it anywhere between the section and the
   * arithmetic turns this red while the pure-function tests stay green. Second, the quantity is
   * **2, deliberately**: at quantity 1 a missing allowance, a per-LINE allowance and a per-UNIT
   * allowance are three different code paths with the same answer. The backend subtracts it inside
   * the per-unit delta, so two pizzas with "one sauce free" get two free sauces.
   *
   * The expected number is not derived from the bundle code: it is whatever the product line
   * charges for the same rows, and the product line is the port already pinned against
   * `BasketPricingService`. The literal is asserted too, so a matching pair of wrong answers
   * cannot agree its way to green.
   */
  it('gives a bundle option the same free-sauce allowance as the same product bought alone', () => {
    const sauces = [
      { id: 'aioli', price: 1.5, isOptional: true, isActive: true, kind: 'sauce' as const, displayOrder: 1 },
      { id: 'truffle', price: 2.5, isOptional: true, isActive: true, kind: 'sauce' as const, displayOrder: 2 },
    ];
    const picks = ['aioli', 'truffle'];

    const alone = renderHook(() =>
      useLinePrice({
        kind: 'product',
        basePrice: 12,
        quantity: 2,
        ingredients: sauces,
        selectedIngredientIds: picks,
        sauceIncludedFree: 1,
      }),
    );

    const inBundle = renderHook(() =>
      useLinePrice({
        kind: 'bundle',
        basePrice: 12,
        quantity: 2,
        sections: [
          {
            id: 'main',
            items: [{ productId: 'pizza', additionalPrice: 0, detailedIngredients: sauces, sauceIncludedFree: 1 }],
          },
        ],
        selectedOptions: [{ sectionId: 'main', itemId: 'pizza', quantity: 1, selectedIngredients: picks }],
      }),
    );

    expect(inBundle.result.current.unitPrice).toBeCloseTo(alone.result.current.unitPrice, 5);
    expect(inBundle.result.current.total).toBeCloseTo(alone.result.current.total, 5);

    // 12 + 1.50 + 2.50 − 2.50 waived = 13.50 a unit, 27.00 for two. No allowance would be 32.00;
    // waiving once per LINE instead of once per unit would be 29.50.
    expect(inBundle.result.current.unitPrice).toBeCloseTo(13.5, 5);
    expect(inBundle.result.current.total).toBeCloseTo(27, 5);
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
