import { DEFAULT_INGREDIENT_QUANTITY, maxIngredientQuantity, toPriceableIngredients } from '../priceableIngredient';

/**
 * The input contract of the ONE price math. Its whole job is that a sheet cannot quietly drop a
 * field the server prices on — which is exactly how the waiter sheet came to charge for an
 * ingredient the base price had already bought (S7).
 */
describe('toPriceableIngredients', () => {
  it('carries every field the price math reads', () => {
    expect(
      toPriceableIngredients([
        { id: 'a', price: 2, isOptional: true, isActive: true, isIncludedInBasePrice: true, maxQuantity: 3 },
      ]),
    ).toEqual([{ id: 'a', price: 2, isOptional: true, isActive: true, isIncludedInBasePrice: true, maxQuantity: 3 }]);
  });

  it('reads a missing price as free, never as NaN', () => {
    expect(toPriceableIngredients([{ id: 'a', isOptional: true, isActive: true }])[0].price).toBe(0);
  });

  it('filters nothing — the price math owns the required/inactive rule, and owns it once', () => {
    const rows = toPriceableIngredients([
      { id: 'required', price: 1, isOptional: false, isActive: true },
      { id: 'inactive', price: 1, isOptional: true, isActive: false },
    ]);

    expect(rows.map((r) => r.id)).toEqual(['required', 'inactive']);
  });

  it('answers an empty list for nothing at all', () => {
    expect(toPriceableIngredients(undefined)).toEqual([]);
  });
});

describe('maxIngredientQuantity', () => {
  it('mirrors the price math’s own default, so no control can offer a clamped-away quantity', () => {
    expect(maxIngredientQuantity({})).toBe(DEFAULT_INGREDIENT_QUANTITY);
    expect(maxIngredientQuantity({ maxQuantity: 4 })).toBe(4);
  });
});
