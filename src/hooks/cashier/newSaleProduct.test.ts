import { decideTap } from './newSaleProduct';
import type { ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';

const detail = (overrides: Partial<ProductCustomizationDetail> = {}): ProductCustomizationDetail => ({
  id: 'product-1',
  name: 'Espresso',
  basePrice: 3.5,
  ...overrides,
});

describe('decideTap — the counter tap decision', () => {
  it('adds a product with no choosable rows directly at the detail base price', () => {
    const decision = decideTap(detail());
    expect(decision).toEqual({
      kind: 'simple',
      result: {
        productId: 'product-1',
        addedIngredients: [],
        removedIngredients: [],
        selectedIngredientIds: [],
        ingredientQuantities: {},
        sideItems: [],
        finalPrice: 3.5,
      },
    });
  });

  it('opens the sheet when an active variation exists', () => {
    const decision = decideTap(
      detail({
        variations: [
          { id: 'v1', name: 'Large', priceModifier: 1, finalPrice: 4.5, isActive: false, displayOrder: 1 },
          { id: 'v2', name: 'Small', priceModifier: 0, finalPrice: 3.5, isActive: true, displayOrder: 2 },
        ],
      }),
    );
    expect(decision.kind).toBe('sheet');
  });

  it('opens the sheet when an active ingredient row exists', () => {
    const decision = decideTap(
      detail({
        detailedIngredients: [
          { id: 'i1', name: 'Onion', isActive: false, isOptional: true },
          { id: 'i2', name: 'Bacon', isActive: true, isOptional: true, price: 2 },
        ],
      }),
    );
    expect(decision.kind).toBe('sheet');
  });

  it('opens the sheet when a suggested side exists', () => {
    const decision = decideTap(
      detail({ suggestedSideItems: [{ id: 's1', name: 'Fries', price: 4, isRequired: false, displayOrder: 1 }] }),
    );
    expect(decision.kind).toBe('sheet');
  });

  it('sends a product that hides its base with no active variation to the sheet, not to a 400', () => {
    const decision = decideTap(detail({ hideBaseProduct: true }));
    expect(decision.kind).toBe('sheet');
  });

  it('adds a base-hidden product that still has an active variation? no — a variation is a choice', () => {
    const decision = decideTap(
      detail({
        hideBaseProduct: true,
        variations: [{ id: 'v1', name: 'Only', priceModifier: 0, finalPrice: 3.5, isActive: true, displayOrder: 1 }],
      }),
    );
    expect(decision.kind).toBe('sheet');
  });
});
