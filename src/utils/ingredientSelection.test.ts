import { buildBaseIngredientSelection } from './ingredientSelection';
import { ingredientCustomizationPrice, type PriceableIngredient } from './linePrice';

const ing = (over: Partial<PriceableIngredient> & { id: string }): PriceableIngredient => ({
  price: 0,
  isOptional: true,
  isActive: true,
  ...over,
});

describe('buildBaseIngredientSelection — the one ingredient-default rule (base recipe)', () => {
  const ingredients = [
    ing({ id: 'dough', isOptional: false, price: 5 }), // required → in
    ing({ id: 'cheese', price: 2, isIncludedInBasePrice: true }), // optional, free in base → in
    ing({ id: 'bacon', price: 3, isIncludedInBasePrice: false }), // optional add-on → out
    ing({ id: 'truffle', price: 9, isIncludedInBasePrice: false, isActive: false }), // inactive → out
  ];

  it('preselects required + optional-included, excludes paid add-ons and inactive', () => {
    const { selectedIngredients } = buildBaseIngredientSelection(ingredients);
    expect(new Set(selectedIngredients)).toEqual(new Set(['dough', 'cheese']));
  });

  it('gives every default a quantity of 1', () => {
    const { selectedIngredients, ingredientQuantities } = buildBaseIngredientSelection(ingredients);
    for (const id of selectedIngredients) {
      expect(ingredientQuantities[id]).toBe(1);
    }
    expect(ingredientQuantities.bacon).toBeUndefined();
  });

  it('prices the default selection at exactly the base (customization delta 0)', () => {
    const { selectedIngredients, ingredientQuantities } = buildBaseIngredientSelection(ingredients);
    expect(ingredientCustomizationPrice(ingredients, selectedIngredients, ingredientQuantities)).toBe(0);
  });

  it('treats a missing isIncludedInBasePrice as "not in base" for optional ingredients', () => {
    const { selectedIngredients } = buildBaseIngredientSelection([
      ing({ id: 'maybe', price: 1 }), // optional, isIncludedInBasePrice undefined
    ]);
    expect(selectedIngredients).toEqual([]);
  });
});
