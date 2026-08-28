import { ingredientsOfKind, mergeIngredientGroup, resolveIngredientKind } from './ingredientKind';
import type { ProductIngredient } from '@/types/menu';

/**
 * The rule the whole sauces split rests on (SHARED-MODIFIERS-AND-SAUCES-PLAN D8): Ingredients and
 * Sauces are two VIEWS over ONE `detailedIngredients` array. If the merge-back is not
 * order-preserving and field-preserving, editing a sauce silently rewrites an ingredient — and the
 * ids in that array are what `OrderItem.IngredientQuantitiesJson` references.
 */
const row = (id: string, over: Partial<ProductIngredient> = {}): ProductIngredient => ({
  id,
  name: id,
  isOptional: false,
  maxQuantity: 1,
  price: 0,
  isActive: true,
  displayOrder: 0,
  ...over,
});

// A legacy row: prod has 354 of these and not one carries a `kind`.
const legacy = row('legacy');
const explicitIngredient = row('flour', { kind: 'ingredient' });
const ketchup = row('ketchup', { kind: 'sauce', price: 0.5, isIncludedInBasePrice: true });
const mayo = row('mayo', { kind: 'sauce', globalIngredientId: 'glob-mayo' });

describe('resolveIngredientKind', () => {
  it('reads a row with NO kind as an ingredient', () => {
    expect(resolveIngredientKind(legacy)).toBe('ingredient');
    expect(resolveIngredientKind({})).toBe('ingredient');
    expect(resolveIngredientKind(undefined)).toBe('ingredient');
  });

  it('reads only the exact discriminator as a sauce', () => {
    expect(resolveIngredientKind({ kind: 'sauce' })).toBe('sauce');
    expect(resolveIngredientKind({ kind: 'Sauce' })).toBe('ingredient');
  });
});

describe('ingredientsOfKind', () => {
  const all = [legacy, ketchup, explicitIngredient, mayo];

  it('puts a kind-less row in Ingredients and keeps the product order', () => {
    expect(ingredientsOfKind(all, 'ingredient').map((r) => r.id)).toEqual(['legacy', 'flour']);
    expect(ingredientsOfKind(all, 'sauce').map((r) => r.id)).toEqual(['ketchup', 'mayo']);
  });
});

describe('mergeIngredientGroup', () => {
  const all = [legacy, ketchup, explicitIngredient, mayo];

  it('leaves the other group byte-identical when one row is edited', () => {
    const edited = mergeIngredientGroup(all, 'sauce', [{ ...ketchup, price: 1.5 }, mayo]);

    expect(edited.map((r) => r.id)).toEqual(['legacy', 'ketchup', 'flour', 'mayo']);
    expect(edited[0]).toBe(legacy);
    expect(edited[2]).toBe(explicitIngredient);
    expect(edited[1].price).toBe(1.5);
    // Fields no control on the row renders survive the edit.
    expect(edited[1].isIncludedInBasePrice).toBe(true);
    expect(edited[3].globalIngredientId).toBe('glob-mayo');
  });

  it('keeps each kind in its own positions when a row is removed', () => {
    const removed = mergeIngredientGroup(all, 'ingredient', [explicitIngredient]);

    // The ingredient slots collapse; neither sauce moves relative to them.
    expect(removed.map((r) => r.id)).toEqual(['flour', 'ketchup', 'mayo']);
  });

  it('appends a row the group grew by, without touching the other kind', () => {
    const added = row('bbq', { kind: 'sauce' });
    const grown = mergeIngredientGroup(all, 'sauce', [ketchup, mayo, added]);

    expect(grown.map((r) => r.id)).toEqual(['legacy', 'ketchup', 'flour', 'mayo', 'bbq']);
  });

  it('empties one group without emptying the other', () => {
    expect(mergeIngredientGroup(all, 'sauce', []).map((r) => r.id)).toEqual(['legacy', 'flour']);
  });
});
