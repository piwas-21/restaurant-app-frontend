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
