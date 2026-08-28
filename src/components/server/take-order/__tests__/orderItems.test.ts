import { mapMenuProducts, addCustomizedItem, OrderItem } from '../orderItems';
import type { Product } from '@/services/serverService';
import type { CustomizationResult } from '../../ProductCustomization';

/**
 * Pure-logic tests for the take-order helpers. These lock the load-bearing
 * behaviour the decomposition must preserve byte-for-byte: the `/api/Products`
 * projection, the dedup key, and the note-building string.
 */

const baseProduct: Product = {
  id: 'p1',
  name: 'Margherita',
  description: 'Classic',
  basePrice: 12,
  isActive: true,
  isAvailable: true,
  type: 'Food',
};

function makeResult(overrides: Partial<CustomizationResult> = {}): CustomizationResult {
  return {
    productId: 'p1',
    variationId: undefined,
    variationName: undefined,
    addedIngredients: [],
    removedIngredients: [],
    sideItems: [],
    specialInstructions: undefined,
    finalPrice: 12,
    ...overrides,
  };
}

describe('mapMenuProducts', () => {
  it('projects the raw /api/Products items onto the server Product fields', () => {
    const raw = [
      {
        id: 'p1',
        name: 'Margherita',
        description: 'Classic',
        basePrice: 12,
        isActive: true,
        isAvailable: true,
        type: 'Food',
        categories: [{ categoryId: 'c1', categoryName: 'Pizzas', isPrimary: true }],
        primaryCategoryId: 'c1',
        imageUrl: '/img/p1.png',
        variations: [{ id: 'v1', name: 'Large', priceModifier: 2, isActive: true }],
        // fields the server Product type does not carry — must be dropped:
        images: [{ id: 'i1', url: '/img/p1.png', altText: '', isPrimary: true, sortOrder: 0 }],
        isSpecial: true,
      },
    ];

    const [mapped] = mapMenuProducts(raw);

    expect(mapped.id).toBe('p1');
    expect(mapped.name).toBe('Margherita');
    expect(mapped.basePrice).toBe(12);
    expect(mapped.type).toBe('Food');
    expect(mapped.primaryCategoryId).toBe('c1');
    expect(mapped.imageUrl).toBe('/img/p1.png');
    expect(mapped.categories).toEqual([{ categoryId: 'c1', categoryName: 'Pizzas', isPrimary: true }]);
    expect(mapped.variations).toEqual([{ id: 'v1', name: 'Large', priceModifier: 2, isActive: true }]);
    // Extra raw fields are not carried onto the projected Product.
    expect(mapped).not.toHaveProperty('images');
    expect(mapped).not.toHaveProperty('isSpecial');
  });
});

describe('addCustomizedItem', () => {
  it('appends a new line at quantity 1 with the built note string', () => {
    const result = makeResult({
      variationId: 'v1',
      variationName: 'Large',
      addedIngredients: [{ id: 'a1', name: 'Cheese', price: 1, quantity: 1 }],
      sideItems: [{ id: 's1', name: 'Fries', quantity: 1, price: 2 }],
      specialInstructions: 'Extra hot',
      finalPrice: 18,
    });

    const next = addCustomizedItem([], baseProduct, result);

    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe(1);
    expect(next[0].unitPrice).toBe(18);
    expect(next[0].variationId).toBe('v1');
    // Note format: variationName | Add: … | Sides: … | specialInstructions
    expect(next[0].notes).toBe('Large | Add: Cheese | Sides: Fries | Extra hot');
  });

  it('leaves notes undefined when there are no customization parts', () => {
    const next = addCustomizedItem([], baseProduct, makeResult());
    expect(next[0].notes).toBeUndefined();
  });

  it('increments quantity instead of appending when an identical line already exists', () => {
    const first = addCustomizedItem([], baseProduct, makeResult({ finalPrice: 12 }));
    const second = addCustomizedItem(first, baseProduct, makeResult({ finalPrice: 12 }));

    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(2);
  });

  it('appends a separate line when the variation differs (dedup key includes variationId)', () => {
    const first = addCustomizedItem([], baseProduct, makeResult({ variationId: 'v1' }));
    const second = addCustomizedItem(first, baseProduct, makeResult({ variationId: 'v2' }));

    expect(second).toHaveLength(2);
    expect(second.map((i: OrderItem) => i.variationId)).toEqual(['v1', 'v2']);
  });

  it('appends a separate line when the added-ingredient set differs', () => {
    const first = addCustomizedItem([], baseProduct, makeResult({ addedIngredients: [] }));
    const second = addCustomizedItem(
      first,
      baseProduct,
      makeResult({ addedIngredients: [{ id: 'a1', name: 'Cheese', price: 1, quantity: 1 }] }),
    );

    expect(second).toHaveLength(2);
  });

  /**
   * S7 — the two states the sheet could not reach before it opened on the base recipe. Both are
   * ADDITIVE to the note format: a line a waiter could have entered before S7 (every addition at
   * quantity 1, nothing removed) still produces the byte-identical string asserted above.
   */
  describe('S7 — quantities and removals', () => {
    it('prefixes a multiple with its count, and leaves a single alone', () => {
      const next = addCustomizedItem(
        [],
        baseProduct,
        makeResult({
          addedIngredients: [
            { id: 'a1', name: 'Bacon', price: 1.5, quantity: 2 },
            { id: 'a2', name: 'Basil', price: 0.5, quantity: 1 },
          ],
        }),
      );

      expect(next[0].notes).toBe('Add: 2× Bacon, Basil');
    });

    it("says what came OFF the dish, in the kitchen ticket's own vocabulary", () => {
      const next = addCustomizedItem(
        [],
        baseProduct,
        makeResult({ removedIngredients: [{ id: 'r1', name: 'Onion', price: 0.5, quantity: 1 }] }),
      );

      expect(next[0].notes).toBe('No: Onion');
    });

    it('keeps a removal out of an otherwise identical line — they are different dishes', () => {
      const withOnion = addCustomizedItem([], baseProduct, makeResult());
      const withoutOnion = addCustomizedItem(
        withOnion,
        baseProduct,
        makeResult({ removedIngredients: [{ id: 'r1', name: 'Onion', price: 0.5, quantity: 1 }] }),
      );

      expect(withoutOnion).toHaveLength(2);
    });

    it('keeps two quantities of the same extra apart — they cost different amounts', () => {
      const one = addCustomizedItem(
        [],
        baseProduct,
        makeResult({ addedIngredients: [{ id: 'a1', name: 'Bacon', price: 1.5, quantity: 1 }] }),
      );
      const two = addCustomizedItem(
        one,
        baseProduct,
        makeResult({ addedIngredients: [{ id: 'a1', name: 'Bacon', price: 1.5, quantity: 2 }] }),
      );

      expect(two).toHaveLength(2);
    });
  });
});
